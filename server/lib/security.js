'use strict';
/** Password hashing (scrypt), signed tokens (HS256 JWT) and secret encryption (AES-256-GCM). */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

let SECRET = null;

function loadSecret(dataDir) {
  if (process.env.JWT_SECRET) {
    SECRET = process.env.JWT_SECRET;
    return SECRET;
  }
  const file = path.join(dataDir, '.secret');
  try {
    SECRET = fs.readFileSync(file, 'utf8').trim();
  } catch {
    SECRET = crypto.randomBytes(48).toString('hex');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, SECRET, { mode: 0o600 });
  }
  return SECRET;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, saltB64, hashB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const fromB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function signToken(payload, expiresInSec = 60 * 60 * 24 * 7) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSec }));
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest());
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function encryptSecret(plain) {
  if (!plain) return null;
  const key = crypto.createHash('sha256').update('cb-enc:' + SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

function decryptSecret(stored) {
  if (!stored) return null;
  try {
    const [v, ivB64, tagB64, encB64] = String(stored).split(':');
    if (v !== 'v1') return null;
    const key = crypto.createHash('sha256').update('cb-enc:' + SECRET).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

const randomToken = (bytes = 18) => b64url(crypto.randomBytes(bytes));

module.exports = { loadSecret, hashPassword, verifyPassword, signToken, verifyToken, encryptSecret, decryptSecret, randomToken };
