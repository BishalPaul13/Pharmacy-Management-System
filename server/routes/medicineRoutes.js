const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { validate } = require('../middlewares/validate');
const medicineService = require('../services/medicineService');
const { getFefoAllocation } = require('../services/batchService');

// GET all medicines with search, category, and low stock filters
router.get('/', (req, res, next) => {
  try {
    const { search, categoryId, lowStock, page, limit } = req.query;
    const medicines = medicineService.getMedicines({
      search: search || '',
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      lowStockOnly: lowStock === 'true',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    res.json({
      success: true,
      count: medicines.length,
      data: medicines,
    });
  } catch (error) {
    next(error);
  }
});

// GET single medicine details with batches
router.get('/:id', (req, res, next) => {
  try {
    const medicine = medicineService.getMedicineById(parseInt(req.params.id, 10));
    res.json({
      success: true,
      data: medicine,
    });
  } catch (error) {
    next(error);
  }
});

// GET FEFO batch allocation preview for a given quantity
router.get('/:id/fefo', (req, res, next) => {
  try {
    const medicineId = parseInt(req.params.id, 10);
    const quantity = parseInt(req.query.quantity || '1', 10);
    const plan = getFefoAllocation(medicineId, quantity);

    res.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
});

const medicineSchema = z.object({
  sku: z.string().min(3, 'SKU is required (min 3 chars)'),
  name: z.string().min(2, 'Medicine name is required'),
  generic_name: z.string().min(2, 'Generic name is required'),
  category_id: z.number().int().positive('Category ID is required'),
  dosage_form: z.string().min(2, 'Dosage form is required'),
  strength: z.string().min(1, 'Strength is required'),
  unit_of_measure: z.string().optional().default('Units'),
  reorder_level: z.number().int().min(0).optional().default(20),
  prescription_required: z.boolean().optional().default(false),
  shelf_location: z.string().optional(),
  description: z.string().optional(),
});

// POST create medicine (ADMIN, PHARMACIST)
router.post('/', authenticate, authorize('ADMIN', 'PHARMACIST'), validate(medicineSchema), (req, res, next) => {
  try {
    const newMed = medicineService.createMedicine(req.body, req.user, req.ip);
    res.status(201).json({
      success: true,
      message: 'Medicine created successfully',
      data: newMed,
    });
  } catch (error) {
    next(error);
  }
});

// PUT update medicine (ADMIN, PHARMACIST)
router.put('/:id', authenticate, authorize('ADMIN', 'PHARMACIST'), (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = medicineService.updateMedicine(id, req.body, req.user, req.ip);
    res.json({
      success: true,
      message: 'Medicine updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
