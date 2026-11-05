'use strict';
const { HttpError } = require('./http');

const STAGES = ['applied', 'screening', 'shortlisted', 'interview', 'offer', 'hired'];
const STAGE_LABELS = {
  applied: 'Applied', screening: 'Screening', shortlisted: 'Shortlisted', interview: 'Interview',
  offer: 'Offer', hired: 'Hired', rejected: 'Rejected', withdrawn: 'Withdrawn',
};
const ALL_STAGES = [...STAGES, 'rejected', 'withdrawn'];
const JOB_STATUSES = ['published', 'draft', 'paused', 'closed', 'archived'];

const nowIso = () => new Date().toISOString();
const daysAgo = (n, from = Date.now()) => new Date(from - n * 86400000).toISOString();

function parseJSON(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60) || 'company';
}

const AVATAR_COLORS = ['#1f5f4a', '#8a6d3b', '#3b6e8a', '#7a4b6b', '#4b6b3b', '#a0522d', '#2f4f6f', '#6b5b95', '#5f7f3f', '#8b4a4a'];
const colorFor = (s) => {
  let h = 0;
  for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || String(body[f]).trim() === '');
  if (missing.length) throw new HttpError(400, `Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
}

const clampInt = (v, min, max, dflt) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dflt;
  return Math.max(min, Math.min(max, n));
};

const toIntOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
};

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());

/** Lower-cased search term safe for `LOWER(col) LIKE ?` on both SQLite and MySQL */
const likeTerm = (s) => `%${String(s).toLowerCase().replace(/[\\%_]/g, '').trim()}%`;

/** In-memory fixed-window rate limiter */
function rateLimiter({ windowMs, max, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip + ':' + (req.baseKey || req.path);
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
      return next();
    }
    entry.count += 1;
    if (entry.count > max) throw new HttpError(429, message || 'Too many requests, please try again later.');
    next();
  };
}

module.exports = {
  STAGES, STAGE_LABELS, ALL_STAGES, JOB_STATUSES, nowIso, daysAgo, parseJSON, slugify, colorFor,
  requireFields, clampInt, toIntOrNull, isEmail, likeTerm, rateLimiter,
};
