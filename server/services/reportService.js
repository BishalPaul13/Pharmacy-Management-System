const { getDb } = require('../config/db');

function getDashboardSummary() {
  const db = getDb();

  // 1. Sales metrics (today and total)
  const salesToday = db.prepare(`
    SELECT 
      COALESCE(COUNT(id), 0) AS count,
      COALESCE(SUM(total_amount), 0.0) AS total_revenue
    FROM sales 
    WHERE date(sale_date) = date('now')
  `).get();

  const salesMonth = db.prepare(`
    SELECT 
      COALESCE(COUNT(id), 0) AS count,
      COALESCE(SUM(total_amount), 0.0) AS total_revenue
    FROM sales 
    WHERE strftime('%Y-%m', sale_date) = strftime('%Y-%m', 'now')
  `).get();

  // 2. Inventory Metrics
  const inventoryMetrics = db.prepare(`
    SELECT 
      COALESCE(SUM(quantity), 0) AS total_units,
      COALESCE(SUM(quantity * cost_price), 0.0) AS total_cost_value,
      COALESCE(SUM(quantity * sale_price), 0.0) AS total_retail_value
    FROM batches
    WHERE status != 'DEPLETED'
  `).get();

  // 3. Alerts counts
  const alertCounts = db.prepare(`
    SELECT 
      (SELECT COUNT(DISTINCT m.id) FROM medicines m
       JOIN (
         SELECT medicine_id, SUM(quantity) as active_qty
         FROM batches
         WHERE status = 'ACTIVE' AND date(expiry_date) > date('now')
         GROUP BY medicine_id
       ) cur ON m.id = cur.medicine_id
       WHERE cur.active_qty <= m.reorder_level
      ) AS low_stock_count,

      (SELECT COUNT(*) FROM batches 
       WHERE date(expiry_date) > date('now') 
         AND julianday(expiry_date) - julianday('now') <= 60 
         AND quantity > 0 AND status = 'ACTIVE'
      ) AS near_expiry_count,

      (SELECT COUNT(*) FROM batches 
       WHERE (date(expiry_date) <= date('now') OR status = 'EXPIRED') 
         AND quantity > 0
      ) AS expired_batch_count
  `).get();

  // 4. Recent sales
  const recentSales = db.prepare(`
    SELECT s.id, s.invoice_no, s.customer_name, s.total_amount, s.payment_method, s.sale_date, u.full_name as cashier_name
    FROM sales s
    JOIN users u ON s.cashier_id = u.id
    ORDER BY s.id DESC LIMIT 5
  `).all();

  // 5. Urgent expiry batches
  const urgentBatches = db.prepare(`
    SELECT b.id, b.batch_number, b.quantity, b.expiry_date, m.name as medicine_name,
      ROUND(julianday(b.expiry_date) - julianday('now')) AS days_to_expiry,
      CASE 
        WHEN date(b.expiry_date) <= date('now') THEN 'EXPIRED'
        WHEN julianday(b.expiry_date) - julianday('now') <= 15 THEN 'CRITICAL_EXPIRY'
        ELSE 'NEAR_EXPIRY'
      END AS urgency
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE (date(b.expiry_date) <= date('now') OR julianday(b.expiry_date) - julianday('now') <= 60)
      AND b.quantity > 0
    ORDER BY b.expiry_date ASC LIMIT 5
  `).all();

  return {
    sales: {
      today: salesToday,
      month: salesMonth,
    },
    inventory: {
      totalUnits: inventoryMetrics.total_units,
      costValuation: parseFloat(inventoryMetrics.total_cost_value.toFixed(2)),
      retailValuation: parseFloat(inventoryMetrics.total_retail_value.toFixed(2)),
      potentialProfit: parseFloat((inventoryMetrics.total_retail_value - inventoryMetrics.total_cost_value).toFixed(2)),
    },
    alerts: {
      lowStockCount: alertCounts.low_stock_count || 0,
      nearExpiryCount: alertCounts.near_expiry_count || 0,
      expiredBatchCount: alertCounts.expired_batch_count || 0,
    },
    recentSales,
    urgentBatches,
  };
}

function getSalesReport({ startDate = null, endDate = null } = {}) {
  const db = getDb();
  let whereClauses = [];
  let params = [];

  if (startDate) {
    whereClauses.push('date(s.sale_date) >= date(?)');
    params.push(startDate);
  }
  if (endDate) {
    whereClauses.push('date(s.sale_date) <= date(?)');
    params.push(endDate);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Overall totals and profit
  const totals = db.prepare(`
    SELECT 
      COUNT(DISTINCT s.id) AS total_transactions,
      COALESCE(SUM(s.subtotal), 0) AS total_subtotal,
      COALESCE(SUM(s.discount), 0) AS total_discount,
      COALESCE(SUM(s.tax_amount), 0) AS total_tax,
      COALESCE(SUM(s.total_amount), 0) AS total_revenue,
      COALESCE(SUM(si.quantity * si.cost_price), 0) AS total_cogs,
      COALESCE(SUM(si.quantity * (si.unit_price - si.cost_price)), 0) AS estimated_gross_profit
    FROM sales s
    LEFT JOIN sale_items si ON s.id = si.sale_id
    ${whereSql}
  `).get(...params);

  // By payment method
  const byPayment = db.prepare(`
    SELECT 
      s.payment_method,
      COUNT(s.id) AS transaction_count,
      SUM(s.total_amount) AS revenue
    FROM sales s
    ${whereSql}
    GROUP BY s.payment_method
    ORDER BY revenue DESC
  `).all(...params);

  // Top selling medicines
  const topProducts = db.prepare(`
    SELECT 
      m.name AS medicine_name,
      m.sku,
      c.name AS category_name,
      SUM(si.quantity) AS units_sold,
      SUM(si.total) AS total_revenue,
      SUM(si.quantity * (si.unit_price - si.cost_price)) AS gross_profit
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN medicines m ON si.medicine_id = m.id
    JOIN categories c ON m.category_id = c.id
    ${whereSql}
    GROUP BY m.id
    ORDER BY units_sold DESC
    LIMIT 10
  `).all(...params);

  return {
    period: { startDate, endDate },
    totals: {
      ...totals,
      total_subtotal: parseFloat(totals.total_subtotal.toFixed(2)),
      total_tax: parseFloat(totals.total_tax.toFixed(2)),
      total_revenue: parseFloat(totals.total_revenue.toFixed(2)),
      total_cogs: parseFloat(totals.total_cogs.toFixed(2)),
      estimated_gross_profit: parseFloat(totals.estimated_gross_profit.toFixed(2)),
      margin_percentage: totals.total_revenue > 0 ? parseFloat(((totals.estimated_gross_profit / totals.total_revenue) * 100).toFixed(1)) : 0,
    },
    byPayment,
    topProducts,
  };
}

function getStockValuationReport() {
  const db = getDb();

  const medicines = db.prepare(`
    SELECT 
      m.id AS medicine_id,
      m.sku,
      m.name AS medicine_name,
      c.name AS category_name,
      m.reorder_level,
      COALESCE(SUM(b.quantity), 0) AS total_stock_units,
      COALESCE(SUM(b.quantity * b.cost_price), 0) AS total_cost_valuation,
      COALESCE(SUM(b.quantity * b.sale_price), 0) AS total_retail_valuation,
      COALESCE(SUM(b.quantity * (b.sale_price - b.cost_price)), 0) AS potential_profit
    FROM medicines m
    JOIN categories c ON m.category_id = c.id
    LEFT JOIN batches b ON m.id = b.medicine_id AND b.quantity > 0
    GROUP BY m.id
    ORDER BY total_cost_valuation DESC
  `).all();

  const totals = medicines.reduce((acc, m) => {
    acc.totalUnits += m.total_stock_units;
    acc.totalCostValuation += m.total_cost_valuation;
    acc.totalRetailValuation += m.total_retail_valuation;
    acc.totalPotentialProfit += m.potential_profit;
    return acc;
  }, { totalUnits: 0, totalCostValuation: 0, totalRetailValuation: 0, totalPotentialProfit: 0 });

  return {
    summary: {
      totalMedicines: medicines.length,
      totalUnits: totals.totalUnits,
      costValuation: parseFloat(totals.totalCostValuation.toFixed(2)),
      retailValuation: parseFloat(totals.totalRetailValuation.toFixed(2)),
      potentialProfit: parseFloat(totals.totalPotentialProfit.toFixed(2)),
    },
    medicines: medicines.map(m => ({
      ...m,
      total_cost_valuation: parseFloat(m.total_cost_valuation.toFixed(2)),
      total_retail_valuation: parseFloat(m.total_retail_valuation.toFixed(2)),
      potential_profit: parseFloat(m.potential_profit.toFixed(2)),
    })),
  };
}

function getExpiryReport({ days = 60 } = {}) {
  const db = getDb();

  const batches = db.prepare(`
    SELECT 
      b.*,
      m.name AS medicine_name,
      m.sku AS medicine_sku,
      c.name AS category_name,
      ROUND(julianday(b.expiry_date) - julianday('now')) AS days_to_expiry,
      CASE 
        WHEN date(b.expiry_date) <= date('now') THEN 'EXPIRED'
        WHEN julianday(b.expiry_date) - julianday('now') <= 15 THEN 'CRITICAL'
        WHEN julianday(b.expiry_date) - julianday('now') <= ? THEN 'WARNING'
        ELSE 'SAFE'
      END AS status_tier
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    JOIN categories c ON m.category_id = c.id
    WHERE b.quantity > 0
    ORDER BY b.expiry_date ASC
  `).all(days);

  const groups = {
    expired: batches.filter(b => b.status_tier === 'EXPIRED'),
    critical: batches.filter(b => b.status_tier === 'CRITICAL'),
    warning: batches.filter(b => b.status_tier === 'WARNING'),
    safe: batches.filter(b => b.status_tier === 'SAFE'),
  };

  return {
    thresholdDays: days,
    counts: {
      expired: groups.expired.length,
      critical: groups.critical.length,
      warning: groups.warning.length,
      safe: groups.safe.length,
      total: batches.length,
    },
    groups,
  };
}

/**
 * Stock Reconciliation Report (Audit & Integrity Demonstration)
 * Reconciles every medicine and batch against the Stock Ledger:
 * 
 * Opening Stock + Purchases - Sales + Customer Returns - Supplier Returns - Disposals/Damaged + Audit Adjustments = Reconciled Stock
 * Must match the physical Batch.quantity exactly!
 */
function getStockReconciliationReport({ medicineId = null } = {}) {
  const db = getDb();
  let whereSql = '';
  let params = [];

  if (medicineId) {
    whereSql = 'WHERE b.medicine_id = ?';
    params.push(medicineId);
  }

  const batchRows = db.prepare(`
    SELECT 
      b.id AS batch_id,
      b.batch_number,
      b.medicine_id,
      m.name AS medicine_name,
      m.sku AS medicine_sku,
      b.quantity AS actual_batch_stock,
      b.status AS batch_status,
      b.expiry_date
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    ${whereSql}
    ORDER BY m.name ASC, b.expiry_date ASC
  `).all(...params);

  const reconciliationDetails = batchRows.map(batch => {
    // Tally all ledger movements for this batch
    const movements = db.prepare(`
      SELECT 
        movement_type,
        COALESCE(SUM(quantity_delta), 0) AS total_delta,
        COUNT(id) AS movement_count
      FROM stock_ledger
      WHERE batch_id = ?
      GROUP BY movement_type
    `).all(batch.batch_id);

    let opening = 0;
    let purchases = 0;
    let sales = 0;
    let customerReturns = 0;
    let supplierReturns = 0;
    let damagedWriteOff = 0;
    let expiredDisposal = 0;
    let auditAdjustments = 0;

    movements.forEach(m => {
      switch (m.movement_type) {
        case 'OPENING_BALANCE':
          opening += m.total_delta;
          break;
        case 'PURCHASE':
          purchases += m.total_delta;
          break;
        case 'SALE':
          sales += Math.abs(m.total_delta);
          break;
        case 'CUSTOMER_RETURN':
          customerReturns += m.total_delta;
          break;
        case 'SUPPLIER_RETURN':
          supplierReturns += Math.abs(m.total_delta);
          break;
        case 'DAMAGED_WRITE_OFF':
          damagedWriteOff += Math.abs(m.total_delta);
          break;
        case 'EXPIRED_DISPOSAL':
          expiredDisposal += Math.abs(m.total_delta);
          break;
        case 'AUDIT_ADJUSTMENT':
          auditAdjustments += m.total_delta;
          break;
      }
    });

    // Mathematical formula for perpetual inventory reconciliation:
    const calculatedClosingStock = opening + purchases - sales + customerReturns - supplierReturns - damagedWriteOff - expiredDisposal + auditAdjustments;
    const discrepancy = batch.actual_batch_stock - calculatedClosingStock;
    const isReconciled = discrepancy === 0;

    return {
      batchId: batch.batch_id,
      batchNumber: batch.batch_number,
      medicineId: batch.medicine_id,
      medicineName: batch.medicine_name,
      medicineSku: batch.medicine_sku,
      expiryDate: batch.expiry_date,
      actualPhysicalStock: batch.actual_batch_stock,
      openingStock: opening,
      purchases,
      sales,
      customerReturns,
      supplierReturns,
      damagedWriteOff,
      expiredDisposal,
      auditAdjustments,
      calculatedClosingStock,
      discrepancy,
      status: isReconciled ? 'RECONCILED' : 'DISCREPANCY_DETECTED',
    };
  });

  const allBalanced = reconciliationDetails.every(r => r.status === 'RECONCILED');

  return {
    reconciliationTimestamp: new Date().toISOString(),
    overallStatus: allBalanced ? 'PERFECTLY_RECONCILED' : 'DISCREPANCY_ALERT',
    totalBatchesAudited: reconciliationDetails.length,
    batchesWithDiscrepancy: reconciliationDetails.filter(r => r.status !== 'RECONCILED').length,
    batches: reconciliationDetails,
  };
}

module.exports = {
  getDashboardSummary,
  getSalesReport,
  getStockValuationReport,
  getExpiryReport,
  getStockReconciliationReport,
};

