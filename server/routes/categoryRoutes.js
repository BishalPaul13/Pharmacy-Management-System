const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { getDb } = require('../config/db');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { validate } = require('../middlewares/validate');
const { logAudit } = require('../middlewares/auditLogger');

// GET all categories
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const categories = db.prepare(`
      SELECT c.*, COUNT(m.id) AS total_medicines
      FROM categories c
      LEFT JOIN medicines m ON c.id = m.category_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `).all();

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

const categorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters'),
  description: z.string().optional(),
});

// POST new category (ADMIN, PHARMACIST)
router.post('/', authenticate, authorize('ADMIN', 'PHARMACIST'), validate(categorySchema), (req, res, next) => {
  try {
    const db = getDb();
    const { name, description } = req.body;

    const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_CATEGORY',
        message: `Category '${name}' already exists`,
      });
    }

    const result = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, description || null);
    const newCat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);

    logAudit({
      user: req.user,
      ip: req.ip,
      action: 'CATEGORY_CREATED',
      entityType: 'CATEGORY',
      entityId: newCat.id,
      details: { name: newCat.name },
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: newCat,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
