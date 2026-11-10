const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { getDb } = require('../config/db');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { validate } = require('../middlewares/validate');
const { logAudit } = require('../middlewares/auditLogger');

// GET all suppliers
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const suppliers = db.prepare(`
      SELECT s.*, COUNT(p.id) AS total_purchases
      FROM suppliers s
      LEFT JOIN purchases p ON s.id = p.supplier_id
      GROUP BY s.id
      ORDER BY s.name ASC
    `).all();

    res.json({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    next(error);
  }
});

const supplierSchema = z.object({
  name: z.string().min(2, 'Supplier name is required'),
  code: z.string().min(2, 'Supplier code is required'),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  tax_id: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

// POST new supplier (ADMIN, PHARMACIST)
router.post('/', authenticate, authorize('ADMIN', 'PHARMACIST'), validate(supplierSchema), (req, res, next) => {
  try {
    const db = getDb();
    const { name, code, contact_person, phone, email, address, tax_id, status } = req.body;

    const existing = db.prepare('SELECT id FROM suppliers WHERE code = ?').get(code);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_SUPPLIER_CODE',
        message: `Supplier code '${code}' already exists`,
      });
    }

    const result = db.prepare(`
      INSERT INTO suppliers (name, code, contact_person, phone, email, address, tax_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, code, contact_person || null, phone || null, email || null, address || null, tax_id || null, status || 'ACTIVE');

    const newSupplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);

    logAudit({
      user: req.user,
      ip: req.ip,
      action: 'SUPPLIER_CREATED',
      entityType: 'SUPPLIER',
      entityId: newSupplier.id,
      details: { name: newSupplier.name, code: newSupplier.code },
    });

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: newSupplier,
    });
  } catch (error) {
    next(error);
  }
});

// PUT update supplier
router.put('/:id', authenticate, authorize('ADMIN', 'PHARMACIST'), (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, contact_person, phone, email, address, tax_id, status } = req.body;

    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Supplier not found' });
    }

    db.prepare(`
      UPDATE suppliers SET
        name = COALESCE(?, name),
        contact_person = COALESCE(?, contact_person),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        tax_id = COALESCE(?, tax_id),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(name || null, contact_person || null, phone || null, email || null, address || null, tax_id || null, status || null, id);

    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);

    logAudit({
      user: req.user,
      ip: req.ip,
      action: 'SUPPLIER_UPDATED',
      entityType: 'SUPPLIER',
      entityId: id,
      details: { previous: existing, updated },
    });

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
