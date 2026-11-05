/* CareerBridge – Student portal and University (placement cell) portal */
const P = {
  tok: (k) => localStorage.getItem(k),
  async call(kind, path, opts = {}) {
    const t = P.tok(kind === 's' ? 'cb_stoken' : 'cb_utoken');
    const isForm = opts.body instanceof FormData;
    const res = await fetch(`/api/${kind}${path}`, { ...opts, headers: { ...(opts.body && !isForm ? { 'content-type': 'application/json' } : {}), ...(t ? { authorization: 'Bearer ' + t } : {}) },
      body: opts.body && !isForm ? JSON.stringify(opts.body) : opts.body });
    const d = await res.json().catch(() => ({}));
    if (res.status === 401 && !/login|register/.test(path)) { localStorage.removeItem(kind === 's' ? 'cb_stoken' : 'cb_utoken'); go(kind === 's' ? '/student/login' : '/university/login'); throw new Error('Please sign in'); }
    if (!res.ok) throw new Error(d.error || 'Request failed');
    return d;
  },
};
const roleTabs = (on) => `<div class="row" style="gap:6px;margin-bottom:16px">${[['/login', 'Employer'], ['/student/login', 'Student'], ['/university/login', 'University']].map(([h, l]) => `<a data-go href="${h}" class="btn ${on === l ? 'pri' : ''}" style="flex:1;text-align:center">${l}</a>`).join('')}</div>`;

function portalLogin(kind) {
  const isS = kind === 's';
  const demo = isS ? ['student@example.com', 'demo1234'] : ['placement@srm.example.com', 'demo1234'];
  root.innerHTML = `<div class="login"><div class="l"><h1 style="color:#fff;font-size:40px">CareerBridge ${isS ? 'for Students' : 'for Universities'}</h1>
  <p style="font-size:18px;line-height:1.6">${isS ? 'Build your profile once, see your AI match for every job, apply in one click, practise with an AI mock interview and track every application.' : 'Follow every student from resume to offer: who has applied, who is interviewing, mock-interview readiness and AI placement insights.'}</p></div>
  <div class="r"><div class="card" style="width:400px">${roleTabs(isS ? 'Student' : 'University')}<h2 style="margin-top:0">Sign in</h2>
  <form id="lf"><label>Email</label><input class="in" name="email" value="${demo[0]}"><label>Password</label><input class="in" type="password" name="password" value="${demo[1]}"><button class="btn pri" style="width:100%;margin-top:14px">Sign in</button></form>
  <p class="small mut">Demo: ${demo[0]} / ${demo[1]}</p><details><summary class="small" style="cursor:pointer">${isS ? 'Create a student account' : 'Register your university'}</summary><form id="rf">
  ${isS ? `<label>Full name</label><input class="in" name="name" required><label>Email</label><input class="in" type="email" name="email" required><label>Password</label><input class="in" type="password" name="password" minlength="6" required>
   <div class="grid g2"><div><label>Degree</label><input class="in" name="degree" placeholder="B.Tech IT"></div><div><label>Graduation year</label><input class="in" name="grad_year" placeholder="2027"></div></div><label>University code (from your placement cell)</label><input class="in" name="university_code" placeholder="e.g. SRMRMP">`
   : `<label>University name</label><input class="in" name="name" required><label>Short code students will use</label><input class="in" name="code" required placeholder="e.g. SRMRMP"><label>Location</label><input class="in" name="location"><label>Officer name</label><input class="in" name="officer_name" required><label>Email</label><input class="in" type="email" name="email" required><label>Password</label><input class="in" type="password" name="password" minlength="6" required>`}
  <button class="btn" style="width:100%;margin-top:12px">Create account</button></form></details></div></div></div>`;
  const done = (r) => { localStorage.setItem(isS ? 'cb_stoken' : 'cb_utoken', r.token); go(isS ? '/student' : '/university'); };
  $('#lf').onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => done(await P.call(kind, '/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }))); };
  $('#rf').onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => done(await P.call(kind, '/register', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }))); };
}

function pShell(kind, nav, active, user, body) {
  return `<div class="app"><aside class="side"><div class="brand">CareerBridge<small>${kind === 's' ? 'Student Portal' : 'University Portal'}</small></div><div style="height:18px"></div>
  ${nav.map(([h, i, l]) => `<a data-go href="${h}" class="nav ${active === h ? 'on' : ''}">${I(i)}${l}</a>`).join('')}
  <div style="height:12px"></div><a class="nav" style="color:var(--red)" onclick="localStorage.removeItem('${kind === 's' ? 'cb_stoken' : 'cb_utoken'}');go('${kind === 's' ? '/student/login' : '/university/login'}')">${I('out')} Log Out</a></aside>
  <div class="shade" onclick="toggleMenu(false)"></div><div class="main"><div class="top"><button id="menuBtn" onclick="toggleMenu()" aria-label="Menu">☰</button><b style="display:flex;gap:8px;align-items:center">${I('logo')}${kind === 's' ? 'Student' : 'Placement Cell'}</b><div style="flex:1"></div>
  <button id="installBtn" class="btn pri small" onclick="installApp()">⬇ Install app</button><a class="row"><div style="text-align:right"><b>${esc(user.name)}</b><div class="small mut">${esc(user.sub || '')}</div></div>${av(user.name, user.color || '#0a0a0a', 36)}</a></div>
  <div class="page">${body}</div></div>${bnav(nav, active)}</div>`;
}

// ============================ STUDENT ============================
const SNAV = [['/student', 'home', 'Home'], ['/student/jobs', 'jobs', 'Jobs'], ['/student/applications', 'list', 'Applied'], ['/student/interview', 'mic', 'AI Interview'], ['/student/profile', 'user', 'Profile']];
const sp = {};
sp['/student'] = async (me) => {
  const [apps, jobs, mocks] = await Promise.all([P.call('s', '/applications'), P.call('s', '/jobs'), P.call('s', '/mock')]);
  const next = apps.map((a) => a.next_interview && { ...a.next_interview, title: a.title, company: a.company }).filter(Boolean).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];
  const steps = [['Upload resume', me.has_resume, '/student/profile'], ['Get AI resume feedback', !!me.resume_feedback, '/student/profile'], ['Apply to a job', apps.length > 0, '/student/jobs'], ['Practise an AI interview', mocks.some((m) => m.status === 'completed'), '/student/interview']];
  return `<h1>Hi ${esc(me.name.split(' ')[0])} 👋</h1><p class="sub">${esc(me.degree || '')}${me.university_name ? ' · ' + esc(me.university_name) : ' · Not linked to a university yet'}</p>
  <div class="grid g4">${[['Applications', apps.length], ['Interviews', apps.filter((a) => a.stage === 'interview').length], ['Offers', apps.filter((a) => ['offer', 'hired'].includes(a.stage)).length], ['Best mock score', mocks.filter((m) => m.score != null).reduce((a, m) => Math.max(a, m.score), 0) || '—']].map(([k, v]) => `<div class="card"><div class="k">${k}</div><div class="big">${v}</div></div>`).join('')}</div>
  <div class="grid g21" style="margin-top:16px"><div class="card"><h3 style="margin-top:0">Top job matches for you</h3>${me.has_resume ? jobs.slice(0, 4).map((j) => `<div class="row between" style="padding:10px 0;border-bottom:1px solid #ededed"><div><b>${esc(j.title)}</b><div class="small mut">${esc(j.company)} · ${esc(j.location || '')}</div></div><div class="row"><b>${j.match ?? '—'}%</b>${j.applied_stage ? pill(j.applied_stage) : `<a data-go href="/student/jobs" class="btn small pri">View</a>`}</div></div>`).join('') : '<p class="mut">Upload your resume to see your AI match for every job.</p><a data-go href="/student/profile" class="btn pri">Upload resume</a>'}</div>
  <div class="grid" style="align-content:start">${next ? `<div class="card dark"><b>📅 Upcoming interview</b><p>${esc(next.type)} — ${esc(next.title)} at ${esc(next.company)}<br>${fmtDT(next.scheduled_at)} · ${esc(next.platform)}</p>${next.meeting_link ? `<a class="btn" target="_blank" href="${esc(next.meeting_link)}">Join meeting</a>` : ''}</div>` : ''}
  <div class="card"><h3 style="margin-top:0">Your checklist</h3>${steps.map(([l, ok, h]) => `<a data-go href="${h}" class="row" style="padding:6px 0">${ok ? '✅' : '⚪'} ${l}</a>`).join('')}</div></div></div>`;
};
sp['/student/jobs'] = async (me) => {
  const jobs = await P.call('s', '/jobs'); window._sj = jobs;
  return `<h1>Find Jobs</h1><p class="sub">${me.has_resume ? 'Sorted by your AI match — based on your resume skills.' : 'Upload your resume to see your match % for every job.'}</p>
  <input class="in" placeholder="Search title, company or skill…" oninput="document.querySelectorAll('[data-job]').forEach(el=>el.style.display=el.dataset.job.includes(this.value.toLowerCase())?'':'none')" style="margin-bottom:12px">
  ${jobs.map((j) => `<div class="card" style="margin-bottom:12px" data-job="${esc((j.title + ' ' + j.company + ' ' + j.skills.join(' ')).toLowerCase())}"><div class="row between wrap"><div><h3 style="margin:0">${esc(j.title)}</h3><div class="small mut">${esc(j.company)} · ${esc(j.location || '')} · ${esc(j.work_mode || '')} · ${j.experience_min ?? 0}–${j.experience_max ?? '?'} yrs · ${money(j.salary_min)}–${money(j.salary_max)}</div></div>
  <div class="row">${j.match != null ? `<div style="text-align:center"><div class="big" style="font-size:22px;margin:0">${j.match}%</div><div class="small mut">your match</div></div>` : ''}${j.applied_stage ? pill(j.applied_stage) : `<button class="btn pri" onclick="sApply(${j.id},this)">Apply</button>`}</div></div>
  <div style="margin-top:8px">${j.skills.map((s) => `<span class="chip ${j.missing.includes(s) ? 'no' : j.match != null ? 'ok' : ''}">${esc(s)}</span>`).join('')}</div>${j.missing.length && j.match != null ? `<p class="small mut">Skills to build for this role: ${esc(j.missing.join(', '))}</p>` : ''}
  <details><summary class="small" style="cursor:pointer">Job description</summary><p style="white-space:pre-wrap">${esc(j.description || '')}\n\n${esc(j.requirements || '')}</p><button class="btn small" onclick="go('/student/interview?job=${j.id}')">🎤 Practise an AI interview for this job</button></details></div>`).join('') || '<p class="mut">No open jobs right now.</p>'}`;
};
function sApply(id, b) { busy(b, async () => { const r = await P.call('s', `/jobs/${id}/apply`, { method: 'POST', body: {} }); toast(`Applied! Match ${r.match_score}% · ATS ${r.ats_score}% — the recruiter can see it now`); render(); }); }
sp['/student/applications'] = async () => {
  const apps = await P.call('s', '/applications'); const ST = ['applied', 'screening', 'shortlisted', 'interview', 'offer'];
  return `<h1>My Applications</h1><p class="sub">Live status from each company's hiring team.</p>${apps.map((a) => { const idx = ST.indexOf(a.stage === 'hired' ? 'offer' : a.stage);
    return `<div class="card" style="margin-bottom:12px"><div class="row between wrap"><div><h3 style="margin:0">${esc(a.title)}</h3><div class="small mut">${esc(a.company)} · applied ${fmtDate(a.created_at)} · match ${a.match_score}%</div></div>${pill(a.stage)}</div>
    ${a.stage === 'rejected' ? '<p class="small mut">This application is closed. Keep going — check your other matches.</p>' : `<div class="row" style="gap:4px;margin:14px 0">${ST.map((s, i) => `<div style="flex:1;text-align:center"><div style="height:7px;border-radius:4px;background:${i <= idx ? 'var(--g9)' : 'var(--line)'}"></div><div class="small" style="margin-top:4px">${cap(s)}</div></div>`).join('')}</div>`}
    ${a.next_interview ? `<div class="card dark" style="padding:12px"><b>📅 ${esc(a.next_interview.type)}</b> · ${fmtDT(a.next_interview.scheduled_at)} · ${esc(a.next_interview.platform)} ${a.next_interview.meeting_link ? `<a class="btn small" target="_blank" href="${esc(a.next_interview.meeting_link)}">Join</a>` : ''}</div>` : ''}
    <div class="row" style="margin-top:10px"><a class="btn" href="/status/${a.status_token}" target="_blank">💬 Messages${a.recruiter_msgs ? ` (${a.recruiter_msgs})` : ''}</a></div></div>`; }).join('') || '<p class="mut">No applications yet. <a data-go href="/student/jobs"><b>Find jobs →</b></a></p>'}`;
};
let MOCK = null;
sp['/student/interview'] = async () => {
  const [jobs, past] = await Promise.all([P.call('s', '/jobs'), P.call('s', '/mock')]); const pre = new URLSearchParams(location.search).get('job');
  if (MOCK && MOCK.result) return mockResult();
  if (MOCK) return mockQuestion();
  return `<h1>AI Mock Interview</h1><p class="sub">Practise with an AI interviewer. Answer by typing or by speaking 🎙️, then get scored feedback on every answer.</p>
  <div class="grid g21"><div class="card"><h3 style="margin-top:0">Start a practice interview</h3><label>Practise for a job</label><select class="in" id="mj"><option value="">— or type a role below —</option>${jobs.map((j) => `<option value="${j.id}" ${pre == j.id ? 'selected' : ''}>${esc(j.title)} · ${esc(j.company)}</option>`).join('')}</select>
  <label>Role</label><input class="in" id="mr" placeholder="e.g. Data Analyst"><p class="small mut">5 questions: 2 technical (tailored to your resume), 2 behavioural, 1 HR.</p><button class="btn pri" onclick="mockStart(this)">🎤 Start interview</button></div>
  <div class="card"><h3 style="margin-top:0">Past interviews</h3>${past.map((m) => `<div class="row between" style="padding:8px 0;border-bottom:1px solid #ededed"><div><b>${esc(m.role)}</b><div class="small mut">${fmtDate(m.created_at)}</div></div><b>${m.score != null ? m.score + '/100' : '—'}</b></div>`).join('') || '<p class="mut">None yet.</p>'}</div></div>`;
};
function mockStart(b) { busy(b, async () => { MOCK = await P.call('s', '/mock', { method: 'POST', body: { job_id: $('#mj').value || null, role: $('#mr').value } }); MOCK.i = 0; MOCK.answers = []; render(); }); }
function mockQuestion() {
  const q = MOCK.questions[MOCK.i];
  setTimeout(() => { if ('speechSynthesis' in window) { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(q.q)); } });
  return `<h1>AI Mock Interview</h1><p class="sub">${esc(MOCK.role)} · Question ${MOCK.i + 1} of ${MOCK.questions.length}</p><div class="bar" style="margin-bottom:16px"><i style="width:${(MOCK.i) / MOCK.questions.length * 100}%"></i></div>
  <div class="card dark"><div class="k" style="color:#bdbdbd">${esc(q.type)} question · the interviewer reads it aloud</div><h2 style="margin:8px 0">${esc(q.q)}</h2><p class="small" style="opacity:.75">💡 ${esc(q.tip || '')}</p></div>
  <div class="card" style="margin-top:14px"><textarea class="in" id="ma" rows="7" placeholder="Type your answer, or press 🎙️ and speak…">${esc(MOCK.answers[MOCK.i] || '')}</textarea>
  <div class="row wrap" style="margin-top:10px"><button class="btn" id="mic" onclick="mockMic(this)">🎙️ Speak answer</button><div style="flex:1"></div>${MOCK.i > 0 ? '<button class="btn" onclick="mockNav(-1)">← Back</button>' : ''}
  ${MOCK.i < MOCK.questions.length - 1 ? '<button class="btn pri" onclick="mockNav(1)">Next question →</button>' : '<button class="btn pri" onclick="mockFinish(this)">✓ Finish & get AI feedback</button>'}<button class="btn" onclick="MOCK=null;speechSynthesis?.cancel();render()">Quit</button></div></div>`;
}
function mockNav(d) { MOCK.answers[MOCK.i] = $('#ma').value; MOCK.i += d; render(); }
function mockMic(b) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return toast('Voice input works in Chrome / Android. You can type your answer instead.', 1);
  const r = new SR(); r.lang = 'en-IN'; r.continuous = true; r.interimResults = false; const base = $('#ma').value;
  let txt = ''; r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript + ' '; $('#ma').value = (base + ' ' + txt).trim(); };
  r.onend = () => { b.textContent = '🎙️ Speak answer'; b.onclick = () => mockMic(b); };
  r.start(); b.textContent = '⏹ Stop'; b.onclick = () => r.stop();
}
function mockFinish(b) { MOCK.answers[MOCK.i] = $('#ma').value; busy(b, async () => { MOCK.result = await P.call('s', `/mock/${MOCK.id}/finish`, { method: 'POST', body: { answers: MOCK.answers } }); render(); }); }
function mockResult() {
  const r = MOCK.result;
  return `<h1>Interview feedback</h1><p class="sub">${esc(MOCK.role)} · scored by ${esc(r.model || 'AI')}</p><div class="grid g4">${[['Overall', r.overall_score + '/100'], ['Communication', r.communication + '/10'], ['Technical', r.technical + '/10'], ['Confidence', r.confidence + '/10']].map(([k, v]) => `<div class="card"><div class="k">${k}</div><div class="big">${v}</div></div>`).join('')}</div>
  <div class="card dark" style="margin-top:14px"><b>${esc(r.verdict)}</b><ul>${(r.top_tips || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
  ${MOCK.questions.map((q, i) => { const f = (r.per_question || [])[i] || {}; return `<div class="card" style="margin-top:12px"><div class="row between"><b>Q${i + 1}. ${esc(q.q)}</b><span class="pill">${f.score ?? '—'}/10</span></div><p class="small mut">Your answer: ${esc(MOCK.answers[i] || '(no answer)')}</p><p>${esc(f.feedback || '')}</p>${f.better_answer ? `<p class="small" style="background:#f4f4f4;padding:10px;border-radius:8px"><b>Stronger answer:</b> ${esc(f.better_answer)}</p>` : ''}</div>`; }).join('')}
  <div class="row" style="margin-top:14px"><button class="btn pri" onclick="MOCK=null;render()">Practise again</button><a data-go href="/student/jobs" class="btn" onclick="MOCK=null">Find jobs</a></div>`;
}
sp['/student/profile'] = async (me) => {
  const fb = me.resume_feedback;
  setTimeout(() => {
    $('#pf').onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => { await P.call('s', '/profile', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); toast('Profile saved'); render(); }); };
    $('#rf2').onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => { const r = await P.call('s', '/resume', { method: 'POST', body: new FormData(e.target) }); toast(`Resume read — ${r.skills.length} skills found`); render(); }); };
  });
  return `<h1>Resume & Profile</h1><p class="sub">Your resume is reused for every application — apply in one click.</p><div class="grid g2">
  <div class="grid" style="align-content:start"><form id="rf2" class="card"><h3 style="margin-top:0">📄 Resume</h3>${me.has_resume ? `<p>✅ ${esc(me.resume_name || 'Resume on file')}</p><div>${me.skills.map((s) => `<span class="chip ok">${esc(s)}</span>`).join('')}</div>` : '<p class="mut">No resume yet.</p>'}
   <label>Upload ${me.has_resume ? 'a new ' : ''}resume (PDF, DOCX or TXT)</label><input class="in" type="file" name="resume" accept=".pdf,.docx,.txt" required><button class="btn pri" style="margin-top:10px">Upload</button></form>
   <div class="card dark"><div class="row between"><b>✦ AI Resume Feedback</b><button class="btn small" onclick="busy(this,async()=>{await P.call('s','/resume/feedback',{method:'POST'});render()})">${fb ? '↻ Re-check' : 'Check my resume'}</button></div>
   ${fb ? `<div class="row" style="margin:12px 0"><div style="font-size:42px;font-weight:800">${fb.ats_score}%</div><div class="small">ATS readiness<br>${esc(fb.summary)}</div></div><div class="k" style="color:#bdbdbd">Strengths</div>${(fb.strengths || []).map((s) => `<div>✓ ${esc(s)}</div>`).join('')}
   <div class="k" style="color:#bdbdbd;margin-top:10px">Improve</div>${(fb.improvements || []).map((s) => `<div style="margin:4px 0">➜ ${esc(s)}</div>`).join('')}<div class="k" style="color:#bdbdbd;margin-top:10px">Roles that fit you</div><p>${esc((fb.suggested_roles || []).join(' · '))}</p>` : '<p class="small">Get an ATS score and specific fixes for your resume.</p>'}</div></div>
  <form id="pf" class="card"><h3 style="margin-top:0">Profile</h3><label>Full name</label><input class="in" name="name" value="${esc(me.name)}"><label>Phone</label><input class="in" name="phone" value="${esc(me.phone || '')}">
  <div class="grid g2"><div><label>Degree</label><input class="in" name="degree" value="${esc(me.degree || '')}"></div><div><label>Graduation year</label><input class="in" name="grad_year" value="${esc(me.grad_year || '')}"></div></div>
  <label>City</label><input class="in" name="location" value="${esc(me.location || '')}"><label>LinkedIn</label><input class="in" name="linkedin_url" value="${esc(me.linkedin_url || '')}">
  <label>University code</label><input class="in" name="university_code" placeholder="${esc(me.university_code || 'e.g. SRMRMP')}"><p class="small mut">${me.university_name ? 'Linked to ' + esc(me.university_name) : 'Link your university so your placement cell can support you.'}</p><button class="btn pri">Save profile</button></form></div>`;
};
async function studentRender(p) {
  if (p === '/student/login' || !P.tok('cb_stoken')) return portalLogin('s');
  const me = await P.call('s', '/me');
  const body = await (sp[p] || sp['/student'])(me);
  root.innerHTML = pShell('s', SNAV, sp[p] ? p : '/student', { name: me.name, sub: me.university_name || 'Student', color: me.avatar_color }, body);
}

// ============================ UNIVERSITY ============================
const UNAV = [['/university', 'dash', 'Dashboard'], ['/university/students', 'cap', 'Students'], ['/university/companies', 'co', 'Companies']];
const up = {};
up['/university'] = async (d) => {
  const s = d.stats; const fun = [['Registered', s.students], ['Resume uploaded', s.with_resume], ['Applied', s.applied], ['Interviewing', s.interviewing], ['Offers', s.offers], ['Placed', s.placed]];
  const max = Math.max(1, s.students);
  return `<div class="row between wrap"><div><h1>Placement Dashboard</h1><p class="sub">${esc(d.university.name)} · student code <b>${esc(d.university.code)}</b> (share with students)</p></div><button class="btn pri" onclick="uSummary(this)">✦ AI placement summary</button></div><div id="uai"></div>
  <div class="grid g4">${[['Students', s.students], ['Applications', s.applications], ['Offers + placed', s.offers + s.placed], ['Avg mock interview', s.mock_avg != null ? s.mock_avg + '/100' : '—']].map(([k, v]) => `<div class="card"><div class="k">${k}</div><div class="big">${v}</div></div>`).join('')}</div>
  <div class="grid g2" style="margin-top:16px"><div class="card"><b>Placement funnel</b>${fun.map(([k, v]) => `<div class="row" style="margin:8px 0"><span class="small" style="width:130px">${k}</span><div class="bar" style="flex:1;height:14px"><i style="width:${v / max * 100}%"></i></div><b style="width:28px">${v}</b></div>`).join('')}</div>
  <div class="card"><b>Recent student activity</b>${d.recent.map((a) => `<div class="row between" style="padding:8px 0;border-bottom:1px solid #ededed"><div><b>${esc(a.student)}</b><div class="small mut">${esc(a.title)} · ${esc(a.company)}</div></div>${pill(a.stage)}</div>`).join('') || '<p class="mut">No applications yet.</p>'}</div></div>`;
};
function uSummary(b) { busy(b, async () => { const r = await P.call('u', '/summary', { method: 'POST' }); $('#uai').innerHTML = `<div class="card dark" style="margin-bottom:16px"><b>✦ ${esc(r.headline)}</b><ul>${(r.insights || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul><div class="k" style="color:#bdbdbd">Actions this week</div><ul>${(r.actions || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`; }); }
up['/university/students'] = async (d) => `<h1>Students</h1><p class="sub">Every student linked with code <b>${esc(d.university.code)}</b>.</p><div class="card" style="padding:6px"><table><tr><th>Student</th><th>Degree</th><th>Resume</th><th>Applications</th><th>Best stage</th><th>Mock interview</th></tr>
  ${d.students.map((s) => `<tr class="click" onclick="uStudent(${s.id})"><td><div class="row">${av(s.name, s.avatar_color, 28)}<div><b>${esc(s.name)}</b><div class="small mut">${esc(s.email)}</div></div></div></td><td class="small">${esc(s.degree || '')} ${s.grad_year || ''}</td><td>${s.has_resume ? '✅' : '⚪'}</td><td>${s.applications}</td><td>${s.best_stage ? pill(s.best_stage) : '<span class="mut small">not applied</span>'}</td><td>${s.mock_avg != null ? s.mock_avg + '/100' : '—'}</td></tr>`).join('') || '<tr><td colspan=6 class="mut">No students yet — share the code.</td></tr>'}</table></div>`;
async function uStudent(id) {
  const s = await P.call('u', '/students/' + id);
  modal(`<div class="row">${av(s.name, s.avatar_color, 48)}<div><h2 style="margin:0">${esc(s.name)}</h2><div class="small mut">${esc(s.email)} · ${esc(s.degree || '')} ${s.grad_year || ''}</div></div></div>
  <h3>Skills</h3><div>${s.skills.map((x) => `<span class="chip">${esc(x)}</span>`).join('') || '<span class="mut">No resume yet</span>'}</div>${s.resume_feedback ? `<p class="small">AI resume readiness: <b>${s.resume_feedback.ats_score}%</b></p>` : ''}
  <h3>Applications</h3>${s.applications.map((a) => `<div class="row between" style="padding:6px 0"><span>${esc(a.title)} · <span class="mut">${esc(a.company)}</span></span>${pill(a.stage)}</div>`).join('') || '<p class="mut">None yet.</p>'}
  <h3>AI mock interviews</h3>${s.mocks.map((m) => `<div class="row between"><span>${esc(m.role)} · ${fmtDate(m.created_at)}</span><b>${m.score}/100</b></div>`).join('') || '<p class="mut">None yet.</p>'}<button class="btn" style="margin-top:12px" onclick="this.closest('.modal').remove()">Close</button>`);
}
up['/university/companies'] = async (d) => `<h1>Hiring Companies</h1><p class="sub">Organisations hiring on CareerBridge right now.</p><div class="grid g3">${d.companies.map((c) => `<div class="card"><h3 style="margin-top:0">${esc(c.name)}</h3><p class="small mut">${esc(c.location || '')}</p><div class="big" style="font-size:24px">${c.open_jobs}</div><div class="small mut">open jobs · ${d.apps.filter((a) => a.company === c.name).length} applications from your students</div><a class="btn" target="_blank" href="/careers/${c.slug}" style="display:inline-block;margin-top:10px">View careers page</a></div>`).join('')}</div>`;
async function uniRender(p) {
  if (p === '/university/login' || !P.tok('cb_utoken')) return portalLogin('u');
  const d = await P.call('u', '/dashboard');
  const body = await (up[p] || up['/university'])(d);
  root.innerHTML = pShell('u', UNAV, up[p] ? p : '/university', { name: d.university.officer_name || 'Placement Officer', sub: d.university.code }, body);
}
