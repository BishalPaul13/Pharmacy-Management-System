const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { validate } = require('../middlewares/validate');
const batchService = require('../services/batchService');

// GET batches with filters
router.get('/', (req, res, next) => {
  try {
    const { medicineId, status, nearExpiryDays, expiredOnly, page, limit } = req.query;
    const batches = batchService.getBatches({
      medicineId: medicineId ? parseInt(medicineId, 10) : null,
      status: status || null,
      nearExpiryDays: nearExpiryDays ? parseInt(nearExpiryDays, 10) : null,
      expiredOnly: expiredOnly === 'true',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    res.json({
      success: true,
      count: batches.length,
      data: batches,
    });
  } catch (error) {
    next(error);
  }
});

// GET single batch details
router.get('/:id', (req, res, next) => {
  try {
    const batch = batchService.getBatchById(parseInt(req.params.id, 10));
    res.json({
      success: true,
      data: batch,
    });
  } catch (error) {
    next(error);
  }
});

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'DEPLETED', 'QUARANTINED']),
  reason: z.string().min(3, 'A reason is required to alter batch status'),
});

// PATCH update batch status (e.g. quarantine expired/recalled batch) (ADMIN, PHARMACIST)
router.patch('/:id/status', authenticate, authorize('ADMIN', 'PHARMACIST'), validate(statusSchema), (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, reason } = req.body;
    const updated = batchService.updateBatchStatus(id, status, reason, req.user, req.ip);

    res.json({
      success: true,
      message: `Batch status changed to ${status}`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
