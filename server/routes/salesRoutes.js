const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { validate } = require('../middlewares/validate');
const salesService = require('../services/salesService');

// GET sales list
router.get('/', authenticate, (req, res, next) => {
  try {
    const { search, startDate, endDate, cashierId, paymentMethod, page, limit } = req.query;

    // Cashiers can see their own shift sales, or if specified filter
    let targetCashierId = cashierId ? parseInt(cashierId, 10) : null;
    if (req.user.role === 'CASHIER' && !targetCashierId) {
      targetCashierId = req.user.id;
    }

    const sales = salesService.getSales({
      search: search || '',
      startDate: startDate || null,
      endDate: endDate || null,
      cashierId: targetCashierId,
      paymentMethod: paymentMethod || null,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    res.json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (error) {
    next(error);
  }
});

// GET single invoice details for viewing or printing
router.get('/:id', authenticate, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const sale = salesService.getSaleById(id);
    res.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    next(error);
  }
});

const saleItemSchema = z.object({
  medicineId: z.number().int().positive('Medicine ID is required'),
  batchId: z.number().int().positive().optional(), // If omitted, FEFO allocates automatically!
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unitPrice: z.number().positive().optional(),
});

const createSaleSchema = z.object({
  customerName: z.string().optional().default('Walk-in Customer'),
  customerPhone: z.string().optional(),
  doctorName: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'Sale cart cannot be empty'),
  discount: z.number().min(0).optional().default(0),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'INSURANCE']).default('CASH'),
  amountPaid: z.number().min(0),
  notes: z.string().optional(),
});

// POST checkout new sale (ADMIN, PHARMACIST, CASHIER)
router.post('/', authenticate, authorize('ADMIN', 'PHARMACIST', 'CASHIER'), validate(createSaleSchema), (req, res, next) => {
  try {
    const newSale = salesService.createSale(req.body, req.user, req.ip);
    res.status(201).json({
      success: true,
      message: 'Sale completed successfully and invoice generated',
      data: newSale,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
