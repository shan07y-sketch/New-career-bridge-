'use strict';
/** CareerBridge – Recruitment Management Portal (Node.js REST API + static UI). */
process.removeAllListeners('warning');
const fs = require('node:fs');
const path = require('node:path');
const { createApp, json, readMultipart, serveStatic, HttpError } = require('./lib/http');
const db = require('./db');
const sec = require('./lib/security');
const ai = require('./services/ai');
const matcher = require('./services/matcher');
const { notifyCompany } = require('./services/notify');
const U = require('./lib/util');

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const UPLOADS = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

const app = createApp();
app.use(json());

// ---------- helpers ----------
const SYSTEM = 'You are CareerBridge AI inside a recruitment portal for small organisations. Assess only job-relevant skills and experience from the evidence given. Never consider or infer age, gender, ethnicity, religion, nationality, caste, disability or marital status. Your output supports the recruiter; it does not replace their decision. Be specific and concise.';

async function aiCfg(companyId) {
  const c = await db.get('SELECT ai_api_key_enc, ai_provider, ai_model FROM companies WHERE id = ?', [companyId]);
  const key = sec.decryptSecret(c && c.ai_api_key_enc);
  if (key) return { provider: c.ai_provider || ai.detectProvider(key), key, model: c.ai_model || null, source: 'settings' };
  return ai.envConfig();
}

async function auth(req) {
  const t = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const p = sec.verifyToken(t);
  if (!p) throw new HttpError(401, 'Please sign in');
  const u = await db.get('SELECT id, company_id, name, email, role, title FROM recruiters WHERE id = ?', [p.uid]);
  if (!u) throw new HttpError(401, 'Please sign in');
  req.user = u;
  return u;
}
const A = (fn) => async (req, res) => { await auth(req); return fn(req, res); };

async function loadApp(id, companyId) {
  const a = await db.get(`SELECT a.*, c.name, c.email, c.phone, c.location, c.current_title, c.current_company, c.experience_years,
    c.linkedin_url, c.github_url, c.portfolio_url, c.skills AS cand_skills, c.resume_text, c.resume_file, c.resume_name, c.avatar_color,
    c.expected_salary, c.availability, c.education, j.title AS job_title, j.department, j.location AS job_location, j.skills AS job_skills,
    j.description AS job_description, j.requirements AS job_requirements, j.experience_min, j.experience_max, r.name AS recruiter_name
    FROM applications a JOIN candidates c ON c.id = a.candidate_id JOIN jobs j ON j.id = a.job_id LEFT JOIN recruiters r ON r.id = a.recruiter_id
    WHERE a.id = ? AND a.company_id = ?`, [id, companyId]);
  if (!a) throw new HttpError(404, 'Application not found');
  a.match_details = U.parseJSON(a.match_details, {});
  a.ai_insights = U.parseJSON(a.ai_insights, null);
  a.ai_interview = U.parseJSON(a.ai_interview, null);
  a.job_skills = U.parseJSON(a.job_skills, []);
  return a;
}

async function moveStage(app_, to, userId, note) {
  if (!U.ALL_STAGES.includes(to)) throw new HttpError(400, 'Unknown stage');
  if (app_.stage === to) return;
  const now = U.nowIso();
  const idx = U.STAGES.indexOf(to);
  await db.update('applications', app_.id, { stage: to, furthest_stage: Math.max(app_.furthest_stage || 0, idx), stage_changed_at: now, updated_at: now });
  await db.insert('stage_history', { application_id: app_.id, from_stage: app_.stage, to_stage: to, changed_by: userId, note, changed_at: now });
  await db.insert('messages', { application_id: app_.id, company_id: app_.company_id, sender_type: 'system', body: `Status update: your application is now at the "${U.STAGE_LABELS[to]}" stage.`, channel: 'portal', sent_at: now });
}

function fallbackInsights(a) {
  const d = a.match_details || {};
  return {
    source: 'matcher',
    summary: `${a.name} — ${d.headline || a.current_title || 'candidate'}${d.experience_years ? `, about ${d.experience_years} years of experience` : ''}. Strongest skills: ${(d.skills_found || []).slice(0, 4).join(', ') || 'n/a'}.`,
    ai_fit: d.level || 'Medium', ai_score: a.match_score,
    strengths: (d.matched_skills || []).slice(0, 3), growth_areas: (d.missing_skills || []).slice(0, 3),
    tags: (d.skills_found || []).slice(0, 3), recommendation: a.match_score >= 75 ? 'Shortlist and schedule a screening call.' : 'Review manually against the core requirements.',
  };
}

async function genInsights(a) {
  const cfg = await aiCfg(a.company_id);
  const d = a.match_details || {};
  const prompt = `JOB: ${a.job_title} (${a.department || ''}, ${a.job_location || ''})
Required skills: ${a.job_skills.join(', ')}
Experience: ${a.experience_min ?? '?'}-${a.experience_max ?? '?'} years
Description: ${(a.job_description || '').slice(0, 2000)}
Requirements: ${(a.job_requirements || '').slice(0, 1200)}

PYTHON MATCHER: match ${a.match_score}%, ATS ${a.ats_score}%, matched: ${(d.matched_skills || []).join(', ')}, missing: ${(d.missing_skills || []).join(', ')}

RESUME of ${a.name}:
"""${(a.resume_text || '').slice(0, 7000)}"""

Return JSON: {"summary":"2-3 sentences for a recruiter","ai_fit":"High|Medium|Low","ai_score":0-100,"ats_comment":"one sentence","strengths":["3 phrases, max 6 words"],"growth_areas":["2-3 phrases, max 6 words"],"tags":["3 short tags"],"recommendation":"one sentence next step"}`;
  const r = await ai.complete(cfg, { system: SYSTEM, prompt, json: true });
  return { ...r.data, source: 'ai', model: r.model, provider: r.provider };
}

async function runInsights(id, companyId) {
  const a = await loadApp(id, companyId);
  try {
    const ins = await genInsights(a);
    await db.update('applications', id, { ai_insights: ins, ai_status: 'done', ai_error: null, ai_generated_at: U.nowIso() });
  } catch (e) {
    await db.update('applications', id, { ai_insights: fallbackInsights(a), ai_status: 'error', ai_error: e.message, ai_generated_at: U.nowIso() });
  }
}

async function scoreApplication(appId, job, resumeText, resumePath) {
  const r = await matcher.matchOne({ resumeText, resumePath, job });
  return r;
}

// ---------- auth ----------
app.post('/api/auth/login', async (req, res) => {
  const u = await db.get('SELECT * FROM recruiters WHERE LOWER(email) = ?', [String(req.body.email || '').toLowerCase().trim()]);
  if (!u || !sec.verifyPassword(req.body.password || '', u.password_hash)) throw new HttpError(401, 'Wrong email or password');
  await db.update('recruiters', u.id, { last_login_at: U.nowIso() });
  res.json({ token: sec.signToken({ uid: u.id }), user: { id: u.id, name: u.name, email: u.email, role: u.role, title: u.title } });
});
app.post('/api/auth/register', async (req, res) => {
  U.requireFields(req.body, ['company', 'name', 'email', 'password']);
  if (await db.get('SELECT id FROM recruiters WHERE LOWER(email) = ?', [req.body.email.toLowerCase()])) throw new HttpError(409, 'Email already registered');
  let slug = U.slugify(req.body.company);
  if (await db.get('SELECT id FROM companies WHERE slug = ?', [slug])) slug += '-' + Date.now().toString(36).slice(-4);
  const cid = await db.insert('companies', { name: req.body.company, slug, currency: 'INR', hiring_goal: 10, careers_enabled: 1, created_at: U.nowIso() });
  const uid = await db.insert('recruiters', { company_id: cid, name: req.body.name, email: req.body.email.toLowerCase(), password_hash: sec.hashPassword(req.body.password), role: 'admin', title: 'Admin', status: 'active', created_at: U.nowIso() });
  res.json({ token: sec.signToken({ uid }) });
});
app.get('/api/me', A(async (req, res) => {
  const c = await db.get('SELECT id, name, slug, location, industry, currency, hiring_goal FROM companies WHERE id = ?', [req.user.company_id]);
  const cfg = await aiCfg(req.user.company_id);
  res.json({ user: req.user, company: c, ai: cfg ? { provider: cfg.provider, source: cfg.source } : null });
}));

app.put('/api/me', A(async (req, res) => {
  U.requireFields(req.body, ['name']);
  await db.update('recruiters', req.user.id, { name: req.body.name, title: req.body.title, phone: req.body.phone || null });
  res.json({ ok: true });
}));
app.post('/api/me/password', A(async (req, res) => {
  const u = await db.get('SELECT password_hash FROM recruiters WHERE id = ?', [req.user.id]);
  if (!sec.verifyPassword(req.body.current || '', u.password_hash)) throw new HttpError(400, 'Current password is wrong');
  if (String(req.body.next || '').length < 6) throw new HttpError(400, 'New password must be at least 6 characters');
  await db.update('recruiters', req.user.id, { password_hash: sec.hashPassword(req.body.next) });
  res.json({ ok: true });
}));
app.post('/api/recruiters/:id/reset-password', A(async (req, res) => {
  if (req.user.role !== 'admin') throw new HttpError(403, 'Only admins can reset passwords');
  const r = await db.get('SELECT id FROM recruiters WHERE id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
  if (!r) throw new HttpError(404, 'Recruiter not found');
  const pw = sec.randomToken(6);
  await db.update('recruiters', r.id, { password_hash: sec.hashPassword(pw) });
  res.json({ temp_password: pw });
}));
app.get('/api/jobs/:id', A(async (req, res) => {
  const j = await db.get('SELECT j.*, r.name AS recruiter_name FROM jobs j LEFT JOIN recruiters r ON r.id = j.recruiter_id WHERE j.id = ? AND j.company_id = ?', [req.params.id, req.user.company_id]);
  if (!j) throw new HttpError(404, 'Job not found');
  j.skills = U.parseJSON(j.skills, []); j.ai_insights = U.parseJSON(j.ai_insights, null);
  j.applications = await db.all('SELECT a.id, a.stage, a.match_score, a.ats_score, a.created_at, c.name, c.current_title, c.avatar_color FROM applications a JOIN candidates c ON c.id = a.candidate_id WHERE a.job_id = ? ORDER BY a.match_score DESC', [j.id]);
  res.json(j);
}));
app.patch('/api/jobs/:id/status', A(async (req, res) => {
  if (!U.JOB_STATUSES.includes(req.body.status)) throw new HttpError(400, 'Unknown status');
  const j = await db.get('SELECT * FROM jobs WHERE id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
  if (!j) throw new HttpError(404, 'Job not found');
  await db.update('jobs', j.id, { status: req.body.status, updated_at: U.nowIso(), published_at: req.body.status === 'published' && !j.published_at ? U.nowIso() : undefined, closed_at: req.body.status === 'closed' ? U.nowIso() : undefined });
  res.json({ ok: true });
}));

// ---------- dashboard ----------
app.get('/api/dashboard', A(async (req, res) => {
  const cid = req.user.company_id;
  const n = async (sql, p = []) => Number((await db.get(sql, [cid, ...p])).n || 0);
  const d30 = U.daysAgo(30), d60 = U.daysAgo(60);
  const funnel = [];
  for (let i = 0; i < 5; i++) funnel.push({ stage: U.STAGES[i], count: await n("SELECT COUNT(*) n FROM applications WHERE company_id = ? AND furthest_stage >= ?", [i]) });
  const company = await db.get('SELECT hiring_goal, location FROM companies WHERE id = ?', [cid]);
  const prio = await db.get(`SELECT j.title, COUNT(*) n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.company_id = ? AND a.stage = 'applied' GROUP BY j.id, j.title ORDER BY n DESC LIMIT 1`, [cid]);
  const from = req.query.from || U.daysAgo(0.5), to = req.query.to || new Date(Date.now() + 86400000).toISOString();
  const today = await db.all(`SELECT i.*, c.name, j.title AS job_title, a.id AS app_id FROM interviews i JOIN applications a ON a.id = i.application_id JOIN candidates c ON c.id = a.candidate_id JOIN jobs j ON j.id = a.job_id
    WHERE i.company_id = ? AND i.scheduled_at >= ? AND i.scheduled_at < ? AND i.status = 'scheduled' ORDER BY i.scheduled_at`, [cid, from, to]);
  res.json({
    active_jobs: await n("SELECT COUNT(*) n FROM jobs WHERE company_id = ? AND status = 'published'"),
    applications: await n('SELECT COUNT(*) n FROM applications WHERE company_id = ?'),
    apps_30: await n('SELECT COUNT(*) n FROM applications WHERE company_id = ? AND created_at >= ?', [d30]),
    apps_prev: await n('SELECT COUNT(*) n FROM applications WHERE company_id = ? AND created_at >= ? AND created_at < ?', [d60, d30]),
    interviews: await n("SELECT COUNT(*) n FROM interviews WHERE company_id = ? AND status <> 'cancelled'"),
    offers: await n('SELECT COUNT(*) n FROM applications WHERE company_id = ? AND furthest_stage >= 4'),
    hired: await n("SELECT COUNT(*) n FROM applications WHERE company_id = ? AND stage = 'hired'"),
    avg_match: await n('SELECT AVG(match_score) n FROM applications WHERE company_id = ?'),
    hiring_goal: company.hiring_goal || 10, location: company.location,
    priority: prio ? `Review ${prio.n} new applicant${prio.n > 1 ? 's' : ''} for the ${prio.title} role.` : 'All caught up — share your careers page to get more applicants.',
    funnel, today,
  });
}));

// ---------- jobs ----------
app.get('/api/jobs', A(async (req, res) => {
  const rows = await db.all(`SELECT j.*, r.name AS recruiter_name, (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicants,
    (SELECT AVG(match_score) FROM applications a WHERE a.job_id = j.id) AS avg_match FROM jobs j LEFT JOIN recruiters r ON r.id = j.recruiter_id
    WHERE j.company_id = ? ORDER BY j.created_at DESC`, [req.user.company_id]);
  res.json(rows.map((j) => ({ ...j, skills: U.parseJSON(j.skills, []), ai_insights: U.parseJSON(j.ai_insights, null), avg_match: j.avg_match ? Math.round(j.avg_match) : null })));
}));
function jobRow(b) {
  return {
    title: b.title, department: b.department, location: b.location, work_mode: b.work_mode, employment_type: b.employment_type,
    experience_min: U.toIntOrNull(b.experience_min), experience_max: U.toIntOrNull(b.experience_max), salary_min: U.toIntOrNull(b.salary_min),
    salary_max: U.toIntOrNull(b.salary_max), openings: U.toIntOrNull(b.openings) || 1, description: b.description, requirements: b.requirements,
    skills: Array.isArray(b.skills) ? b.skills : String(b.skills || '').split(',').map((s) => s.trim()).filter(Boolean),
    status: U.JOB_STATUSES.includes(b.status) ? b.status : 'draft', is_urgent: b.is_urgent ? 1 : 0,
  };
}
app.post('/api/jobs', A(async (req, res) => {
  U.requireFields(req.body, ['title']);
  const now = U.nowIso();
  const row = jobRow(req.body);
  const id = await db.insert('jobs', { ...row, company_id: req.user.company_id, recruiter_id: req.user.id, created_at: now, updated_at: now, published_at: row.status === 'published' ? now : null });
  await notifyCompany(req.user.company_id, { type: 'job', title: `New job: ${row.title}`, body: `Created by ${req.user.name}`, link: '/jobs' }, { exceptUserId: req.user.id });
  res.json({ id });
}));
app.put('/api/jobs/:id', A(async (req, res) => {
  const j = await db.get('SELECT * FROM jobs WHERE id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
  if (!j) throw new HttpError(404, 'Job not found');
  const row = jobRow({ ...j, skills: U.parseJSON(j.skills, []), ...req.body });
  await db.update('jobs', j.id, { ...row, updated_at: U.nowIso(), published_at: row.status === 'published' && !j.published_at ? U.nowIso() : j.published_at });
  res.json({ ok: true });
}));
app.delete('/api/jobs/:id', A(async (req, res) => {
  await db.run('DELETE FROM jobs WHERE id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
  res.json({ ok: true });
}));
app.post('/api/jobs/generate', A(async (req, res) => {
  const cfg = await aiCfg(req.user.company_id);
  const b = req.body;
  const r = await ai.complete(cfg, { system: SYSTEM, json: true, prompt: `Write a job posting. Title: ${b.title}. Department: ${b.department || ''}. Location: ${b.location || ''}. Work mode: ${b.work_mode || ''}. Experience: ${b.experience_min || 0}-${b.experience_max || ''} years. Notes: ${b.notes || ''}.
Return JSON: {"description":"120-170 words, warm, inclusive, plain language","requirements":"5-7 lines each starting with '- '","skills":["6-8 key skills"],"salary_min":annual integer in INR,"salary_max":annual integer in INR}` });
  res.json(r.data);
}));
app.post('/api/jobs/:id/insights', A(async (req, res) => {
  const j = await db.get('SELECT * FROM jobs WHERE id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
  if (!j) throw new HttpError(404, 'Job not found');
  const r = await ai.complete(await aiCfg(req.user.company_id), { system: SYSTEM, json: true, prompt: `Job: ${j.title}, ${j.department}, ${j.location}, ${j.work_mode}. Experience ${j.experience_min}-${j.experience_max} yrs. Skills: ${j.skills}. Posted salary: ${j.salary_min}-${j.salary_max}.
Return JSON: {"salary_min":int,"salary_max":int,"currency":"INR or local currency for the location","salary_note":"one sentence; say it is an AI estimate","competition":"Low|Medium|High","competition_note":"one sentence","time_to_fill_days":int,"posting_tips":["2-3 short tips"]}` });
  await db.update('jobs', j.id, { ai_insights: { ...r.data, model: r.model }, ai_generated_at: U.nowIso() });
  res.json({ ...r.data, model: r.model });
}));

// ---------- applications / candidates ----------
app.get('/api/applications', A(async (req, res) => {
  const p = [req.user.company_id];
  let where = 'a.company_id = ?';
  if (req.query.job) { where += ' AND a.job_id = ?'; p.push(req.query.job); }
  if (req.query.stage) { where += ' AND a.stage = ?'; p.push(req.query.stage); }
  if (req.query.q) { where += ' AND (LOWER(c.name) LIKE ? OR LOWER(j.title) LIKE ?)'; p.push(U.likeTerm(req.query.q), U.likeTerm(req.query.q)); }
  const rows = await db.all(`SELECT a.id, a.stage, a.match_score, a.ats_score, a.match_level, a.source, a.created_at, c.name, c.email, c.current_title, c.location, c.avatar_color,
    j.title AS job_title, j.id AS job_id FROM applications a JOIN candidates c ON c.id = a.candidate_id JOIN jobs j ON j.id = a.job_id WHERE ${where} ORDER BY a.match_score DESC LIMIT 500`, p);
  res.json(rows);
}));
app.get('/api/applications/:id', A(async (req, res) => {
  const a = await loadApp(req.params.id, req.user.company_id);
  await db.update('applications', a.id, { last_viewed_at: U.nowIso() });
  if (!a.ai_insights && a.ai_status !== 'pending') {
    await db.update('applications', a.id, { ai_status: 'pending' });
    a.ai_status = 'pending';
    runInsights(a.id, a.company_id).catch(() => {});
  }
  a.history = await db.all('SELECT h.*, r.name AS by_name FROM stage_history h LEFT JOIN recruiters r ON r.id = h.changed_by WHERE application_id = ? ORDER BY changed_at', [a.id]);
  a.interviews = await db.all('SELECT i.*, r.name AS interviewer FROM interviews i LEFT JOIN recruiters r ON r.id = i.interviewer_id WHERE application_id = ? ORDER BY scheduled_at DESC', [a.id]);
  a.messages = await db.all('SELECT m.*, r.name AS sender_name FROM messages m LEFT JOIN recruiters r ON r.id = m.sender_id WHERE application_id = ? ORDER BY sent_at', [a.id]);
  delete a.resume_text_full;
  res.json(a);
}));
app.patch('/api/applications/:id/stage', A(async (req, res) => {
  const a = await loadApp(req.params.id, req.user.company_id);
  await moveStage(a, req.body.stage, req.user.id, req.body.note);
  res.json({ ok: true });
}));
app.post('/api/applications/:id/ai', A(async (req, res) => {
  await runInsights(Number(req.params.id), req.user.company_id);
  res.json(await loadApp(req.params.id, req.user.company_id));
}));
app.post('/api/applications/:id/interview-kit', A(async (req, res) => {
  const a = await loadApp(req.params.id, req.user.company_id);
  const r = await ai.complete(await aiCfg(a.company_id), { system: SYSTEM, json: true, prompt: `Prepare an interview kit. Job: ${a.job_title}; skills: ${a.job_skills.join(', ')}. Candidate ${a.name}: match ${a.match_score}%, matched ${(a.match_details.matched_skills || []).join(', ')}, missing ${(a.match_details.missing_skills || []).join(', ')}.
Resume: """${(a.resume_text || '').slice(0, 5000)}"""
Return JSON: {"readiness":0-100,"readiness_label":"High|Medium|Low","predicted_score":0-10 one decimal,"basis":"one sentence","agenda":[{"item":"...","minutes":int}],"questions":[{"question":"...","focus":"short label","relevance":0-100}] (5 questions tailored to strengths and gaps)}` });
  await db.update('applications', a.id, { ai_interview: { ...r.data, model: r.model } });
  res.json({ ...r.data, model: r.model });
}));
app.get('/api/applications/:id/resume', A(async (req, res) => {
  const a = await loadApp(req.params.id, req.user.company_id);
  if (!a.resume_file) return res.send(a.resume_text || '', 'text/plain; charset=utf-8');
  const f = path.join(UPLOADS, path.basename(a.resume_file));
  res.set('Content-Disposition', `attachment; filename="${(a.resume_name || 'resume').replace(/"/g, '')}"`);
  res.send(fs.readFileSync(f), 'application/octet-stream');
}));

// shared intake: create candidate + application from upload
async function intake(companyId, job, fields, file, source, recruiterId) {
  U.requireFields(fields, ['name', 'email']);
  if (!U.isEmail(fields.email)) throw new HttpError(400, 'Please enter a valid email');
  let resumePath = null, resumeFile = null, resumeName = null;
  if (file) {
    const ext = path.extname(file.filename || '').toLowerCase();
    if (!['.pdf', '.docx', '.txt'].includes(ext)) throw new HttpError(400, 'Resume must be PDF, DOCX or TXT');
    resumeFile = sec.randomToken(12) + ext;
    resumeName = file.filename;
    resumePath = path.join(UPLOADS, resumeFile);
    fs.writeFileSync(resumePath, file.buffer);
  }
  const text = fields.resume_text || '';
  if (!resumePath && text.trim().length < 50) throw new HttpError(400, 'Please upload a resume (PDF, DOCX or TXT)');
  const m = await scoreApplication(null, job, text, resumePath);
  const resumeText = m.text || text;
  if (resumeText.trim().length < 30) throw new HttpError(400, 'Could not read text from this resume. Please upload a text-based PDF or DOCX.');
  const now = U.nowIso();
  const cid = await db.insert('candidates', {
    company_id: companyId, name: fields.name.trim(), email: fields.email.trim().toLowerCase(), phone: fields.phone || m.contact.phone,
    location: fields.location || null, current_title: fields.current_title || m.headline || null, experience_years: m.experience_years,
    linkedin_url: fields.linkedin || m.contact.linkedin, github_url: fields.github || m.contact.github, portfolio_url: fields.portfolio || m.contact.portfolio,
    education: m.education, skills: m.skills_found, expected_salary: fields.expected_salary || null, availability: fields.availability || null,
    resume_text: resumeText, resume_file: resumeFile, resume_name: resumeName, avatar_color: U.colorFor(fields.name), created_at: now,
  });
  delete m.text;
  const token = sec.randomToken(16);
  const aid = await db.insert('applications', {
    job_id: job.id, candidate_id: cid, company_id: companyId, recruiter_id: recruiterId || job.recruiter_id, stage: 'applied', furthest_stage: 0,
    source, cover_letter: fields.cover_letter || null, match_score: m.match_score, ats_score: m.ats_score, match_level: m.level, match_details: m,
    matched_at: now, ai_status: 'pending', status_token: token, stage_changed_at: now, created_at: now, updated_at: now,
  });
  await db.insert('stage_history', { application_id: aid, from_stage: null, to_stage: 'applied', changed_at: now });
  await notifyCompany(companyId, { type: 'application', title: `New application: ${fields.name}`, body: `${job.title} · ${m.match_score}% match`, link: `/candidates/${aid}` });
  runInsights(aid, companyId).catch(() => {});
  return { id: aid, token, match_score: m.match_score, ats_score: m.ats_score };
}

app.post('/api/applications', A(async (req, res) => {
  const { fields, files } = await readMultipart(req);
  const job = await db.get('SELECT * FROM jobs WHERE id = ? AND company_id = ?', [fields.job_id, req.user.company_id]);
  if (!job) throw new HttpError(400, 'Choose a job');
  res.json(await intake(req.user.company_id, job, fields, files.resume, fields.source || 'Added by recruiter', req.user.id));
}));

// ---------- interviews ----------
app.get('/api/interviews', A(async (req, res) => {
  res.json(await db.all(`SELECT i.*, c.name, c.avatar_color, j.title AS job_title, r.name AS interviewer, a.id AS app_id, a.match_score FROM interviews i
    JOIN applications a ON a.id = i.application_id JOIN candidates c ON c.id = a.candidate_id JOIN jobs j ON j.id = a.job_id
    LEFT JOIN recruiters r ON r.id = i.interviewer_id WHERE i.company_id = ? ORDER BY i.scheduled_at DESC LIMIT 300`, [req.user.company_id]));
}));
app.post('/api/interviews', A(async (req, res) => {
  U.requireFields(req.body, ['application_id', 'scheduled_at']);
  const a = await loadApp(req.body.application_id, req.user.company_id);
  const platform = req.body.platform || 'Jitsi Meet';
  const link = req.body.meeting_link || (platform === 'Jitsi Meet' ? `https://meet.jit.si/CareerBridge-${sec.randomToken(8)}` : null);
  const now = U.nowIso();
  const id = await db.insert('interviews', {
    application_id: a.id, company_id: a.company_id, interviewer_id: req.body.interviewer_id || req.user.id, scheduled_at: new Date(req.body.scheduled_at).toISOString(),
    duration_minutes: U.toIntOrNull(req.body.duration_minutes) || 45, type: req.body.type || 'Technical Interview', platform, meeting_link: link,
    location: req.body.location || null, status: 'scheduled', created_by: req.user.id, created_at: now, updated_at: now,
  });
  if (!['interview', 'offer', 'hired'].includes(a.stage)) await moveStage(a, 'interview', req.user.id, 'Interview scheduled');
  const when = new Date(req.body.scheduled_at).toUTCString();
  await db.insert('messages', { application_id: a.id, company_id: a.company_id, sender_type: 'recruiter', sender_id: req.user.id, subject: 'Interview invitation',
    body: `Hi ${a.name}, your ${req.body.type || 'interview'} for ${a.job_title} is scheduled on ${when} via ${platform}.${link ? ' Join here: ' + link : ''}${req.body.location ? ' Location: ' + req.body.location : ''}`, channel: 'portal', sent_at: now });
  res.json({ id, meeting_link: link });
}));
app.patch('/api/interviews/:id', A(async (req, res) => {
  const i = await db.get('SELECT * FROM interviews WHERE id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
  if (!i) throw new HttpError(404, 'Interview not found');
  await db.update('interviews', i.id, { status: req.body.status, scheduled_at: req.body.scheduled_at ? new Date(req.body.scheduled_at).toISOString() : undefined, updated_at: U.nowIso() });
  res.json({ ok: true });
}));
app.post('/api/interviews/:id/evaluation', A(async (req, res) => {
  const i = await db.get('SELECT * FROM interviews WHERE id = ? AND company_id = ?', [req.params.id, req.user.company_id]);
  if (!i) throw new HttpError(404, 'Interview not found');
  const s = ['technical', 'communication', 'culture_fit', 'problem_solving'].map((k) => U.clampInt(req.body[k], 1, 5, 3));
  await db.insert('evaluations', { interview_id: i.id, evaluator_id: req.user.id, technical: s[0], communication: s[1], culture_fit: s[2], problem_solving: s[3],
    score: s.reduce((x, y) => x + y, 0) / 4, recommendation: req.body.recommendation || 'hire', notes: req.body.notes || '', created_at: U.nowIso() });
  await db.update('interviews', i.id, { status: 'completed', updated_at: U.nowIso() });
  res.json({ ok: true });
}));

// ---------- messages ----------
app.get('/api/conversations', A(async (req, res) => {
  res.json(await db.all(`SELECT a.id, c.name, c.avatar_color, j.title AS job_title, a.stage, MAX(m.sent_at) AS last_at,
    SUM(CASE WHEN m.sender_type = 'candidate' AND m.read_at IS NULL THEN 1 ELSE 0 END) AS unread
    FROM messages m JOIN applications a ON a.id = m.application_id JOIN candidates c ON c.id = a.candidate_id JOIN jobs j ON j.id = a.job_id
    WHERE m.company_id = ? GROUP BY a.id, c.name, c.avatar_color, j.title, a.stage ORDER BY last_at DESC`, [req.user.company_id]));
}));
app.post('/api/applications/:id/messages', A(async (req, res) => {
  const a = await loadApp(req.params.id, req.user.company_id);
  U.requireFields(req.body, ['body']);
  await db.insert('messages', { application_id: a.id, company_id: a.company_id, sender_type: 'recruiter', sender_id: req.user.id, subject: req.body.subject || null, body: req.body.body, channel: 'portal', sent_at: U.nowIso() });
  await db.run("UPDATE messages SET read_at = ? WHERE application_id = ? AND sender_type = 'candidate' AND read_at IS NULL", [U.nowIso(), a.id]);
  res.json({ ok: true });
}));
app.post('/api/applications/:id/draft', A(async (req, res) => {
  const a = await loadApp(req.params.id, req.user.company_id);
  const r = await ai.complete(await aiCfg(a.company_id), { system: SYSTEM, json: true, prompt: `Write a message from ${req.user.name} (${req.user.title || 'Recruiter'}) to candidate ${a.name} about the ${a.job_title} role. Current stage: ${a.stage}. Purpose: ${req.body.intent || 'status update'}. Warm, clear, 70-130 words, plain text, no placeholders.
Return JSON: {"subject":"...","body":"..."}` });
  res.json(r.data);
}));

// ---------- notifications / company / settings / analytics ----------
app.get('/api/notifications', A(async (req, res) => {
  res.json(await db.all('SELECT * FROM notifications WHERE recruiter_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]));
}));
app.post('/api/notifications/read-all', A(async (req, res) => {
  await db.run('UPDATE notifications SET is_read = 1 WHERE recruiter_id = ?', [req.user.id]);
  res.json({ ok: true });
}));
app.get('/api/company', A(async (req, res) => {
  const c = await db.get('SELECT * FROM companies WHERE id = ?', [req.user.company_id]);
  delete c.ai_api_key_enc;
  c.company_values = U.parseJSON(c.company_values, []);
  c.recruiters = await db.all('SELECT id, name, email, role, title FROM recruiters WHERE company_id = ?', [c.id]);
  c.open_jobs = (await db.get("SELECT COUNT(*) n FROM jobs WHERE company_id = ? AND status = 'published'", [c.id])).n;
  res.json(c);
}));
app.put('/api/company', A(async (req, res) => {
  const b = req.body;
  await db.update('companies', req.user.company_id, { name: b.name, industry: b.industry, location: b.location, website: b.website, about: b.about, mission: b.mission,
    company_values: Array.isArray(b.company_values) ? b.company_values : undefined, employees: U.toIntOrNull(b.employees), hiring_goal: U.toIntOrNull(b.hiring_goal), updated_at: U.nowIso() });
  res.json({ ok: true });
}));
app.post('/api/recruiters', A(async (req, res) => {
  U.requireFields(req.body, ['name', 'email']);
  const pw = sec.randomToken(6);
  await db.insert('recruiters', { company_id: req.user.company_id, name: req.body.name, email: req.body.email.toLowerCase(), password_hash: sec.hashPassword(pw), role: req.body.role || 'recruiter', title: req.body.title || 'Recruiter', status: 'active', created_at: U.nowIso() });
  res.json({ temp_password: pw });
}));
app.get('/api/settings/ai', A(async (req, res) => {
  const cfg = await aiCfg(req.user.company_id);
  res.json({ configured: !!cfg, provider: cfg && cfg.provider, source: cfg && cfg.source, stats: ai.stats, matcher: matcher.getHealth(), database: db.describe });
}));
app.put('/api/settings/ai', A(async (req, res) => {
  const key = String(req.body.key || '').trim();
  const provider = key ? ai.detectProvider(key) : null;
  if (key && !provider) throw new HttpError(400, 'Unrecognised key. Use a Gemini (AIza…), Groq (gsk_…), OpenRouter, OpenAI or Anthropic key.');
  await db.update('companies', req.user.company_id, { ai_api_key_enc: key ? sec.encryptSecret(key) : null, ai_provider: provider, ai_model: req.body.model || null });
  res.json({ ok: true, provider });
}));
app.post('/api/settings/ai/test', A(async (req, res) => {
  const r = await ai.complete(await aiCfg(req.user.company_id), { system: 'You are a test.', prompt: 'Return JSON {"ok":true,"message":"CareerBridge AI is connected"}', json: true });
  res.json({ ...r.data, model: r.model, provider: r.provider });
}));
app.get('/api/analytics', A(async (req, res) => {
  const cid = req.user.company_id;
  const apps = await db.all('SELECT a.created_at, a.source, a.match_score, a.stage, j.department FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.company_id = ?', [cid]);
  const count = (k) => apps.reduce((m, a) => ((m[a[k] || 'Other'] = (m[a[k] || 'Other'] || 0) + 1), m), {});
  const weeks = {};
  for (const a of apps) { const w = Math.floor((Date.now() - Date.parse(a.created_at)) / (7 * 86400000)); if (w < 12) weeks[w] = (weeks[w] || 0) + 1; }
  const buckets = { '<50': 0, '50-64': 0, '65-79': 0, '80-89': 0, '90+': 0 };
  for (const a of apps) { const s = a.match_score || 0; buckets[s < 50 ? '<50' : s < 65 ? '50-64' : s < 80 ? '65-79' : s < 90 ? '80-89' : '90+']++; }
  res.json({ total: apps.length, by_source: count('source'), by_department: count('department'), by_stage: count('stage'),
    weekly: Array.from({ length: 12 }, (_, i) => weeks[11 - i] || 0), match_buckets: buckets });
}));
app.post('/api/analytics/summary', A(async (req, res) => {
  const r = await ai.complete(await aiCfg(req.user.company_id), { system: SYSTEM, json: true, prompt: `Hiring metrics: ${JSON.stringify(req.body.metrics).slice(0, 4000)}
Return JSON: {"headline":"one sentence","insights":[{"title":"...","detail":"..."}],"recommendations":["3 short actions"]}` });
  res.json(r.data);
}));
app.get('/api/search', A(async (req, res) => {
  const t = U.likeTerm(req.query.q || '');
  const cid = req.user.company_id;
  res.json({
    candidates: await db.all('SELECT a.id, c.name, j.title AS job_title FROM applications a JOIN candidates c ON c.id = a.candidate_id JOIN jobs j ON j.id = a.job_id WHERE a.company_id = ? AND LOWER(c.name) LIKE ? LIMIT 6', [cid, t]),
    jobs: await db.all('SELECT id, title, department FROM jobs WHERE company_id = ? AND LOWER(title) LIKE ? LIMIT 6', [cid, t]),
  });
}));

// ---------- public careers + candidate status ----------
app.get('/api/public/:slug', async (req, res) => {
  const c = await db.get('SELECT id, name, slug, location, industry, about, logo_path FROM companies WHERE slug = ?', [req.params.slug]);
  if (!c) throw new HttpError(404, 'Company not found');
  c.jobs = (await db.all("SELECT id, title, department, location, work_mode, employment_type, experience_min, experience_max, description, requirements, skills FROM jobs WHERE company_id = ? AND status = 'published' ORDER BY created_at DESC", [c.id]))
    .map((j) => ({ ...j, skills: U.parseJSON(j.skills, []) }));
  res.json(c);
});
const applyLimit = U.rateLimiter({ windowMs: 3600000, max: 15, message: 'Too many applications from this network. Try again later.' });
app.post('/api/public/:slug/jobs/:id/apply', applyLimit, async (req, res) => {
  const c = await db.get('SELECT id FROM companies WHERE slug = ?', [req.params.slug]);
  const job = c && await db.get("SELECT * FROM jobs WHERE id = ? AND company_id = ? AND status = 'published'", [req.params.id, c.id]);
  if (!job) throw new HttpError(404, 'This job is not open');
  const { fields, files } = await readMultipart(req);
  const r = await intake(c.id, job, fields, files.resume, 'Careers Page', null);
  res.json({ token: r.token });
});
app.get('/api/status/:token', async (req, res) => {
  const a = await db.get(`SELECT a.id, a.stage, a.created_at, c.name, j.title AS job_title, co.name AS company FROM applications a JOIN candidates c ON c.id = a.candidate_id
    JOIN jobs j ON j.id = a.job_id JOIN companies co ON co.id = a.company_id WHERE a.status_token = ?`, [req.params.token]);
  if (!a) throw new HttpError(404, 'Application not found');
  a.interviews = await db.all("SELECT scheduled_at, type, platform, meeting_link, location, status FROM interviews WHERE application_id = ? AND status = 'scheduled' ORDER BY scheduled_at", [a.id]);
  a.messages = await db.all('SELECT sender_type, subject, body, sent_at FROM messages WHERE application_id = ? ORDER BY sent_at', [a.id]);
  delete a.id;
  res.json(a);
});
app.post('/api/status/:token/messages', async (req, res) => {
  const a = await db.get('SELECT id, company_id FROM applications WHERE status_token = ?', [req.params.token]);
  if (!a) throw new HttpError(404, 'Application not found');
  U.requireFields(req.body, ['body']);
  await db.insert('messages', { application_id: a.id, company_id: a.company_id, sender_type: 'candidate', body: String(req.body.body).slice(0, 4000), channel: 'portal', sent_at: U.nowIso() });
  await notifyCompany(a.company_id, { type: 'message', title: 'New candidate reply', link: `/candidates/${a.id}` });
  res.json({ ok: true });
});

app.get('/api/health', async (req, res) => res.json({ ok: true, database: db.describe, matcher: matcher.getHealth(), ai: !!ai.envConfig() }));
app.use('/api', () => { throw new HttpError(404, 'API route not found'); });
app.use(serveStatic(path.join(__dirname, '..', 'public'), { spa: true }));
app.onError((err, req, res) => {
  if (!err.status || err.status >= 500) console.error(err);
  const status = err.status || (err instanceof ai.AIError ? (err.kind === 'not_configured' ? 400 : 502) : 500);
  if (!res.headersSent) res.status(status).json({ error: err.message || 'Server error' });
});

(async () => {
  sec.loadSecret(DATA_DIR);
  await db.init({ url: process.env.DATABASE_URL, dataDir: DATA_DIR });
  const h = await matcher.detect();
  console.log(h.ok ? `Python matcher ready (${h.command}, Python ${h.python})` : `WARNING: ${h.error}`);
  if (!(await db.get('SELECT id FROM companies LIMIT 1'))) await require('./seed').seed();
  app.listen(PORT, '0.0.0.0', () => console.log(`CareerBridge running on http://localhost:${PORT}  (${db.describe})`));
})().catch((e) => { console.error(e); process.exit(1); });
