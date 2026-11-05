'use strict';
/**
 * Database access for CareerBridge.
 *  - MySQL when DATABASE_URL starts with mysql:// (uses the mysql2 package)
 *  - SQLite otherwise (Node's built-in node:sqlite, zero setup)
 * Both expose the same async API: all / get / run / insert / update / tx.
 */
const fs = require('node:fs');
const path = require('node:path');
const { TABLES, createTableDDL, indexDDL, columnDDL } = require('./schema');

const norm = (params = []) => params.map((v) => {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (v !== null && typeof v === 'object' && !Buffer.isBuffer(v)) return JSON.stringify(v);
  return v;
});

function sqliteAdapter(file) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch {
    throw new Error('This Node.js version has no built-in SQLite. Install Node.js 22.13+ (or set DATABASE_URL to a MySQL database).');
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const cache = new Map();
  const prep = (sql) => {
    let s = cache.get(sql);
    if (!s) {
      s = db.prepare(sql);
      cache.set(sql, s);
    }
    return s;
  };
  return {
    dialect: 'sqlite',
    describe: `SQLite (${path.basename(file)})`,
    async all(sql, params) { return prep(sql).all(...norm(params)).map((r) => ({ ...r })); },
    async get(sql, params) { const r = prep(sql).get(...norm(params)); return r ? { ...r } : undefined; },
    async run(sql, params) {
      const r = prep(sql).run(...norm(params));
      return { changes: Number(r.changes), insertId: Number(r.lastInsertRowid) };
    },
    async exec(sql) { db.exec(sql); },
    async tx(fn) {
      db.exec('BEGIN');
      try {
        const out = await fn();
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async columns(table) { return prep(`PRAGMA table_info("${table}")`).all().map((r) => r.name); },
    async close() { db.close(); },
  };
}

async function mysqlAdapter(url) {
  let mysql;
  try {
    mysql = require('mysql2/promise');
  } catch {
    throw new Error('DATABASE_URL points to MySQL but the "mysql2" package is not installed. Run: npm install mysql2');
  }
  const u = new URL(url);
  const sslParam = (u.searchParams.get('ssl') || u.searchParams.get('ssl-mode') || u.searchParams.get('sslmode') || '').toLowerCase();
  const useSsl = ['true', '1', 'required', 'require', 'verify_ca', 'verify_identity'].includes(sslParam);
  const pool = mysql.createPool({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
    connectionLimit: 8,
    waitForConnections: true,
    charset: 'utf8mb4',
    dateStrings: true,
    decimalNumbers: true,
    supportBigNumbers: true,
    // ssl=true verifies the server certificate; ssl-mode=REQUIRED (Aiven style) encrypts without CA verification
    ssl: useSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: !['required', 'require'].includes(sslParam) } : undefined,
  });
  const fix = (rows) => (Array.isArray(rows) ? rows.map((r) => ({ ...r })) : rows);
  return {
    dialect: 'mysql',
    describe: `MySQL (${u.hostname}/${u.pathname.replace(/^\//, '')})`,
    async all(sql, params) { const [rows] = await pool.query(sql, norm(params)); return fix(rows); },
    async get(sql, params) { const [rows] = await pool.query(sql, norm(params)); return rows[0] ? { ...rows[0] } : undefined; },
    async run(sql, params) {
      const [r] = await pool.query(sql, norm(params));
      return { changes: r.affectedRows, insertId: r.insertId };
    },
    async exec(sql) { await pool.query(sql); },
    async tx(fn) { return fn(); },
    async columns(table) {
      const [rows] = await pool.query('SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]);
      return rows.map((r) => r.name);
    },
    async close() { await pool.end(); },
  };
}

let impl = null;

async function init({ url, dataDir }) {
  impl = url && /^mysql:\/\//i.test(url) ? await mysqlAdapter(url) : sqliteAdapter(path.join(dataDir, 'careerbridge.db'));
  for (const table of TABLES) {
    await impl.exec(createTableDDL(impl.dialect, table));
    for (const ddl of indexDDL(impl.dialect, table)) await impl.exec(ddl);
    // add columns introduced after the table was first created
    const existing = new Set(await impl.columns(table.name));
    for (const col of table.columns) {
      if (!existing.has(col[0])) {
        const def = columnDDL(impl.dialect, col).replace(/ NOT NULL/, '').replace(/ UNIQUE/, '');
        await impl.exec(`ALTER TABLE ${impl.dialect === 'mysql' ? '`' + table.name + '`' : '"' + table.name + '"'} ADD COLUMN ${def}`);
      }
    }
  }
  return impl;
}

const db = {
  init,
  get dialect() { return impl.dialect; },
  get describe() { return impl.describe; },
  all: (sql, params) => impl.all(sql, params),
  get: (sql, params) => impl.get(sql, params),
  run: (sql, params) => impl.run(sql, params),
  tx: (fn) => impl.tx(fn),
  close: () => impl && impl.close(),
  async insert(table, row) {
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
    const r = await impl.run(sql, keys.map((k) => row[k]));
    return r.insertId;
  },
  async update(table, id, row) {
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    if (!keys.length) return 0;
    const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
    const r = await impl.run(sql, [...keys.map((k) => row[k]), id]);
    return r.changes;
  },
  /** `IN (?, ?, ?)` helper */
  inList(values) { return values.length ? `(${values.map(() => '?').join(', ')})` : '(NULL)'; },
};

module.exports = db;
