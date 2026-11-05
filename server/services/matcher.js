'use strict';
/** Node bridge to the Python resume matcher (matcher/cli.py). */
const { spawn } = require('node:child_process');
const path = require('node:path');

const CLI = path.join(__dirname, '..', '..', 'matcher', 'cli.py');
let python = null; // e.g. ['python3'] or ['py', '-3']
let health = null;

function run(cmd, payload, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd[0], [...cmd.slice(1), CLI], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Resume matcher timed out')); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error((err || `Python exited with code ${code}`).trim().split('\n').slice(-3).join(' ')));
      try { resolve(JSON.parse(out)); } catch { reject(new Error('Resume matcher returned invalid output')); }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

async function detect() {
  const options = process.env.PYTHON_BIN ? [process.env.PYTHON_BIN.split(' ')] : [['python3'], ['python'], ['py', '-3']];
  for (const cmd of options) {
    try {
      const h = await run(cmd, { mode: 'health' }, 15000);
      if (h && h.ok) {
        python = cmd;
        health = { ...h, command: cmd.join(' ') };
        return health;
      }
    } catch { /* try the next one */ }
  }
  health = { ok: false, error: 'Python 3 was not found. Install Python 3 and run: pip install -r requirements.txt' };
  return health;
}

async function call(payload, timeoutMs) {
  if (!python) await detect();
  if (!python) throw new Error(health.error);
  return run(python, payload, timeoutMs);
}

function jobPayload(job) {
  let skills = job.skills;
  if (typeof skills === 'string') { try { skills = JSON.parse(skills); } catch { skills = []; } }
  return {
    title: job.title || '', description: job.description || '', requirements: job.requirements || '',
    skills: Array.isArray(skills) ? skills : [], experience_min: job.experience_min ?? null, experience_max: job.experience_max ?? null,
  };
}

/** items: [{ id, resume_text?, resume_path?, job }] */
async function matchMany(items) {
  if (!items.length) return [];
  const out = await call({ mode: 'match', current_year: new Date().getFullYear(), items: items.map((i) => ({ ...i, job: jobPayload(i.job) })) }, 120000);
  return out.results || [];
}

async function matchOne({ resumeText, resumePath, job }) {
  const [r] = await matchMany([{ id: 1, resume_text: resumeText || '', resume_path: resumePath || null, job }]);
  if (!r || r.error) throw new Error(r ? r.error : 'Matcher returned no result');
  return r;
}

async function extract(filePath) { return (await call({ mode: 'extract', path: filePath }, 60000)).text || ''; }

module.exports = { detect, extract, matchMany, matchOne, getHealth: () => health };
