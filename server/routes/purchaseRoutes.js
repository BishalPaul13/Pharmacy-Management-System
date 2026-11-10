const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { validate } = require('../middlewares/validate');
const purchaseService = require('../services/purchaseService');

// GET all inward purchase records (ADMIN, PHARMACIST)
router.get('/', authenticate, authorize('ADMIN', 'PHARMACIST'), (req, res, next) => {
  try {
    const { supplierId, page, limit } = req.query;
    const purchases = purchaseService.getPurchases({
      supplierId: supplierId ? parseInt(supplierId, 10) : null,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    res.json({
      success: true,
      count: purchases.length,
      data: purchases,
    });
  } catch (error) {
    next(error);
  }
});

// GET single purchase record with items
router.get('/:id', authenticate, authorize('ADMIN', 'PHARMACIST'), (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const purchase = purchaseService.getPurchaseById(id);
    res.json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    next(error);
  }
});

const purchaseItemSchema = z.object({
  medicineId: z.number().int().positive('Medicine ID is required'),
  batchNumber: z.string().min(2, 'Batch number is required'),
  initialQuantity: z.number().int().positive('Quantity must be greater than 0'),
  costPrice: z.number().positive('Cost price must be positive'),
  salePrice: z.number().positive('Sale price must be positive'),
  manufacturingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Manufacturing date format must be YYYY-MM-DD'),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date format must be YYYY-MM-DD'),
});

const purchaseSchema = z.object({
  supplierId: z.number().int().positive('Supplier is required'),
  invoiceNo: z.string().optional(),
  purchaseDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, 'At least one batch item is required'),
});

// POST record new inward shipment (ADMIN, PHARMACIST)
router.post('/', authenticate, authorize('ADMIN', 'PHARMACIST'), validate(purchaseSchema), (req, res, next) => {
  try {
    const newPurchase = purchaseService.createPurchase(req.body, req.user, req.ip);
    res.status(201).json({
      success: true,
      message: 'Inward shipment received and inventory batches updated successfully',
      data: newPurchase,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
