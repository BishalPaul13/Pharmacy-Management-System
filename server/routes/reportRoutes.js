const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const reportService = require('../services/reportService');

// GET dashboard key operational statistics
router.get('/dashboard', authenticate, (req, res, next) => {
  try {
    const summary = reportService.getDashboardSummary();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

// GET sales revenue & margin report
router.get('/sales', authenticate, authorize('ADMIN', 'PHARMACIST'), (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const report = reportService.getSalesReport({ startDate, endDate });
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

// GET stock valuation report
router.get('/valuation', authenticate, authorize('ADMIN', 'PHARMACIST'), (req, res, next) => {
  try {
    const report = reportService.getStockValuationReport();
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

// GET expiry & shelf-life report
router.get('/expiry', authenticate, (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days, 10) : 60;
    const report = reportService.getExpiryReport({ days });
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

// GET perpetual stock reconciliation report
router.get('/reconciliation', authenticate, authorize('ADMIN', 'PHARMACIST'), (req, res, next) => {
  try {
    const medicineId = req.query.medicineId ? parseInt(req.query.medicineId, 10) : null;
    const report = reportService.getStockReconciliationReport({ medicineId });
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
