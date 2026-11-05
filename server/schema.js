'use strict';
/**
 * CareerBridge database schema. One definition, rendered as MySQL or SQLite DDL.
 * Column spec: [name, type, options]
 *   types: pk | str | text | longtext | int | real | bool | date | fk:<table>
 *   a trailing "!" on the type means NOT NULL. Dates are ISO-8601 UTC strings.
 */
const TABLES = [
  {
    name: 'universities',
    columns: [
      ['id', 'pk'], ['name', 'str!'], ['code', 'str!', { unique: true }], ['location', 'str'], ['officer_name', 'str'],
      ['officer_email', 'str', { unique: true }], ['password_hash', 'str'], ['created_at', 'date!'], ['logo_url', 'longtext'], ['phone', 'str'], ['website', 'str'],
    ],
  },
  {
    name: 'students',
    columns: [
      ['id', 'pk'], ['university_id', 'fk:universities', { onDelete: 'SET NULL' }], ['name', 'str!'], ['email', 'str!', { unique: true }],
      ['password_hash', 'str!'], ['phone', 'str'], ['degree', 'str'], ['grad_year', 'int'], ['location', 'str'], ['linkedin_url', 'str'],
      ['resume_text', 'longtext'], ['resume_file', 'str'], ['resume_name', 'str'], ['skills', 'text'], ['resume_feedback', 'text'],
      ['avatar_color', 'str'], ['created_at', 'date!'], ['avatar_url', 'longtext'], ['bio', 'text'],
    ],
  },
  {
    name: 'mock_interviews',
    columns: [
      ['id', 'pk'], ['student_id', 'fk:students!', { onDelete: 'CASCADE' }], ['role', 'str!'], ['questions', 'text'], ['answers', 'text'],
      ['score', 'int'], ['feedback', 'text'], ['status', 'str'], ['created_at', 'date!'],
    ],
  },
  {
    name: 'companies',
    columns: [
      ['id', 'pk'], ['name', 'str!'], ['slug', 'str!', { unique: true }], ['industry', 'str'], ['location', 'str'],
      ['website', 'str'], ['employees', 'int'], ['founded_year', 'int'], ['tagline', 'str'], ['about', 'text'],
      ['mission', 'text'], ['company_values', 'text'], ['logo_path', 'str'], ['cover_style', 'str'], ['currency', 'str'],
      ['hiring_goal', 'int'], ['verified', 'bool'], ['careers_enabled', 'bool'], ['ai_api_key_enc', 'text'],
      ['ai_provider', 'str'], ['ai_model', 'str'], ['ai_cache', 'longtext'], ['is_demo', 'bool'],
      ['created_at', 'date!'], ['updated_at', 'date'],
    ],
  },
  {
    name: 'recruiters',
    columns: [
      ['id', 'pk'], ['company_id', 'fk:companies!', { onDelete: 'CASCADE' }], ['name', 'str!'],
      ['email', 'str!', { unique: true }], ['password_hash', 'str!'], ['role', 'str!'], ['title', 'str'], ['phone', 'str'],
      ['bio', 'text'], ['avatar_color', 'str'], ['status', 'str'], ['prefs', 'text'], ['last_login_at', 'date'],
      ['created_at', 'date!'], ['avatar_url', 'longtext'],
    ],
    indexes: [['company_id']],
  },
  {
    name: 'jobs',
    columns: [
      ['id', 'pk'], ['company_id', 'fk:companies!', { onDelete: 'CASCADE' }], ['recruiter_id', 'fk:recruiters', { onDelete: 'SET NULL' }],
      ['title', 'str!'], ['department', 'str'], ['location', 'str'], ['work_mode', 'str'], ['employment_type', 'str'],
      ['experience_min', 'int'], ['experience_max', 'int'], ['salary_min', 'int'], ['salary_max', 'int'], ['openings', 'int'],
      ['description', 'text'], ['requirements', 'text'], ['skills', 'text'], ['status', 'str!'], ['is_urgent', 'bool'],
      ['ai_insights', 'text'], ['ai_generated_at', 'date'], ['published_at', 'date'], ['closed_at', 'date'],
      ['created_at', 'date!'], ['updated_at', 'date'],
    ],
    indexes: [['company_id', 'status']],
  },
  {
    name: 'candidates',
    columns: [
      ['id', 'pk'], ['company_id', 'fk:companies!', { onDelete: 'CASCADE' }], ['name', 'str!'], ['email', 'str'], ['phone', 'str'],
      ['location', 'str'], ['current_title', 'str'], ['current_company', 'str'], ['experience_years', 'real'],
      ['linkedin_url', 'str'], ['github_url', 'str'], ['portfolio_url', 'str'], ['education', 'text'], ['skills', 'text'],
      ['expected_salary', 'str'], ['availability', 'str'], ['resume_text', 'longtext'], ['resume_file', 'str'],
      ['resume_name', 'str'], ['avatar_color', 'str'], ['created_at', 'date!'],
    ],
    indexes: [['company_id'], ['email']],
  },
  {
    name: 'applications',
    columns: [
      ['id', 'pk'], ['job_id', 'fk:jobs!', { onDelete: 'CASCADE' }], ['candidate_id', 'fk:candidates!', { onDelete: 'CASCADE' }],
      ['company_id', 'fk:companies!', { onDelete: 'CASCADE' }], ['recruiter_id', 'fk:recruiters', { onDelete: 'SET NULL' }],
      ['stage', 'str!'], ['furthest_stage', 'int'], ['source', 'str'], ['cover_letter', 'text'],
      ['match_score', 'int'], ['ats_score', 'int'], ['match_level', 'str'], ['match_details', 'text'], ['matched_at', 'date'],
      ['ai_insights', 'text'], ['ai_status', 'str'], ['ai_error', 'text'], ['ai_generated_at', 'date'], ['ai_interview', 'text'],
      ['status_token', 'str', { unique: true }], ['rating', 'int'], ['rejected_reason', 'str'], ['last_viewed_at', 'date'],
      ['stage_changed_at', 'date'], ['created_at', 'date!'], ['updated_at', 'date'], ['student_id', 'int'],
    ],
    indexes: [['company_id', 'stage'], ['job_id'], ['candidate_id']],
  },
  {
    name: 'stage_history',
    columns: [
      ['id', 'pk'], ['application_id', 'fk:applications!', { onDelete: 'CASCADE' }], ['from_stage', 'str'], ['to_stage', 'str!'],
      ['changed_by', 'fk:recruiters', { onDelete: 'SET NULL' }], ['note', 'str'], ['changed_at', 'date!'],
    ],
    indexes: [['application_id']],
  },
  {
    name: 'interviews',
    columns: [
      ['id', 'pk'], ['application_id', 'fk:applications!', { onDelete: 'CASCADE' }], ['company_id', 'fk:companies!', { onDelete: 'CASCADE' }],
      ['interviewer_id', 'fk:recruiters', { onDelete: 'SET NULL' }], ['scheduled_at', 'date!'], ['duration_minutes', 'int'],
      ['type', 'str'], ['platform', 'str'], ['meeting_link', 'str'], ['location', 'str'], ['agenda', 'text'], ['status', 'str!'],
      ['notes', 'text'], ['created_by', 'fk:recruiters', { onDelete: 'SET NULL' }], ['created_at', 'date!'], ['updated_at', 'date'],
    ],
    indexes: [['company_id', 'scheduled_at'], ['application_id']],
  },
  {
    name: 'evaluations',
    columns: [
      ['id', 'pk'], ['interview_id', 'fk:interviews!', { onDelete: 'CASCADE' }], ['evaluator_id', 'fk:recruiters', { onDelete: 'SET NULL' }],
      ['score', 'real'], ['technical', 'int'], ['communication', 'int'], ['culture_fit', 'int'], ['problem_solving', 'int'],
      ['recommendation', 'str'], ['notes', 'text'], ['created_at', 'date!'],
    ],
    indexes: [['interview_id']],
  },
  {
    name: 'messages',
    columns: [
      ['id', 'pk'], ['application_id', 'fk:applications!', { onDelete: 'CASCADE' }], ['company_id', 'fk:companies!', { onDelete: 'CASCADE' }],
      ['sender_type', 'str!'], ['sender_id', 'fk:recruiters', { onDelete: 'SET NULL' }], ['subject', 'str'], ['body', 'text!'],
      ['channel', 'str'], ['email_status', 'str'], ['read_at', 'date'], ['sent_at', 'date!'],
    ],
    indexes: [['application_id'], ['company_id']],
  },
  {
    name: 'notifications',
    columns: [
      ['id', 'pk'], ['company_id', 'fk:companies!', { onDelete: 'CASCADE' }], ['recruiter_id', 'fk:recruiters', { onDelete: 'CASCADE' }],
      ['type', 'str!'], ['title', 'str!'], ['body', 'text'], ['link', 'str'], ['is_read', 'bool'], ['created_at', 'date!'],
    ],
    indexes: [['company_id', 'recruiter_id']],
  },
];

const TYPES = {
  sqlite: { pk: 'INTEGER PRIMARY KEY AUTOINCREMENT', str: 'TEXT', text: 'TEXT', longtext: 'TEXT', int: 'INTEGER', real: 'REAL', bool: 'INTEGER', date: 'TEXT', fk: 'INTEGER' },
  mysql: { pk: 'INT NOT NULL AUTO_INCREMENT PRIMARY KEY', str: 'VARCHAR(255)', text: 'MEDIUMTEXT', longtext: 'LONGTEXT', int: 'INT', real: 'DOUBLE', bool: 'TINYINT(1)', date: 'VARCHAR(32)', fk: 'INT' },
};

function parseType(spec) {
  const notNull = spec.endsWith('!');
  const base = spec.replace(/!$/, '');
  if (base.startsWith('fk:')) return { kind: 'fk', ref: base.slice(3), notNull };
  return { kind: base, notNull };
}

function columnDDL(dialect, [name, spec, opts = {}]) {
  const t = parseType(spec);
  const q = dialect === 'mysql' ? '`' : '"';
  let sql = `${q}${name}${q} ${TYPES[dialect][t.kind]}`;
  if (t.kind === 'pk') return sql;
  if (t.notNull) sql += ' NOT NULL';
  if (opts.unique) sql += ' UNIQUE';
  if (t.kind === 'fk' && dialect === 'sqlite') sql += ` REFERENCES ${t.ref}(id) ON DELETE ${opts.onDelete || 'NO ACTION'}`;
  return sql;
}

function createTableDDL(dialect, table) {
  const parts = table.columns.map((c) => columnDDL(dialect, c));
  if (dialect === 'mysql') {
    for (const [name, spec, opts = {}] of table.columns) {
      const t = parseType(spec);
      if (t.kind === 'fk') parts.push(`FOREIGN KEY (\`${name}\`) REFERENCES \`${t.ref}\`(\`id\`) ON DELETE ${opts.onDelete || 'NO ACTION'}`);
    }
    for (const cols of table.indexes || []) parts.push(`INDEX \`idx_${table.name}_${cols.join('_')}\` (${cols.map((c) => '`' + c + '`').join(', ')})`);
    return `CREATE TABLE IF NOT EXISTS \`${table.name}\` (\n  ${parts.join(',\n  ')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
  }
  return `CREATE TABLE IF NOT EXISTS "${table.name}" (\n  ${parts.join(',\n  ')}\n)`;
}

function indexDDL(dialect, table) {
  if (dialect === 'mysql') return [];
  return (table.indexes || []).map((cols) => `CREATE INDEX IF NOT EXISTS idx_${table.name}_${cols.join('_')} ON "${table.name}" (${cols.join(', ')})`);
}

module.exports = { TABLES, createTableDDL, indexDDL, columnDDL, parseType };
