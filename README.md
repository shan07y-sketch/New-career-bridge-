# CareerBridge – Recruitment Management Portal

Employer portal for fair, skill-based hiring (Leo Club of Hopeville · Community Connect · ORIGEN).

**Modules:** Dashboard (funnel, hiring goal, today's interviews) · Jobs (post, edit, AI job description, AI salary insights, export) · Candidates (ranked by AI match, resume upload) · Candidate Details (AI Resume Insights, ATS score, strengths/growth areas, skill match, move stage) · Interviews (5-step scheduling, auto Jitsi links, evaluations, .ics export) · Messaging (AI drafts) · Analytics (AI summary) · Reports (CSV) · Company Profile · Recruiters · Notifications · Settings · public Careers page · candidate Status page (stage tracker + replies).

**Stack:** Node.js REST API (Express-style router, no npm installs needed) · SQLite built in, or MySQL via `DATABASE_URL` · Python resume matcher (`matcher/`) · LLM via a free Gemini or Groq key.

Demo login: `sarah.jenkins@example.com` / `demo1234`

## Run on your laptop
Needs Node.js 22.13+ and Python 3.
```
pip install -r requirements.txt
node server/index.js
```
Open http://localhost:8080

## Free AI key (2 minutes)
- Groq: https://console.groq.com/keys (starts with `gsk_`) – generous free limits, fastest
- Google Gemini: https://aistudio.google.com/apikey (starts with `AIza`)

Paste it in the app: **Settings → AI provider → Save key → Test connection**, or set `GROQ_API_KEY` / `GEMINI_API_KEY` as an environment variable on the host.

## Host it free on Render (recommended for today)
1. Create a GitHub repo and upload this folder (drag-and-drop works on github.com → Add file → Upload files).
2. Go to https://render.com → sign in with GitHub → **New → Web Service** → pick the repo.
3. Runtime: **Docker** (it uses the included `Dockerfile`). Instance type: **Free**.
4. Environment → add `GROQ_API_KEY` (or `GEMINI_API_KEY`). Click **Deploy**. You get `https://<name>.onrender.com`.

Note: the free instance sleeps after 15 minutes without traffic (first visit then takes ~1 minute) and the SQLite data resets to the demo data when it wakes. Keep a logged-in tab open during your demo (the app polls) or use Railway below.

## Alternative: Railway (no sleeping, $5 free trial, no card)
https://railway.com → New Project → Deploy from GitHub repo (uses the Dockerfile) → Variables: `GROQ_API_KEY` → Settings → Networking → Generate Domain.
Optional real MySQL: add **MySQL** to the project and set `DATABASE_URL=${{MySQL.MYSQL_URL}}` on the app.

## How the scores work
- **Match score** = 50% required skills, 25% keyword similarity, 15% experience fit, 10% title fit (Python, `matcher/matcher.py`).
- **ATS score** = keywords, sections, quantified results, length, contact details, formatting.
- The LLM writes the summary, strengths, growth areas, interview questions and salary estimates. Scores support the recruiter's decision; they do not replace it.
