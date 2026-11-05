"""CareerBridge resume matching logic.

Compares the skills and keywords in a resume with those in a job description
and returns a match score and an ATS score (0-100), plus the details behind
them: matched / missing skills, keyword coverage, detected sections, contact
details, experience and education. Standard library only.
"""

import math
import re
from collections import Counter

from skills import ALIAS_INDEX, CANONICAL_BY_ALIAS, SKILLS

STOPWORDS = set("""
a about above after again against all also am an and any are as at be because been before being below between both but by
can could did do does doing down during each etc few for from further had has have having he her here hers herself him himself
his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves
out over own per same she should so some such than that the their theirs them themselves then there these they this those through
to too under until up very was we were what when where which while who whom why will with within without would you your yours
yourself yourselves using use used via across able ability strong excellent good great well new including include includes
responsible responsibilities requirement requirements required preferred plus must nice role roles position job candidate candidates
looking seeking join company team teams work working worked experience experienced years year yrs month months day days
knowledge understanding skills skill familiarity proven track record ensure ensuring help helping make making build building
built develop developing developed create creating created deliver delivering delivered support supporting provide providing
based within high highly key main various multiple one two three four five etc e.g ie i.e us our we're you'll you'd
""".split())

HEADINGS = {
    "summary": r"(professional\s+)?summary|profile|objective|about\s+me|career\s+summary",
    "experience": r"(work|professional)?\s*experience|employment(\s+history)?|work\s+history|career\s+history",
    "education": r"education|academic(s|\s+background)?|qualifications",
    "skills": r"(technical\s+|core\s+|key\s+)?skills|competencies|technologies|tech\s+stack|expertise",
    "projects": r"projects|selected\s+projects|portfolio",
    "certifications": r"certifications?|licenses|courses",
}

EDU_KEYWORDS = re.compile(
    r"(university|institute|college|school of|iit\b|nit\b|bits\b|polytechnic|academy|universit)", re.I)
DEGREE_WORDS = re.compile(
    r"\b(b\.?\s?tech|m\.?\s?tech|b\.?\s?e\.?|m\.?\s?e\.?|b\.?\s?sc|m\.?\s?sc|bachelor'?s?|master'?s?|mba|ph\.?d|b\.?a\.?|m\.?a\.?|"
    r"b\.?com|m\.?com|bca|mca|diploma|degree|of science|of arts|of engineering|of technology|in computer science|"
    r"in information technology|in [a-z ]+ engineering|cgpa|gpa|honou?rs?)\b", re.I)

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(\+?\d[\d\s().-]{8,}\d)")
LINKEDIN_RE = re.compile(r"((?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/[^\s,;|)]+)", re.I)
GITHUB_RE = re.compile(r"((?:https?://)?(?:www\.)?github\.com/[^\s,;|)]+)", re.I)
URL_RE = re.compile(r"((?:https?://)?(?:www\.)?[a-z0-9-]+\.(?:dev|io|me|design|com|in|net|org|site|app|co)(?:/[^\s,;|)]*)?)", re.I)
YEARS_RE = re.compile(r"(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)", re.I)
RANGE_RE = re.compile(
    r"((?:19|20)\d{2})\s*(?:-|–|—|to)\s*((?:19|20)\d{2}|present|current|now|today)", re.I)
NUMBER_RE = re.compile(r"(\d+%|\$\s?\d|₹\s?\d|\b\d{2,}\b|\b\d+x\b|\b\d+(?:\.\d+)?\s?(?:k|m|million|lakh|crore)\b)", re.I)


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def normalize(text):
    text = (text or "").replace("–", "-").replace("—", "-").replace("•", " ")
    text = text.replace(" ", " ").replace("’", "'")
    return text


def alias_pattern(alias):
    return re.compile(r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9+#])")


_PATTERN_CACHE = {}


def contains_alias(text_lower, alias):
    pat = _PATTERN_CACHE.get(alias)
    if pat is None:
        pat = alias_pattern(alias)
        _PATTERN_CACHE[alias] = pat
    return pat.search(text_lower) is not None


def find_skills(text):
    """Return canonical skills found in text (dictionary based)."""
    low = normalize(text).lower()
    found = []
    seen = set()
    for canonical, alias in ALIAS_INDEX:
        if canonical in seen:
            continue
        if contains_alias(low, alias):
            seen.add(canonical)
            found.append(canonical)
    return found


def aliases_for(skill):
    """Aliases for a recruiter-entered skill name (dictionary aware)."""
    s = skill.strip().lower()
    if not s:
        return []
    canonical = CANONICAL_BY_ALIAS.get(s)
    if canonical is None:
        for c in SKILLS:
            if c.lower() == s:
                canonical = c
                break
    aliases = {s}
    if canonical:
        aliases.add(canonical.lower())
        aliases.update(a.lower() for a in SKILLS[canonical])
    compact = re.sub(r"[\s.\-]", "", s)
    if len(compact) > 2:
        aliases.add(compact)
    return sorted(aliases, key=len, reverse=True)


def tokenize(text):
    low = normalize(text).lower()
    tokens = re.findall(r"[a-z][a-z0-9+#.]*[a-z0-9+#]|[a-z]", low)
    return [t.strip(".") for t in tokens if len(t) > 1 and t not in STOPWORDS]


def term_vector(text):
    toks = tokenize(text)
    terms = Counter(toks)
    for a, b in zip(toks, toks[1:]):
        terms[a + " " + b] += 1
    skill_terms = {alias for _, alias in ALIAS_INDEX}
    vec = {}
    for term, tf in terms.items():
        weight = 1.0 + math.log(tf)
        if term in skill_terms:
            weight *= 2.0
        vec[term] = weight
    return vec


def cosine(a, b):
    if not a or not b:
        return 0.0
    dot = sum(w * b.get(t, 0.0) for t, w in a.items())
    na = math.sqrt(sum(w * w for w in a.values()))
    nb = math.sqrt(sum(w * w for w in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def top_keywords(text, n=25):
    vec = term_vector(text)
    unigrams = [(t, w) for t, w in vec.items() if " " not in t and len(t) > 2]
    unigrams.sort(key=lambda p: (-p[1], p[0]))
    return [t for t, _ in unigrams[:n]]


# ---------------------------------------------------------------------------
# Resume structure
# ---------------------------------------------------------------------------

def detect_sections(text):
    found = {k: False for k in HEADINGS}
    for line in normalize(text).splitlines():
        clean = re.sub(r"[^A-Za-z ]", " ", line).strip()
        if not clean or len(clean) > 40:
            continue
        for key, pattern in HEADINGS.items():
            if re.fullmatch(r"\s*(" + pattern + r")\s*", clean, re.I):
                found[key] = True
    return found


def section_lines(text, key):
    lines = normalize(text).splitlines()
    out, inside = [], False
    for line in lines:
        clean = re.sub(r"[^A-Za-z ]", " ", line).strip()
        is_heading = False
        if clean and len(clean) <= 40:
            for k, pattern in HEADINGS.items():
                if re.fullmatch(r"\s*(" + pattern + r")\s*", clean, re.I):
                    is_heading = True
                    inside = (k == key)
                    break
        if not is_heading and inside and line.strip():
            out.append(line.strip())
    return out


def extract_contact(text):
    t = normalize(text)
    email = EMAIL_RE.search(t)
    phone = None
    for m in PHONE_RE.finditer(t):
        digits = re.sub(r"\D", "", m.group(1))
        if 10 <= len(digits) <= 15 and not re.fullmatch(r"(19|20)\d{2}(19|20)\d{2}", digits[:8]):
            phone = m.group(1).strip()
            break
    linkedin = LINKEDIN_RE.search(t)
    github = GITHUB_RE.search(t)
    portfolio = None
    for m in URL_RE.finditer(t):
        u = m.group(1)
        if "linkedin" in u.lower() or "github" in u.lower() or "@" in u:
            continue
        if email and u in email.group(0):
            continue
        portfolio = u
        break
    return {
        "email": email.group(0) if email else None,
        "phone": phone,
        "linkedin": linkedin.group(1) if linkedin else None,
        "github": github.group(1) if github else None,
        "portfolio": portfolio,
    }


def extract_years(text, current_year):
    t = normalize(text)
    stated = []
    for m in YEARS_RE.finditer(t):
        try:
            v = float(m.group(1))
        except ValueError:
            continue
        window = t[max(0, m.start() - 40): m.end() + 40].lower()
        if 0 < v <= 45 and "experience" in window:
            stated.append(v)
    if stated:
        return round(max(stated), 1)
    starts, ends = [], []
    for m in RANGE_RE.finditer(t):
        start = int(m.group(1))
        end_raw = m.group(2).lower()
        end = current_year if not end_raw[:1].isdigit() else int(end_raw)
        if 1970 <= start <= end <= current_year + 1:
            starts.append(start)
            ends.append(end)
    if starts:
        return float(max(0, min(45, max(ends) - min(starts))))
    return None


def extract_education(text):
    lines = section_lines(text, "education") or normalize(text).splitlines()
    institutions = []
    for line in lines:
        if not EDU_KEYWORDS.search(line):
            continue
        parts = re.split(r"\s*(?:,|\||\(|\)|;| - | — | – )\s*", line)
        for part in parts:
            if EDU_KEYWORDS.search(part):
                name = DEGREE_WORDS.sub("", part)
                name = re.sub(r"\b(19|20)\d{2}\b", "", name)
                name = re.sub(r"^\s*(at|from|in)\s+", "", name, flags=re.I)
                name = re.sub(r"\s{2,}", " ", name).strip(" .:-")
                if 3 <= len(name) <= 80 and name not in institutions:
                    institutions.append(name)
                break
    return institutions[:3]


def headline(text):
    for line in normalize(text).splitlines()[1:6]:
        s = line.strip()
        if s and not EMAIL_RE.search(s.split("|")[0]):
            return s.split("|")[0].strip()
    return ""


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def experience_fit(years, emin, emax):
    if years is None:
        return 0.6
    if emin is None and emax is None:
        return 1.0
    emin = emin or 0
    if years < emin:
        gap = emin - years
        return max(0.0, 1.0 - gap / max(2.0, emin))
    if emax and years > emax + 3:
        return 0.85
    return 1.0


def title_fit(job_title, resume_text):
    jt = [t for t in tokenize(job_title) if t not in {"senior", "junior", "lead", "sr", "jr", "intern", "ii", "iii"}]
    if not jt:
        return 0.5
    head = " ".join(normalize(resume_text).splitlines()[:8]).lower()
    hits = sum(1 for t in jt if re.search(r"(?<![a-z])" + re.escape(t), head))
    return hits / len(jt)


def level_for(score):
    if score >= 80:
        return "High"
    if score >= 60:
        return "Medium"
    return "Low"


def match(resume_text, job, current_year=2026):
    resume_text = normalize(resume_text)
    jd_text = " ".join(filter(None, [
        job.get("title", ""), job.get("title", ""),
        job.get("description", ""), job.get("requirements", ""),
        " ".join(job.get("skills") or []),
    ]))
    low = resume_text.lower()

    required = [s for s in (job.get("skills") or []) if s and s.strip()]
    if not required:
        required = find_skills(jd_text)[:12]
    matched, missing = [], []
    for skill in required:
        if any(contains_alias(low, a) for a in aliases_for(skill)):
            matched.append(skill)
        else:
            missing.append(skill)
    skill_cov = len(matched) / len(required) if required else 0.5

    sim = cosine(term_vector(resume_text), term_vector(jd_text))
    sim_scaled = min(1.0, math.sqrt(sim / 0.32)) if sim > 0 else 0.0

    years = extract_years(resume_text, current_year)
    exp_fit = experience_fit(years, job.get("experience_min"), job.get("experience_max"))
    t_fit = title_fit(job.get("title", ""), resume_text)

    match_score = 100 * (0.50 * skill_cov + 0.25 * sim_scaled + 0.15 * exp_fit + 0.10 * t_fit)

    # ---- ATS score -------------------------------------------------------
    keywords = top_keywords(jd_text, 25)
    kw_present = [k for k in keywords if contains_alias(low, k)]
    kw_cov = len(kw_present) / len(keywords) if keywords else 0.5
    kw_component = min(1.0, 0.6 * kw_cov / 0.6 + 0.4 * skill_cov) if keywords else skill_cov

    sections = detect_sections(resume_text)
    contact = extract_contact(resume_text)
    sections["contact"] = bool(contact["email"] or contact["phone"])
    core = ["contact", "summary", "experience", "education", "skills"]
    sec_score = sum(1 for k in core if sections.get(k)) / len(core)

    lines = [l.strip() for l in resume_text.splitlines() if l.strip()]
    quantified = sum(1 for l in lines if NUMBER_RE.search(l) and not RANGE_RE.search(l) and len(l) > 25)
    quant_score = min(1.0, quantified / 4.0)

    words = len(re.findall(r"\w+", resume_text))
    if 250 <= words <= 1200:
        length_score = 1.0
    elif 150 <= words < 250 or 1200 < words <= 1800:
        length_score = 0.8
    else:
        length_score = 0.5

    contact_score = sum(1 for k in ("email", "phone", "linkedin") if contact[k]) / 3.0
    bullets = sum(1 for l in lines if re.match(r"^[-*•▪●◦]\s", l))
    odd = len(re.findall(r"[^\x09\x0a\x0d\x20-\x7e -ɏ₹–—•’]", resume_text))
    fmt_score = (0.6 if bullets >= 3 else 0.3) + (0.4 if odd < max(5, words * 0.02) else 0.0)

    ats_score = 100 * (0.40 * kw_component + 0.25 * sec_score + 0.10 * quant_score +
                       0.10 * length_score + 0.10 * contact_score + 0.05 * fmt_score)

    match_score = int(round(max(0, min(100, match_score))))
    ats_score = int(round(max(0, min(100, ats_score))))

    return {
        "match_score": match_score,
        "ats_score": ats_score,
        "level": level_for(match_score),
        "ats_level": level_for(ats_score),
        "required_skills": required,
        "matched_skills": matched,
        "missing_skills": missing,
        "skills_found": find_skills(resume_text),
        "keyword_similarity": round(sim, 3),
        "keyword_coverage": round(kw_cov, 3),
        "keywords_matched": kw_present[:15],
        "keywords_missing": [k for k in keywords if k not in kw_present][:10],
        "experience_years": years,
        "education": extract_education(resume_text),
        "contact": contact,
        "headline": headline(resume_text),
        "sections": sections,
        "word_count": words,
        "quantified_lines": quantified,
        "breakdown": {
            "skills": round(skill_cov * 100),
            "keywords": round(sim_scaled * 100),
            "experience": round(exp_fit * 100),
            "title": round(t_fit * 100),
            "ats_keywords": round(kw_component * 100),
            "ats_sections": round(sec_score * 100),
            "ats_quantified": round(quant_score * 100),
            "ats_length": round(length_score * 100),
            "ats_contact": round(contact_score * 100),
            "ats_format": round(fmt_score * 100),
        },
        "weights": {
            "match": "50% required skills, 25% keyword similarity, 15% experience fit, 10% title fit",
            "ats": "40% keywords, 25% sections, 10% quantified results, 10% length, 10% contact details, 5% formatting",
        },
    }
