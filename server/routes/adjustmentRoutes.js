const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { validate } = require('../middlewares/validate');
const adjustmentService = require('../services/adjustmentService');

// GET all stock adjustments and returns (ADMIN, PHARMACIST)
router.get('/', authenticate, authorize('ADMIN', 'PHARMACIST'), (req, res, next) => {
  try {
    const { medicineId, batchId, type, page, limit } = req.query;
    const adjustments = adjustmentService.getAdjustments({
      medicineId: medicineId ? parseInt(medicineId, 10) : null,
      batchId: batchId ? parseInt(batchId, 10) : null,
      type: type || null,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    res.json({
      success: true,
      count: adjustments.length,
      data: adjustments,
    });
  } catch (error) {
    next(error);
  }
});

// GET single adjustment details
router.get('/:id', authenticate, authorize('ADMIN', 'PHARMACIST'), (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const adjustment = adjustmentService.getAdjustmentById(id);
    res.json({
      success: true,
      data: adjustment,
    });
  } catch (error) {
    next(error);
  }
});

const adjustmentSchema = z.object({
  type: z.enum(['CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'EXPIRED_DISPOSAL', 'DAMAGED_WRITE_OFF', 'PHYSICAL_AUDIT_CORRECTION']),
  batchId: z.number().int().positive('Batch ID is required'),
  quantity: z.number().int().refine(val => val !== 0, 'Quantity cannot be zero'),
  reason: z.string().trim().min(3, 'A clear operational reason (minimum 3 characters) is strictly mandatory'),
  relatedSaleId: z.number().int().positive().optional().nullable(),
});

// POST record stock adjustment / return (ADMIN, PHARMACIST)
router.post('/', authenticate, authorize('ADMIN', 'PHARMACIST'), validate(adjustmentSchema), (req, res, next) => {
  try {
    const newAdj = adjustmentService.createAdjustment(req.body, req.user, req.ip);
    res.status(201).json({
      success: true,
      message: 'Stock adjustment recorded and inventory updated successfully',
      data: newAdj,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
