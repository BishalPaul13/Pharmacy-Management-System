const { getDb } = require('../config/db');
const { logAudit } = require('../middlewares/auditLogger');
const config = require('../config/config');

function getBatches({ medicineId = null, status = null, nearExpiryDays = null, expiredOnly = false, page = 1, limit = 50 } = {}) {
  const db = getDb();
  let whereClauses = [];
  let params = [];

  if (medicineId) {
    whereClauses.push('b.medicine_id = ?');
    params.push(medicineId);
  }

  if (status) {
    whereClauses.push('b.status = ?');
    params.push(status);
  }

  if (expiredOnly) {
    whereClauses.push("date(b.expiry_date) <= date('now')");
  } else if (nearExpiryDays) {
    whereClauses.push("date(b.expiry_date) > date('now') AND julianday(b.expiry_date) - julianday('now') <= ?");
    params.push(nearExpiryDays);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      b.*,
      m.name AS medicine_name,
      m.sku AS medicine_sku,
      m.unit_of_measure,
      c.name AS category_name,
      p.reference_no AS purchase_reference,
      ROUND(julianday(b.expiry_date) - julianday('now')) AS days_to_expiry,
      CASE 
        WHEN date(b.expiry_date) <= date('now') THEN 'EXPIRED'
        WHEN julianday(b.expiry_date) - julianday('now') <= 15 THEN 'CRITICAL_EXPIRY'
        WHEN julianday(b.expiry_date) - julianday('now') <= 60 THEN 'NEAR_EXPIRY'
        ELSE 'SAFE'
      END AS expiry_urgency
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    JOIN categories c ON m.category_id = c.id
    LEFT JOIN purchases p ON b.purchase_id = p.id
    ${whereSql}
    ORDER BY b.expiry_date ASC, b.id ASC
    LIMIT ? OFFSET ?
  `;

  const offset = (page - 1) * limit;
  return db.prepare(sql).all(...params, limit, offset);
}

function getBatchById(id) {
  const db = getDb();
  const batch = db.prepare(`
    SELECT 
      b.*,
      m.name AS medicine_name,
      m.sku AS medicine_sku,
      m.unit_of_measure,
      c.name AS category_name,
      p.reference_no AS purchase_reference,
      ROUND(julianday(b.expiry_date) - julianday('now')) AS days_to_expiry,
      CASE 
        WHEN date(b.expiry_date) <= date('now') THEN 'EXPIRED'
        WHEN julianday(b.expiry_date) - julianday('now') <= 15 THEN 'CRITICAL_EXPIRY'
        WHEN julianday(b.expiry_date) - julianday('now') <= 60 THEN 'NEAR_EXPIRY'
        ELSE 'SAFE'
      END AS expiry_urgency
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    JOIN categories c ON m.category_id = c.id
    LEFT JOIN purchases p ON b.purchase_id = p.id
    WHERE b.id = ?
  `).get(id);

  if (!batch) {
    const err = new Error(`Batch with ID ${id} not found`);
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  return batch;
}

/**
 * FEFO (First-Expiry-First-Out) Engine
 * Automatically queries and allocates stock starting with the valid active batch
 * that expires soonest, skipping any expired or quarantined batches.
 * 
 * Returns an allocation plan:
 * [
 *   { batchId, batchNumber, expiryDate, daysToExpiry, quantityToDeduct, unitPrice, costPrice, availableQuantity }
 * ]
 */
function getFefoAllocation(medicineId, requestedQuantity) {
  const db = getDb();

  // Validate medicine exists
  const medicine = db.prepare('SELECT id, name FROM medicines WHERE id = ?').get(medicineId);
  if (!medicine) {
    const err = new Error(`Medicine with ID ${medicineId} not found`);
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (requestedQuantity <= 0) {
    const err = new Error('Requested quantity must be greater than zero');
    err.statusCode = 400;
    err.code = 'INVALID_QUANTITY';
    throw err;
  }

  // Query batches ordered strictly by FEFO: expiry_date ASC
  // STRICT RULE: Only active batches with positive stock AND expiry_date > today!
  const batches = db.prepare(`
    SELECT 
      b.*,
      ROUND(julianday(b.expiry_date) - julianday('now')) AS days_to_expiry
    FROM batches b
    WHERE b.medicine_id = ?
      AND b.status = 'ACTIVE'
      AND b.quantity > 0
      AND date(b.expiry_date) > date('now')
    ORDER BY b.expiry_date ASC, b.id ASC
  `).all(medicineId);

  const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);

  if (totalAvailable < requestedQuantity) {
    // Check if there are expired batches that were excluded
    const expiredCount = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(quantity), 0) as expired_qty 
      FROM batches 
      WHERE medicine_id = ? AND date(expiry_date) <= date('now') AND quantity > 0
    `).get(medicineId);

    const err = new Error(`Insufficient stock for '${medicine.name}'. Requested: ${requestedQuantity}, Available valid stock: ${totalAvailable}` +
      (expiredCount.count > 0 ? ` (${expiredCount.expired_qty} units in expired batches are blocked from dispensing)` : ''));
    err.statusCode = 422;
    err.code = 'INSUFFICIENT_STOCK';
    err.details = { requestedQuantity, availableQuantity: totalAvailable, expiredQuantity: expiredCount.expired_qty };
    throw err;
  }

  // Allocate across batches
  let remainingNeeded = requestedQuantity;
  const allocations = [];

  for (const batch of batches) {
    if (remainingNeeded <= 0) break;

    const deductQty = Math.min(batch.quantity, remainingNeeded);
    allocations.push({
      batchId: batch.id,
      batchNumber: batch.batch_number,
      expiryDate: batch.expiry_date,
      daysToExpiry: batch.days_to_expiry,
      availableQuantity: batch.quantity,
      quantityToDeduct: deductQty,
      salePrice: batch.sale_price,
      costPrice: batch.cost_price,
    });

    remainingNeeded -= deductQty;
  }

  return {
    medicineId,
    medicineName: medicine.name,
    requestedQuantity,
    allocations,
  };
}

/**
 * Validates a specific batch for sale:
 * Ensures it exists, is ACTIVE, not expired, and has sufficient stock.
 */
function validateBatchForSale(batchId, quantity) {
  const db = getDb();
  const batch = db.prepare(`
    SELECT b.*, m.name as medicine_name,
      ROUND(julianday(b.expiry_date) - julianday('now')) AS days_to_expiry
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.id = ?
  `).get(batchId);

  if (!batch) {
    const err = new Error(`Batch with ID ${batchId} not found`);
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // 1. Expired check
  const today = new Date().toISOString().split('T')[0];
  if (batch.expiry_date <= today || batch.status === 'EXPIRED') {
    const err = new Error(`BATCH EXPIRED: Batch '${batch.batch_number}' for '${batch.medicine_name}' expired on ${batch.expiry_date} and CANNOT be sold.`);
    err.statusCode = 422;
    err.code = 'EXPIRED_BATCH_BLOCKED';
    err.details = {
      batchId: batch.id,
      batchNumber: batch.batch_number,
      expiryDate: batch.expiry_date,
      medicineName: batch.medicine_name,
    };
    throw err;
  }

  // 2. Status check
  if (batch.status !== 'ACTIVE') {
    const err = new Error(`Batch '${batch.batch_number}' is marked as '${batch.status}' and cannot be sold.`);
    err.statusCode = 422;
    err.code = 'BATCH_NOT_ACTIVE';
    throw err;
  }

  // 3. Quantity check
  if (batch.quantity < quantity) {
    const err = new Error(`Insufficient quantity in batch '${batch.batch_number}'. Requested: ${quantity}, Available: ${batch.quantity}`);
    err.statusCode = 422;
    err.code = 'INSUFFICIENT_BATCH_STOCK';
    err.details = { batchId: batch.id, requestedQuantity: quantity, availableQuantity: batch.quantity };
    throw err;
  }

  return batch;
}

/**
 * Quarantine or change batch status (e.g. for recall or damaged goods)
 */
function updateBatchStatus(batchId, newStatus, reason, user, ip) {
  const db = getDb();
  const batch = getBatchById(batchId);

  db.prepare(`
    UPDATE batches SET 
      status = ?, 
      updated_at = datetime('now') 
    WHERE id = ?
  `).run(newStatus, batchId);

  logAudit({
    user,
    ip,
    action: 'BATCH_STATUS_CHANGED',
    entityType: 'BATCH',
    entityId: batchId,
    details: {
      batchNumber: batch.batch_number,
      previousStatus: batch.status,
      newStatus,
      reason,
    },
  });

  return getBatchById(batchId);
}

module.exports = {
  getBatches,
  getBatchById,
  getFefoAllocation,
  validateBatchForSale,
  updateBatchStatus,
};
