/* CareerBridge UI layer: brand logo, original illustrations, motion, profile & settings for every portal, camera check */

// ---------------------------------------------------------------- brand
// Original mark: a bridge arch forming an open book, with a graduation tassel
const BRAND = (size = 40, inv = false) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-label="CareerBridge">
 <rect width="64" height="64" rx="16" fill="${inv ? '#fff' : '#000'}"/>
 <g fill="none" stroke="${inv ? '#000' : '#fff'}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 44 C20 26, 44 26, 52 44"/><path d="M12 44v6M52 44v6M22 36v14M32 33v17M42 36v14"/><path d="M8 50h48"/>
 </g>
 <path d="M32 9 L48 16 L32 23 L16 16 Z" fill="${inv ? '#000' : '#fff'}"/><path d="M44 18v7" stroke="${inv ? '#000' : '#fff'}" stroke-width="2.5" stroke-linecap="round"/>
 <circle cx="44" cy="26.5" r="2.4" fill="${inv ? '#000' : '#fff'}"/></svg>`;

// Original flat illustrations (monochrome)
const ART = {
  study: `<svg viewBox="0 0 320 260" class="art-svg"><circle cx="160" cy="130" r="118" fill="#f1f1f1"/><circle cx="252" cy="58" r="30" fill="#e4e4e4"/>
   <rect x="86" y="168" width="150" height="10" rx="5" fill="#111"/><rect x="104" y="112" width="96" height="58" rx="8" fill="#111" class="float"/><rect x="112" y="120" width="80" height="42" rx="4" fill="#fff"/>
   <path d="M120 150l14-12 12 8 18-18 16 10" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
   <circle cx="240" cy="132" r="17" fill="#111"/><path d="M226 150c-12 8-14 24-14 34h56c0-10-2-26-14-34" fill="#111"/><path d="M222 126c4-14 30-14 36 0" fill="#fff" stroke="#111" stroke-width="4"/>
   <path d="M228 114l12-6 12 6-12 6z" fill="#111"/><rect x="204" y="166" width="28" height="6" rx="3" fill="#fff"/>
   <g class="spark"><path d="M70 70l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#111"/><path d="M268 196l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#111"/></g></svg>`,
  ai: `<svg viewBox="0 0 320 260" class="art-svg"><circle cx="160" cy="130" r="118" fill="#f1f1f1"/>
   <rect x="70" y="60" width="132" height="160" rx="12" fill="#fff" stroke="#111" stroke-width="5"/><circle cx="104" cy="96" r="14" fill="#111"/>
   <rect x="126" y="88" width="56" height="7" rx="3.5" fill="#111"/><rect x="126" y="101" width="36" height="6" rx="3" fill="#bdbdbd"/>
   <rect x="88" y="130" width="96" height="6" rx="3" fill="#d6d6d6"/><rect x="88" y="146" width="80" height="6" rx="3" fill="#d6d6d6"/><rect x="88" y="162" width="90" height="6" rx="3" fill="#d6d6d6"/>
   <rect x="88" y="186" width="44" height="14" rx="7" fill="#111"/>
   <g class="float"><circle cx="228" cy="150" r="46" fill="#111"/><circle cx="228" cy="150" r="32" fill="none" stroke="#444" stroke-width="8"/>
   <circle cx="228" cy="150" r="32" fill="none" stroke="#fff" stroke-width="8" stroke-dasharray="160 201" transform="rotate(-90 228 150)"/>
   <text x="228" y="157" text-anchor="middle" font-family="Inter,Arial" font-weight="800" font-size="20" fill="#fff">92%</text></g>
   <path class="spark" d="M250 74l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#111"/></svg>`,
  mic: `<svg viewBox="0 0 320 260" class="art-svg"><circle cx="160" cy="130" r="118" fill="#f1f1f1"/>
   <rect x="64" y="70" width="150" height="104" rx="12" fill="#111"/><circle cx="139" cy="112" r="20" fill="#fff"/><path d="M107 168c4-24 60-24 64 0" fill="#fff"/>
   <circle cx="200" cy="82" r="5" fill="#fff" class="blink"/><rect x="118" y="174" width="42" height="18" fill="#111"/><rect x="98" y="190" width="82" height="8" rx="4" fill="#111"/>
   <g class="float"><rect x="214" y="104" width="62" height="84" rx="14" fill="#fff" stroke="#111" stroke-width="5"/>
   <rect x="234" y="118" width="22" height="36" rx="11" fill="#111"/><path d="M226 146c0 22 38 22 38 0M245 168v10" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/></g>
   <g fill="#111" class="wave"><rect x="40" y="120" width="6" height="20" rx="3"/><rect x="50" y="112" width="6" height="36" rx="3"/><rect x="284" y="114" width="6" height="32" rx="3"/><rect x="294" y="122" width="6" height="16" rx="3"/></g></svg>`,
};
const artCss = document.createElement('style');
artCss.textContent = `
.art-svg{width:100%;max-width:300px;height:auto}.art-svg .float{animation:fl 3.2s ease-in-out infinite}.art-svg .spark{animation:sp 2.4s ease-in-out infinite;transform-origin:center}
.art-svg .blink{animation:blink 1.2s infinite}.art-svg .wave rect{animation:wv 1s ease-in-out infinite;transform-origin:center;transform-box:fill-box}.art-svg .wave rect:nth-child(2){animation-delay:.2s}.art-svg .wave rect:nth-child(3){animation-delay:.4s}
@keyframes fl{50%{transform:translateY(-8px)}}@keyframes sp{50%{opacity:.3;transform:scale(.85)}}@keyframes wv{50%{transform:scaleY(.4)}}
#onb .art{width:100%;max-width:320px;height:auto;background:none;margin:0 auto 28px;border-radius:0;display:block}#onb .art svg.art-svg{width:100%!important;height:auto!important;max-width:320px}
.page>*{animation:rise .45s cubic-bezier(.2,.8,.2,1) both}.page>*:nth-child(2){animation-delay:.04s}.page>*:nth-child(3){animation-delay:.08s}.page>*:nth-child(4){animation-delay:.12s}.page>*:nth-child(5){animation-delay:.16s}.page>*:nth-child(n+6){animation-delay:.2s}
.grid>.card{animation:rise .45s cubic-bezier(.2,.8,.2,1) both}.grid>.card:nth-child(2){animation-delay:.05s}.grid>.card:nth-child(3){animation-delay:.1s}.grid>.card:nth-child(4){animation-delay:.15s}.grid>.card:nth-child(n+5){animation-delay:.2s}
@keyframes rise{from{opacity:0;transform:translateY(12px)}}
.card:hover{transform:translateY(-2px);box-shadow:0 10px 30px #00000012}.card{transition:transform .2s,box-shadow .2s}
.nav{transition:background .15s,padding .15s}.nav:hover{padding-left:16px}.bar>i{transition:width 1s cubic-bezier(.2,.8,.2,1)}
.pill{transition:transform .15s}.pill:hover{transform:scale(1.05)}tr.click td{transition:background .15s}
.photo{position:relative;width:96px;height:96px;border-radius:50%;overflow:hidden;cursor:pointer;flex:none}.photo .av{width:96px!important;height:96px!important;font-size:34px!important}
.photo:after{content:'Change';position:absolute;inset:auto 0 0 0;background:#000a;color:#fff;font-size:11px;text-align:center;padding:5px 0;opacity:0;transition:opacity .2s}.photo:hover:after{opacity:1}
.tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:16px;overflow-x:auto}.tabs a{padding:10px 14px;border-bottom:2px solid transparent;color:#777;font-weight:600;cursor:pointer;white-space:nowrap}.tabs a.on{color:#000;border-color:#000}
.switch{position:relative;width:42px;height:24px;flex:none}.switch input{opacity:0;width:0;height:0}.switch span{position:absolute;inset:0;background:#d4d4d4;border-radius:12px;transition:.2s;cursor:pointer}.switch span:before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}.switch input:checked+span{background:#000}.switch input:checked+span:before{transform:translateX(18px)}
.cam{position:relative;background:#000;border-radius:16px;overflow:hidden;aspect-ratio:4/3}.cam video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
.cam .lbl{position:absolute;left:10px;top:10px;background:#000a;color:#fff;font-size:11px;padding:4px 9px;border-radius:20px;display:flex;gap:6px;align-items:center}.cam .rec{width:7px;height:7px;border-radius:50%;background:#fff;animation:blink 1s infinite}
.meter{height:8px;background:#e5e5e5;border-radius:4px;overflow:hidden}.meter i{display:block;height:100%;width:0;background:#000;transition:width .08s}
.selfview{position:fixed;right:16px;bottom:96px;width:150px;z-index:30;box-shadow:0 10px 30px #0004;border:3px solid #fff}
.check{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #eee}.check .dot{width:22px;height:22px;border-radius:50%;border:2px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:12px;flex:none}.check.ok .dot{background:#000;border-color:#000;color:#fff}
@media(min-width:901px){.selfview{bottom:24px;width:200px}}`;
document.head.appendChild(artCss);

// replace logos everywhere
const brandFix = () => {
  document.querySelectorAll('.brand:not([data-b])').forEach((el) => {
    el.dataset.b = 1; const first = el.querySelector('span'); if (first && first.querySelector('svg')) first.remove();
    el.insertAdjacentHTML('afterbegin', `<span style="display:inline-flex;margin-right:10px">${BRAND(36)}</span>`); el.style.display = 'flex'; el.style.alignItems = 'center';
  });
  const sl = document.querySelector('#splash .logo'); if (sl && !sl.dataset.b) { sl.dataset.b = 1; sl.style.background = 'none'; sl.innerHTML = BRAND(96, true); }
  document.querySelectorAll('.login .l h1').forEach((h) => { if (!h.dataset.b) { h.dataset.b = 1; h.insertAdjacentHTML('beforebegin', `<div style="margin-bottom:18px">${BRAND(56, true)}</div>`); } });
  document.querySelectorAll('#onb .sl .art').forEach((a, i) => { if (!a.dataset.b) { a.dataset.b = 1; a.innerHTML = [ART.study, ART.ai, ART.mic][i] || ''; } });
};
// animated counters
const countUp = () => document.querySelectorAll('.big:not([data-c])').forEach((el) => {
  el.dataset.c = 1; const m = el.textContent.match(/^(\D*)(\d[\d,]*)(.*)$/s); if (!m) return;
  const target = +m[2].replace(/,/g, ''); if (!target || target > 100000) return; const t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / 700); el.textContent = m[1] + Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString() + m[3]; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
});
const bars = () => document.querySelectorAll('.bar>i:not([data-a])').forEach((b) => { b.dataset.a = 1; const w = b.style.width; b.style.width = '0'; requestAnimationFrame(() => requestAnimationFrame(() => { b.style.width = w; })); });
let _fx = 0; new MutationObserver(() => { if (_fx) return; _fx = requestAnimationFrame(() => { _fx = 0; brandFix(); countUp(); bars(); }); }).observe(document.body, { childList: true, subtree: true });

// ---------------------------------------------------------------- photo picker
function pickImage(cb, size = 220) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return; const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); const s = Math.min(img.width, img.height); c.width = c.height = size;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); cb(c.toDataURL('image/jpeg', 0.85)); };
    img.src = URL.createObjectURL(f);
  };
  inp.click();
}
const toggleRow = (key, label, desc) => { const on = localStorage.getItem('pref_' + key) !== '0';
  return `<div class="row between" style="padding:12px 0;border-bottom:1px solid #eee"><div><b>${label}</b><div class="small mut">${desc}</div></div><label class="switch"><input type="checkbox" ${on ? 'checked' : ''} onchange="localStorage.setItem('pref_${key}',this.checked?'1':'0');toast('Saved')"><span></span></label></div>`; };
const pwForm = (id) => `<form id="${id}" class="card"><h3 style="margin-top:0">Change password</h3><label>Current password</label><input class="in" type="password" name="current" required><label>New password</label><input class="in" type="password" name="next" minlength="6" required><label>Confirm new password</label><input class="in" type="password" name="confirm" minlength="6" required><button class="btn pri" style="margin-top:12px">Update password</button></form>`;
function bindPw(id, url, caller) { setTimeout(() => { const f = $('#' + id); if (!f) return; f.onsubmit = (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(f)); if (b.next !== b.confirm) return toast('New passwords do not match', 1); busy(e.submitter, async () => { await caller(url, { method: 'POST', body: b }); f.reset(); toast('Password updated'); }); }; }); }
const tabsBar = (base, tabs, cur) => `<div class="tabs">${tabs.map(([k, l]) => `<a data-go href="${base}?tab=${k}" class="${cur === k ? 'on' : ''}">${l}</a>`).join('')}</div>`;
const prefsCard = () => `<div class="card"><h3 style="margin-top:0">Notifications & preferences</h3>${toggleRow('notif', 'In-app notifications', 'Alerts for new activity')}${toggleRow('email', 'Email updates', 'Weekly summary to your inbox')}${toggleRow('motion', 'Animations', 'Smooth transitions across the app')}${toggleRow('sound', 'Interviewer voice', 'AI interviewer reads questions aloud')}</div>`;

// ---------------------------------------------------------------- EMPLOYER profile (override)
pages['/profile'] = async () => {
  const tab = new URLSearchParams(location.search).get('tab') || 'profile'; const u = ME.user;
  window._newImg = undefined;
  setTimeout(() => {
    const f = $('#pf'); if (f) f.onsubmit = (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(f)); if (window._newImg !== undefined) b.avatar_url = window._newImg;
      busy(e.submitter, async () => { await api('/me', { method: 'PUT', body: b }); ME = null; toast('Profile updated'); render(); }); };
    bindPw('pw', '/me/password', api);
  });
  return `<h1>My Profile</h1><p class="sub">Manage how you appear to your team and candidates.</p>${tabsBar('/profile', [['profile', 'Profile'], ['security', 'Security'], ['prefs', 'Preferences']], tab)}
  ${tab === 'profile' ? `<form id="pf" class="card" style="max-width:640px"><div class="row" style="gap:18px;margin-bottom:10px"><div class="photo" id="ph" onclick="pickImage(d=>{window._newImg=d;$('#ph').innerHTML=av('',0,96,d)})">${av(u.name, 0, 96, u.avatar_url)}</div>
   <div><b style="font-size:18px">${esc(u.name)}</b><div class="small mut">${esc(u.email)} · ${esc(u.role)}</div><div class="row" style="margin-top:8px"><button type="button" class="btn small" onclick="pickImage(d=>{window._newImg=d;$('#ph').innerHTML=av('',0,96,d)})">Upload photo</button><button type="button" class="btn small" onclick="window._newImg='';$('#ph').innerHTML=av('${esc(u.name)}',0,96)">Remove</button></div></div></div>
   <div class="grid g2"><div><label>Full name</label><input class="in" name="name" value="${esc(u.name)}" required></div><div><label>Job title</label><input class="in" name="title" value="${esc(u.title || '')}"></div><div><label>Phone</label><input class="in" name="phone" value="${esc(u.phone || '')}"></div><div><label>Email</label><input class="in" value="${esc(u.email)}" disabled></div></div>
   <button class="btn pri" style="margin-top:14px">Save changes</button></form>` : tab === 'security' ? `<div style="max-width:640px">${pwForm('pw')}<p class="small mut">Forgot a password? An admin can reset it from Recruiters.</p></div>` : `<div style="max-width:640px">${prefsCard()}</div>`}`;
};

// ---------------------------------------------------------------- STUDENT profile (override with photo, tabs, password)
const _studentProfile = sp['/student/profile'];
sp['/student/profile'] = async (me) => {
  const tab = new URLSearchParams(location.search).get('tab') || 'resume';
  if (tab === 'resume') return `${tabsBar('/student/profile', [['resume', 'Resume & Profile'], ['account', 'Photo & Account'], ['prefs', 'Preferences']], tab)}${await _studentProfile(me)}`;
  window._newImg = undefined;
  setTimeout(() => {
    const f = $('#sa'); if (f) f.onsubmit = (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(f)); if (window._newImg !== undefined) b.avatar_url = window._newImg;
      busy(e.submitter, async () => { await P.call('s', '/profile', { method: 'PUT', body: b }); toast('Profile updated'); render(); }); };
    bindPw('spw', '/password', (u, o) => P.call('s', u, o));
  });
  return `<h1>Account</h1><p class="sub">Your photo, bio and security.</p>${tabsBar('/student/profile', [['resume', 'Resume & Profile'], ['account', 'Photo & Account'], ['prefs', 'Preferences']], tab)}
  ${tab === 'account' ? `<div class="grid g2"><form id="sa" class="card"><div class="row" style="gap:18px;margin-bottom:8px"><div class="photo" id="ph" onclick="pickImage(d=>{window._newImg=d;$('#ph').innerHTML=av('',0,96,d)})">${av(me.name, 0, 96, me.avatar_url)}</div>
    <div><b style="font-size:18px">${esc(me.name)}</b><div class="small mut">${esc(me.email)}</div><button type="button" class="btn small" style="margin-top:8px" onclick="pickImage(d=>{window._newImg=d;$('#ph').innerHTML=av('',0,96,d)})">Upload photo</button></div></div>
    <input type="hidden" name="name" value="${esc(me.name)}"><label>About me</label><textarea class="in" name="bio" rows="4" placeholder="A short intro recruiters will see">${esc(me.bio || '')}</textarea><button class="btn pri" style="margin-top:12px">Save</button></form>${pwForm('spw')}</div>` : `<div style="max-width:640px">${prefsCard()}</div>`}`;
};

// ---------------------------------------------------------------- UNIVERSITY settings (new)
UNAV.push(['/university/settings', 'set', 'Settings']);
up['/university/settings'] = async (d) => {
  const u = d.university; const tab = new URLSearchParams(location.search).get('tab') || 'profile'; window._newImg = undefined;
  setTimeout(() => {
    const f = $('#uf'); if (f) f.onsubmit = (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(f)); if (window._newImg !== undefined) b.logo_url = window._newImg;
      busy(e.submitter, async () => { await P.call('u', '/profile', { method: 'PUT', body: b }); toast('Saved'); render(); }); };
    bindPw('upw', '/password', (x, o) => P.call('u', x, o));
  });
  return `<h1>Settings</h1><p class="sub">Your university profile, placement officer details and security.</p>${tabsBar('/university/settings', [['profile', 'University profile'], ['security', 'Security'], ['prefs', 'Preferences']], tab)}
  ${tab === 'profile' ? `<form id="uf" class="card" style="max-width:720px"><div class="row" style="gap:18px;margin-bottom:10px"><div class="photo" id="ph" style="border-radius:20px" onclick="pickImage(d=>{window._newImg=d;$('#ph').innerHTML=av('',0,96,d)})">${av(u.name, 0, 96, u.logo_url)}</div>
   <div><b style="font-size:18px">${esc(u.name)}</b><div class="small mut">Student code <b>${esc(u.code)}</b> · share it with students</div><button type="button" class="btn small" style="margin-top:8px" onclick="pickImage(d=>{window._newImg=d;$('#ph').innerHTML=av('',0,96,d)})">Upload logo</button>
   <button type="button" class="btn small" style="margin-top:8px" onclick="navigator.clipboard?.writeText('${esc(u.code)}');toast('Code copied')">Copy code</button></div></div>
   <div class="grid g2"><div><label>University name</label><input class="in" name="name" value="${esc(u.name)}" required></div><div><label>Location</label><input class="in" name="location" value="${esc(u.location || '')}"></div>
   <div><label>Placement officer</label><input class="in" name="officer_name" value="${esc(u.officer_name || '')}"></div><div><label>Phone</label><input class="in" name="phone" value="${esc(u.phone || '')}"></div>
   <div><label>Website</label><input class="in" name="website" value="${esc(u.website || '')}"></div><div><label>Login email</label><input class="in" value="${esc(u.officer_email)}" disabled></div></div><button class="btn pri" style="margin-top:14px">Save changes</button></form>`
   : tab === 'security' ? `<div style="max-width:640px">${pwForm('upw')}</div>` : `<div style="max-width:640px">${prefsCard()}</div>`}`;
};

// ---------------------------------------------------------------- AI mock interview: camera + mic check
let CAM = null;
function stopCam() { if (CAM) { CAM.getTracks().forEach((t) => t.stop()); CAM = null; } document.querySelectorAll('.selfview').forEach((e) => e.remove()); }
const _mockPage = sp['/student/interview'];
sp['/student/interview'] = async (me) => {
  if (MOCK) return _mockPage(me);
  stopCam();
  const html = await _mockPage(me);
  return html.replace('<button class="btn pri" onclick="mockStart(this)">🎤 Start interview</button>', `<div class="card" style="background:#fafafa;margin:12px 0"><b>Device check</b><p class="small mut" style="margin:4px 0 10px">The AI interview runs like a real one — camera and microphone on.</p>
    <div class="cam" id="camBox"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#888">Camera preview</div></div>
    <div class="check" id="ckCam"><span class="dot"></span><span>Camera</span></div><div class="check" id="ckMic"><span class="dot"></span><span style="flex:1">Microphone <div class="meter" style="margin-top:6px"><i id="lvl"></i></div></span></div>
    <div class="check" id="ckNet"><span class="dot"></span><span>Connection</span></div><button class="btn" style="margin-top:12px" onclick="camCheck(this)">Check camera & mic</button></div>
    <button class="btn pri" onclick="startWithCam(this)">Start interview</button>`);
};
async function camCheck(btn) {
  const ok = (id, good, txt) => { const el = $(id); if (!el) return; el.classList.toggle('ok', good); el.querySelector('.dot').textContent = good ? '✓' : '!'; if (txt) el.querySelector('span:last-child').firstChild.textContent = txt; };
  ok('#ckNet', navigator.onLine);
  try {
    stopCam(); CAM = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
    $('#camBox').innerHTML = '<video autoplay playsinline muted></video><span class="lbl"><i class="rec"></i>Live</span>'; $('#camBox video').srcObject = CAM;
    ok('#ckCam', CAM.getVideoTracks().length > 0, 'Camera — ' + (CAM.getVideoTracks()[0]?.label || 'ready'));
    const ac = new (window.AudioContext || window.webkitAudioContext)(); const an = ac.createAnalyser(); ac.createMediaStreamSource(CAM).connect(an); const data = new Uint8Array(an.fftSize);
    let heard = false; const loop = () => { if (!CAM || !$('#lvl')) return ac.close(); an.getByteTimeDomainData(data); let peak = 0; for (const v of data) peak = Math.max(peak, Math.abs(v - 128)); const pct = Math.min(100, peak * 2.2);
      $('#lvl').style.width = pct + '%'; if (pct > 18 && !heard) { heard = true; ok('#ckMic', true, 'Microphone — we can hear you'); } requestAnimationFrame(loop); };
    loop(); ok('#ckMic', true, 'Microphone — say something to test'); if (btn) btn.textContent = '✓ Devices ready';
    return true;
  } catch (e) {
    ok('#ckCam', false, 'Camera — permission blocked or not found'); ok('#ckMic', false, 'Microphone — permission blocked');
    toast('Allow camera and microphone in your browser settings to run the full interview. You can still type answers.', 1); return false;
  }
}
async function startWithCam(btn) { if (!CAM) await camCheck(); mockStart(btn); }
const _mockQ = mockQuestion;
mockQuestion = function () {
  const html = _mockQ();
  setTimeout(() => { if (CAM && !document.querySelector('.selfview')) { const d = document.createElement('div'); d.className = 'cam selfview'; d.innerHTML = '<video autoplay playsinline muted></video><span class="lbl"><i class="rec"></i>You</span>'; document.body.appendChild(d); d.querySelector('video').srcObject = CAM; } });
  if (localStorage.getItem('pref_sound') === '0') setTimeout(() => speechSynthesis?.cancel(), 50);
  return html;
};
const _mockRes = mockResult;
mockResult = function () { stopCam(); return _mockRes(); };
window.addEventListener('popstate', () => { if (!location.pathname.startsWith('/student/interview')) stopCam(); });
const _go = go; go = function (p) { if (!p.startsWith('/student/interview')) stopCam(); _go(p); };
if (localStorage.getItem('pref_motion') === '0') { const st = document.createElement('style'); st.textContent = '*{animation:none!important;transition:none!important}'; document.head.appendChild(st); }
