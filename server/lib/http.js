'use strict';
/**
 * A small Express-style HTTP layer built on Node's http module.
 * Same shape as Express (app.use, app.get, Router, req.params, res.json ...)
 * so routes read like ordinary Express code, with zero npm dependencies.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function compilePath(p) {
  const keys = [];
  const pattern = p
    .replace(/\/+$/, '')
    .replace(/[.+*?^${}()|[\]\\]/g, (c) => (c === ':' ? c : '\\' + c))
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k) => {
      keys.push(k);
      return '([^/]+)';
    });
  return { regex: new RegExp('^' + pattern + '/?$'), keys };
}

/** Runs one handler. Resolves true when it called next(), false when it handled the request. */
function runHandler(fn, req, res) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const next = (err) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(true);
    };
    try {
      const out = fn(req, res, next);
      if (out && typeof out.then === 'function') {
        out.then(
          () => { if (!settled) { settled = true; resolve(false); } },
          (e) => { if (!settled) { settled = true; reject(e); } },
        );
      } else if (!settled) {
        settled = true;
        resolve(false);
      }
    } catch (e) {
      if (!settled) { settled = true; reject(e); }
    }
  });
}

class Router {
  constructor() {
    this.stack = [];
    for (const m of METHODS) {
      this[m] = (p, ...handlers) => this.route(m.toUpperCase(), p, handlers);
    }
  }

  use(prefixOrFn, ...fns) {
    let prefix = '';
    let list = fns;
    if (typeof prefixOrFn === 'string') prefix = prefixOrFn.replace(/\/+$/, '');
    else list = [prefixOrFn, ...fns];
    for (const fn of list) this.stack.push({ prefix, fn });
    return this;
  }

  route(method, p, handlers) {
    const { regex, keys } = compilePath(p);
    this.stack.push({ method, regex, keys, handlers });
    return this;
  }

  /** Returns true when the request was handled. */
  async handle(req, res, pathname) {
    for (const layer of this.stack) {
      if (res.writableEnded) return true;
      if (layer.fn) {
        if (layer.prefix && !(pathname === layer.prefix || pathname.startsWith(layer.prefix + '/'))) continue;
        const sub = layer.prefix ? pathname.slice(layer.prefix.length) || '/' : pathname;
        if (layer.fn instanceof Router) {
          if (await layer.fn.handle(req, res, sub)) return true;
          continue;
        }
        const proceed = await runHandler(layer.fn, req, res);
        if (!proceed) return true;
        continue;
      }
      if (layer.method !== req.method && !(layer.method === 'GET' && req.method === 'HEAD')) continue;
      const m = layer.regex.exec(pathname);
      if (!m) continue;
      req.params = {};
      layer.keys.forEach((k, i) => {
        try { req.params[k] = decodeURIComponent(m[i + 1]); } catch { req.params[k] = m[i + 1]; }
      });
      let all = true;
      for (const h of layer.handlers) {
        const proceed = await runHandler(h, req, res);
        if (!proceed) { all = false; break; }
      }
      if (!all) return true;
    }
    return false;
  }
}

function sendBody(req, res, body, type) {
  if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', type);
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const accepts = String(req.headers['accept-encoding'] || '');
  if (buf.length > 1024 && /\bgzip\b/.test(accepts) && !res.getHeader('Content-Encoding')) {
    buf = zlib.gzipSync(buf, { level: 6 });
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
  }
  res.setHeader('Content-Length', buf.length);
  if (req.method === 'HEAD') return res.end();
  res.end(buf);
}

function decorate(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = url.pathname;
  try { pathname = decodeURI(pathname); } catch { /* keep raw */ }
  req.path = pathname;
  req.query = Object.fromEntries(url.searchParams);
  req.ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  req.get = (h) => req.headers[String(h).toLowerCase()];
  res.status = (code) => { res.statusCode = code; return res; };
  res.set = (k, v) => { res.setHeader(k, v); return res; };
  res.json = (obj) => sendBody(req, res, JSON.stringify(obj), 'application/json; charset=utf-8');
  res.send = (body, type = 'text/plain; charset=utf-8') => sendBody(req, res, body, type);
  res.redirect = (to, code = 302) => { res.statusCode = code; res.setHeader('Location', to); res.end(); };
}

function createApp() {
  const router = new Router();
  let errorHandler = null;
  const app = async (req, res) => {
    decorate(req, res);
    try {
      const handled = await router.handle(req, res, req.path);
      if (!handled && !res.writableEnded) throw new HttpError(404, 'Not found');
    } catch (err) {
      if (errorHandler) return errorHandler(err, req, res);
      res.status(err.status || 500).json({ error: err.message || 'Server error' });
    }
  };
  app.use = (...a) => { router.use(...a); return app; };
  for (const m of METHODS) app[m] = (...a) => { router[m](...a); return app; };
  app.onError = (fn) => { errorHandler = fn; return app; };
  app.listen = (port, host, cb) => {
    const server = http.createServer(app);
    server.listen(port, host, cb);
    return server;
  };
  return app;
}

/** Reads the raw request body up to `limit` bytes. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, `Upload too large (max ${Math.round(limit / 1024 / 1024)} MB)`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** JSON body parser middleware. */
function json({ limit = 1024 * 1024 } = {}) {
  return async (req, res, next) => {
    const type = String(req.headers['content-type'] || '');
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || !type.includes('application/json')) {
      req.body = req.body || {};
      return next();
    }
    const raw = await readBody(req, limit);
    try {
      req.body = raw.length ? JSON.parse(raw.toString('utf8')) : {};
    } catch {
      throw new HttpError(400, 'Invalid JSON body');
    }
    next();
  };
}

/**
 * Parses multipart/form-data using the WHATWG Request/FormData built into Node.
 * Returns { fields, files: { name: { filename, type, buffer } } }.
 */
async function readMultipart(req, { limit = 6 * 1024 * 1024 } = {}) {
  const type = String(req.headers['content-type'] || '');
  if (!type.includes('multipart/form-data')) throw new HttpError(400, 'Expected multipart/form-data');
  const raw = await readBody(req, limit);
  const form = await new Request('http://local/upload', {
    method: 'POST',
    headers: { 'content-type': type },
    body: raw,
  }).formData();
  const fields = {};
  const files = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') fields[key] = value;
    else if (value && value.size > 0) {
      files[key] = { filename: value.name, type: value.type, buffer: Buffer.from(await value.arrayBuffer()) };
    }
  }
  return { fields, files };
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.map': 'application/json',
};

/** Static file middleware with in-memory gzip cache and optional SPA fallback. */
function serveStatic(root, { spa = false, maxAge = 0 } = {}) {
  const cache = new Map();
  const absRoot = path.resolve(root);
  const load = (file) => {
    const stat = fs.statSync(file);
    const hit = cache.get(file);
    if (hit && hit.mtime === stat.mtimeMs) return hit;
    const raw = fs.readFileSync(file);
    const ext = path.extname(file).toLowerCase();
    const compressible = /\.(html|js|css|json|svg|txt|map)$/.test(ext);
    const entry = { mtime: stat.mtimeMs, raw, gz: compressible && raw.length > 1024 ? zlib.gzipSync(raw, { level: 9 }) : null, type: MIME[ext] || 'application/octet-stream' };
    cache.set(file, entry);
    return entry;
  };
  const send = (req, res, file, cacheControl) => {
    const entry = load(file);
    res.setHeader('Content-Type', entry.type);
    res.setHeader('Cache-Control', cacheControl);
    const useGz = entry.gz && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
    const body = useGz ? entry.gz : entry.raw;
    if (useGz) { res.setHeader('Content-Encoding', 'gzip'); res.setHeader('Vary', 'Accept-Encoding'); }
    res.setHeader('Content-Length', body.length);
    if (req.method === 'HEAD') return res.end();
    res.end(body);
  };
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const rel = path.normalize(req.path).replace(/^([/\\])+/, '');
    const file = path.join(absRoot, rel);
    if (!file.startsWith(absRoot)) return next();
    try {
      if (rel && fs.statSync(file).isFile()) {
        const immutable = /[.-][A-Za-z0-9]{8,}\.(js|css|woff2|png|svg)$/.test(file);
        return send(req, res, file, immutable ? 'public, max-age=31536000, immutable' : `public, max-age=${maxAge}`);
      }
    } catch { /* not a file */ }
    if (spa && !req.path.startsWith('/api/') && !path.extname(req.path)) {
      const index = path.join(absRoot, 'index.html');
      if (fs.existsSync(index)) return send(req, res, index, 'no-cache');
    }
    return next();
  };
}

const asyncRoute = (fn) => fn; // handlers may be async; errors are caught by the router

module.exports = { createApp, Router, HttpError, json, readMultipart, serveStatic, asyncRoute };
