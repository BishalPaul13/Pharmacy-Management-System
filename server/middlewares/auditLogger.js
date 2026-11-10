const { getDb } = require('../config/db');

function logAudit({ user, ip, action, entityType, entityId, details }) {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, username, role, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      user ? user.id : null,
      user ? user.username : 'SYSTEM',
      user ? user.role : 'SYSTEM',
      action,
      entityType,
      entityId ? String(entityId) : null,
      typeof details === 'object' ? JSON.stringify(details) : details,
      ip || '127.0.0.1'
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

module.exports = { logAudit };
