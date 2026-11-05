'use strict';
/** Student portal + University (placement cell) portal APIs, connected to the employer data. */
const fs = require('node:fs');
const path = require('node:path');

module.exports = function portals(app, { db, sec, ai, matcher, U, HttpError, readMultipart, intake, notifyCompany, SYSTEM, UPLOADS }) {
  async function anyAI() {
    const env = ai.envConfig();
    if (env) return env;
    const c = await db.get('SELECT ai_api_key_enc, ai_provider, ai_model FROM companies WHERE ai_api_key_enc IS NOT NULL LIMIT 1');
    const key = c && sec.decryptSecret(c.ai_api_key_enc);
    return key ? { provider: c.ai_provider || ai.detectProvider(key), key, model: c.ai_model || null } : null;
  }
  function who(req, kind) {
    const p = sec.verifyToken(String(req.get('authorization') || '').replace(/^Bearer\s+/i, ''));
    if (!p || p.kind !== kind) throw new HttpError(401, 'Please sign in');
    return p.uid;
  }
  const S = (fn) => async (req, res) => {
    const id = who(req, 'student');
    req.student = await db.get('SELECT s.*, u.name AS university_name, u.code AS university_code FROM students s LEFT JOIN universities u ON u.id = s.university_id WHERE s.id = ?', [id]);
    if (!req.student) throw new HttpError(401, 'Please sign in');
    return fn(req, res);
  };
  const UNI = (fn) => async (req, res) => {
    const id = who(req, 'uni');
    req.uni = await db.get('SELECT * FROM universities WHERE id = ?', [id]);
    if (!req.uni) throw new HttpError(401, 'Please sign in');
    return fn(req, res);
  };
  const checkImg = (img) => { if (img && (!/^data:image\/(png|jpe?g|webp);base64,/.test(img) || img.length > 400000)) throw new HttpError(400, 'Image must be a PNG/JPG under 300 KB'); return img === '' ? null : img; };
  async function changePw(table, id, b) {
    const row = await db.get(`SELECT password_hash FROM ${table} WHERE id = ?`, [id]);
    if (!sec.verifyPassword(b.current || '', row.password_hash)) throw new HttpError(400, 'Current password is wrong');
    if (String(b.next || '').length < 6) throw new HttpError(400, 'New password must be at least 6 characters');
    await db.update(table, id, { password_hash: sec.hashPassword(b.next) });
  }
  const publicStudent = (s) => {
    const { password_hash, resume_text, ...rest } = s;
    return { ...rest, has_resume: !!resume_text, skills: U.parseJSON(s.skills, []), resume_feedback: U.parseJSON(s.resume_feedback, null) };
  };

  // ======================= STUDENT =======================
  app.post('/api/s/register', async (req, res) => {
    const b = req.body;
    U.requireFields(b, ['name', 'email', 'password']);
    if (!U.isEmail(b.email)) throw new HttpError(400, 'Enter a valid email');
    if (String(b.password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    if (await db.get('SELECT id FROM students WHERE LOWER(email) = ?', [b.email.toLowerCase()])) throw new HttpError(409, 'An account with this email already exists');
    let uni = null;
    if (b.university_code) {
      uni = await db.get('SELECT id FROM universities WHERE UPPER(code) = ?', [String(b.university_code).toUpperCase().trim()]);
      if (!uni) throw new HttpError(400, 'University code not found. Ask your placement cell for the code.');
    }
    const id = await db.insert('students', {
      university_id: uni && uni.id, name: b.name.trim(), email: b.email.toLowerCase().trim(), password_hash: sec.hashPassword(b.password),
      degree: b.degree || null, grad_year: U.toIntOrNull(b.grad_year), avatar_color: U.colorFor(b.name), created_at: U.nowIso(),
    });
    res.json({ token: sec.signToken({ uid: id, kind: 'student' }) });
  });
  app.post('/api/s/login', async (req, res) => {
    const s = await db.get('SELECT * FROM students WHERE LOWER(email) = ?', [String(req.body.email || '').toLowerCase().trim()]);
    if (!s || !sec.verifyPassword(req.body.password || '', s.password_hash)) throw new HttpError(401, 'Wrong email or password');
    res.json({ token: sec.signToken({ uid: s.id, kind: 'student' }) });
  });
  app.get('/api/s/me', S(async (req, res) => res.json(publicStudent(req.student))));
  app.put('/api/s/profile', S(async (req, res) => {
    const b = req.body;
    let uniId;
    if (b.university_code) {
      const u = await db.get('SELECT id FROM universities WHERE UPPER(code) = ?', [String(b.university_code).toUpperCase().trim()]);
      if (!u) throw new HttpError(400, 'University code not found');
      uniId = u.id;
    }
    await db.update('students', req.student.id, { name: b.name, phone: b.phone, degree: b.degree, grad_year: U.toIntOrNull(b.grad_year), location: b.location, linkedin_url: b.linkedin_url, bio: b.bio, university_id: uniId, avatar_url: b.avatar_url !== undefined ? checkImg(b.avatar_url) : undefined });
    res.json({ ok: true });
  }));
  app.post('/api/s/password', S(async (req, res) => { await changePw('students', req.student.id, req.body); res.json({ ok: true }); }));
  app.post('/api/s/resume', S(async (req, res) => {
    const { files } = await readMultipart(req);
    const f = files.resume;
    if (!f) throw new HttpError(400, 'Choose a resume file');
    const ext = path.extname(f.filename || '').toLowerCase();
    if (!['.pdf', '.docx', '.txt'].includes(ext)) throw new HttpError(400, 'Resume must be PDF, DOCX or TXT');
    const name = sec.randomToken(12) + ext;
    fs.writeFileSync(path.join(UPLOADS, name), f.buffer);
    const text = await matcher.extract(path.join(UPLOADS, name));
    if (text.trim().length < 30) throw new HttpError(400, 'Could not read text from this file. Upload a text-based PDF or DOCX.');
    const m = await matcher.matchOne({ resumeText: text, job: { title: '', description: '', skills: [] } });
    await db.update('students', req.student.id, { resume_text: text, resume_file: name, resume_name: f.filename, skills: m.skills_found, resume_feedback: null });
    res.json({ ok: true, skills: m.skills_found });
  }));
  app.post('/api/s/resume/feedback', S(async (req, res) => {
    if (!req.student.resume_text) throw new HttpError(400, 'Upload your resume first');
    const r = await ai.complete(await anyAI(), { system: SYSTEM + ' You are now coaching a student or fresh graduate on their resume.', json: true, prompt: `Review this resume for a student/fresh graduate (${req.student.degree || ''}, graduating ${req.student.grad_year || ''}).
"""${req.student.resume_text.slice(0, 7000)}"""
Return JSON: {"ats_score":0-100,"summary":"2 sentences","strengths":["3 short points"],"improvements":["4 specific, actionable fixes"],"suggested_roles":["3 job titles that fit"],"missing_keywords":["5 keywords worth adding if true"]}` });
    const fb = { ...r.data, model: r.model, at: U.nowIso() };
    await db.update('students', req.student.id, { resume_feedback: fb });
    res.json(fb);
  }));
  app.get('/api/s/jobs', S(async (req, res) => {
    const jobs = await db.all(`SELECT j.id, j.title, j.department, j.location, j.work_mode, j.employment_type, j.experience_min, j.experience_max, j.salary_min, j.salary_max,
      j.description, j.requirements, j.skills, j.created_at, c.name AS company, c.slug FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.status = 'published' ORDER BY j.created_at DESC`);
    const applied = await db.all('SELECT job_id, stage FROM applications WHERE student_id = ?', [req.student.id]);
    let scores = [];
    if (req.student.resume_text) scores = await matcher.matchMany(jobs.map((j) => ({ id: j.id, resume_text: req.student.resume_text, job: j })));
    res.json(jobs.map((j) => {
      const m = scores.find((x) => x.id === j.id);
      const a = applied.find((x) => x.job_id === j.id);
      return { ...j, skills: U.parseJSON(j.skills, []), match: m ? m.match_score : null, missing: m ? m.missing_skills : [], applied_stage: a ? a.stage : null };
    }).sort((x, y) => (y.match ?? -1) - (x.match ?? -1)));
  }));
  app.post('/api/s/jobs/:id/apply', S(async (req, res) => {
    const st = req.student;
    if (!st.resume_text) throw new HttpError(400, 'Upload your resume in "Resume & Profile" before applying');
    const job = await db.get("SELECT * FROM jobs WHERE id = ? AND status = 'published'", [req.params.id]);
    if (!job) throw new HttpError(404, 'This job is no longer open');
    if (await db.get('SELECT id FROM applications WHERE student_id = ? AND job_id = ?', [st.id, job.id])) throw new HttpError(409, 'You already applied to this job');
    const r = await intake(job.company_id, job, { name: st.name, email: st.email, phone: st.phone, location: st.location, linkedin: st.linkedin_url, resume_text: st.resume_text, cover_letter: req.body.cover_letter },
      null, st.university_name ? `Student Portal · ${st.university_name}` : 'Student Portal', null, { student_id: st.id });
    res.json(r);
  }));
  app.get('/api/s/applications', S(async (req, res) => {
    const rows = await db.all(`SELECT a.id, a.stage, a.match_score, a.ats_score, a.created_at, a.status_token, j.title, c.name AS company,
      (SELECT COUNT(*) FROM messages m WHERE m.application_id = a.id AND m.sender_type = 'recruiter') AS recruiter_msgs
      FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = a.company_id WHERE a.student_id = ? ORDER BY a.created_at DESC`, [req.student.id]);
    for (const r of rows) r.next_interview = await db.get("SELECT scheduled_at, type, platform, meeting_link FROM interviews WHERE application_id = ? AND status = 'scheduled' ORDER BY scheduled_at LIMIT 1", [r.id]) || null;
    res.json(rows);
  }));

  // ---- AI mock interview ----
  app.post('/api/s/mock', S(async (req, res) => {
    const role = String(req.body.role || '').trim() || 'Software Engineer';
    const job = req.body.job_id ? await db.get('SELECT title, description, skills FROM jobs WHERE id = ?', [req.body.job_id]) : null;
    const r = await ai.complete(await anyAI(), { system: SYSTEM + ' You are a friendly but rigorous interviewer running a practice interview for a student.', json: true, prompt: `Create a practice interview for the role "${job ? job.title : role}".
${job ? `Job description: ${String(job.description).slice(0, 1500)}\nSkills: ${job.skills}` : ''}
Candidate resume (may be empty): """${String(req.student.resume_text || '').slice(0, 4000)}"""
Return JSON: {"questions":[{"q":"question text","type":"technical|behavioural|hr","tip":"one-line hint"}]} with exactly 5 questions: 2 technical tailored to the role and resume, 2 behavioural, 1 HR.` });
    const qs = (r.data.questions || []).slice(0, 5);
    if (!qs.length) throw new HttpError(502, 'The AI did not return questions. Try again.');
    const id = await db.insert('mock_interviews', { student_id: req.student.id, role: job ? job.title : role, questions: qs, answers: [], status: 'in_progress', created_at: U.nowIso() });
    res.json({ id, role: job ? job.title : role, questions: qs });
  }));
  app.post('/api/s/mock/:id/finish', S(async (req, res) => {
    const mi = await db.get('SELECT * FROM mock_interviews WHERE id = ? AND student_id = ?', [req.params.id, req.student.id]);
    if (!mi) throw new HttpError(404, 'Interview not found');
    const qs = U.parseJSON(mi.questions, []);
    const answers = (req.body.answers || []).map((a) => String(a || '').slice(0, 3000));
    const r = await ai.complete(await anyAI(), { system: SYSTEM + ' You evaluate practice interview answers fairly and give encouraging, specific coaching.', json: true, prompt: `Role: ${mi.role}
${qs.map((q, i) => `Q${i + 1} (${q.type}): ${q.q}\nAnswer: ${answers[i] || '(no answer)'}`).join('\n\n')}
Return JSON: {"overall_score":0-100,"verdict":"one sentence","communication":0-10,"technical":0-10,"confidence":0-10,"per_question":[{"score":0-10,"feedback":"1-2 sentences","better_answer":"a short model answer"}],"top_tips":["3 tips"]}` });
    await db.update('mock_interviews', mi.id, { answers, score: Math.round(r.data.overall_score || 0), feedback: { ...r.data, model: r.model }, status: 'completed' });
    res.json({ ...r.data, model: r.model });
  }));
  app.get('/api/s/mock', S(async (req, res) => {
    res.json((await db.all('SELECT id, role, score, status, created_at, feedback FROM mock_interviews WHERE student_id = ? ORDER BY created_at DESC', [req.student.id]))
      .map((m) => ({ ...m, feedback: U.parseJSON(m.feedback, null) })));
  }));

  // ======================= UNIVERSITY =======================
  app.post('/api/u/register', async (req, res) => {
    const b = req.body;
    U.requireFields(b, ['name', 'code', 'officer_name', 'email', 'password']);
    if (await db.get('SELECT id FROM universities WHERE UPPER(code) = ? OR LOWER(officer_email) = ?', [b.code.toUpperCase(), b.email.toLowerCase()])) throw new HttpError(409, 'That code or email is already registered');
    const id = await db.insert('universities', { name: b.name, code: b.code.toUpperCase().trim(), location: b.location || null, officer_name: b.officer_name, officer_email: b.email.toLowerCase(), password_hash: sec.hashPassword(b.password), created_at: U.nowIso() });
    res.json({ token: sec.signToken({ uid: id, kind: 'uni' }) });
  });
  app.post('/api/u/login', async (req, res) => {
    const u = await db.get('SELECT * FROM universities WHERE LOWER(officer_email) = ?', [String(req.body.email || '').toLowerCase().trim()]);
    if (!u || !sec.verifyPassword(req.body.password || '', u.password_hash)) throw new HttpError(401, 'Wrong email or password');
    res.json({ token: sec.signToken({ uid: u.id, kind: 'uni' }) });
  });
  async function uniData(uniId) {
    const students = await db.all('SELECT id, name, email, degree, grad_year, avatar_color, resume_text IS NOT NULL AS has_resume, created_at FROM students WHERE university_id = ? ORDER BY name', [uniId]);
    const apps = await db.all(`SELECT a.id, a.student_id, a.stage, a.match_score, a.created_at, j.title, c.name AS company FROM applications a JOIN students s ON s.id = a.student_id
      JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = a.company_id WHERE s.university_id = ?`, [uniId]);
    const mocks = await db.all("SELECT m.student_id, m.score FROM mock_interviews m JOIN students s ON s.id = m.student_id WHERE s.university_id = ? AND m.status = 'completed'", [uniId]);
    const rank = { applied: 0, screening: 1, shortlisted: 2, interview: 3, offer: 4, hired: 5, rejected: -1 };
    for (const s of students) {
      const mine = apps.filter((a) => a.student_id === s.id);
      s.applications = mine.length;
      s.best_stage = mine.sort((x, y) => rank[y.stage] - rank[x.stage])[0]?.stage || null;
      const ms = mocks.filter((m) => m.student_id === s.id);
      s.mock_avg = ms.length ? Math.round(ms.reduce((a, m) => a + m.score, 0) / ms.length) : null;
      s.has_resume = !!s.has_resume;
    }
    const studentsWith = (fn) => students.filter(fn).length;
    return {
      students, apps,
      stats: {
        students: students.length, with_resume: studentsWith((s) => s.has_resume), applied: studentsWith((s) => s.applications > 0),
        interviewing: studentsWith((s) => s.best_stage === 'interview'), offers: studentsWith((s) => s.best_stage === 'offer'), placed: studentsWith((s) => s.best_stage === 'hired'),
        applications: apps.length, mock_interviews: mocks.length, mock_avg: mocks.length ? Math.round(mocks.reduce((a, m) => a + m.score, 0) / mocks.length) : null,
      },
    };
  }
  app.get('/api/u/dashboard', UNI(async (req, res) => {
    const d = await uniData(req.uni.id);
    const companies = await db.all(`SELECT c.name, c.slug, c.location, COUNT(j.id) AS open_jobs FROM companies c JOIN jobs j ON j.company_id = c.id AND j.status = 'published' GROUP BY c.id, c.name, c.slug, c.location ORDER BY open_jobs DESC`);
    const { password_hash, ...uni } = req.uni;
    res.json({ university: uni, ...d, companies, recent: d.apps.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 10).map((a) => ({ ...a, student: d.students.find((s) => s.id === a.student_id)?.name })) });
  }));
  app.put('/api/u/profile', UNI(async (req, res) => {
    const b = req.body;
    U.requireFields(b, ['name']);
    await db.update('universities', req.uni.id, { name: b.name, location: b.location, officer_name: b.officer_name, phone: b.phone, website: b.website, logo_url: b.logo_url !== undefined ? checkImg(b.logo_url) : undefined });
    res.json({ ok: true });
  }));
  app.post('/api/u/password', UNI(async (req, res) => { await changePw('universities', req.uni.id, req.body); res.json({ ok: true }); }));
  app.get('/api/u/students/:id', UNI(async (req, res) => {
    const s = await db.get('SELECT * FROM students WHERE id = ? AND university_id = ?', [req.params.id, req.uni.id]);
    if (!s) throw new HttpError(404, 'Student not found');
    const apps = await db.all('SELECT a.stage, a.match_score, a.created_at, j.title, c.name AS company FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = a.company_id WHERE a.student_id = ? ORDER BY a.created_at DESC', [s.id]);
    const mocks = await db.all("SELECT role, score, created_at FROM mock_interviews WHERE student_id = ? AND status = 'completed' ORDER BY created_at DESC", [s.id]);
    res.json({ ...publicStudent(s), applications: apps, mocks });
  }));
  app.post('/api/u/summary', UNI(async (req, res) => {
    const d = await uniData(req.uni.id);
    const r = await ai.complete(await anyAI(), { system: SYSTEM + ' You advise a university placement cell.', json: true, prompt: `Placement data for ${req.uni.name}: ${JSON.stringify({ stats: d.stats, students: d.students.map((s) => ({ degree: s.degree, applications: s.applications, best_stage: s.best_stage, mock_avg: s.mock_avg, has_resume: s.has_resume })) }).slice(0, 5000)}
Return JSON: {"headline":"one sentence","insights":["3 observations"],"actions":["4 concrete actions for the placement cell this week"]}` });
    res.json(r.data);
  }));
};
