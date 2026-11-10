const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');

// GET audit logs with filters (ADMIN ONLY)
router.get('/', authenticate, authorize('ADMIN'), (req, res, next) => {
  try {
    const db = getDb();
    const { action, entityType, username, page = 1, limit = 50 } = req.query;

    let whereClauses = [];
    let params = [];

    if (action) {
      whereClauses.push('action = ?');
      params.push(action);
    }

    if (entityType) {
      whereClauses.push('entity_type = ?');
      params.push(entityType);
    }

    if (username) {
      whereClauses.push('username LIKE ?');
      params.push(`%${username}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const logs = db.prepare(`
      SELECT * FROM audit_logs
      ${whereSql}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit, 10), offset);

    const totalCount = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs ${whereSql}
    `).get(...params).count;

    res.json({
      success: true,
      totalCount,
      page: parseInt(page, 10),
      data: logs.map(l => {
        let parsedDetails = l.details;
        try {
          parsedDetails = JSON.parse(l.details);
        } catch (e) {
          // keep as string
        }
        return {
          ...l,
          details: parsedDetails,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

