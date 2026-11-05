'use strict';
const db = require('../db');
const { nowIso } = require('../lib/util');

/** Creates one notification per active recruiter of the company (optionally skipping the actor). */
async function notifyCompany(companyId, { type, title, body = null, link = null }, { exceptUserId = null, onlyUserId = null } = {}) {
  const users = onlyUserId
    ? [{ id: onlyUserId }]
    : await db.all("SELECT id FROM recruiters WHERE company_id = ? AND (status IS NULL OR status = 'active')", [companyId]);
  const created = nowIso();
  for (const u of users) {
    if (exceptUserId && u.id === exceptUserId) continue;
    await db.insert('notifications', { company_id: companyId, recruiter_id: u.id, type, title, body, link, is_read: 0, created_at: created });
  }
}

module.exports = { notifyCompany };
