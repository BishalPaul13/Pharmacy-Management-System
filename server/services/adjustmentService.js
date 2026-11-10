const { getDb } = require('../config/db');
const { logAudit } = require('../middlewares/auditLogger');

function generateAdjustmentRef(db) {
  const year = new Date().getFullYear();
  const lastAdj = db.prepare('SELECT reference_no FROM stock_adjustments WHERE reference_no LIKE ? ORDER BY id DESC LIMIT 1').get(`ADJ-${year}-%`);
  let seq = 1;
  if (lastAdj && lastAdj.reference_no) {
    const parts = lastAdj.reference_no.split('-');
    if (parts.length === 3) {
      seq = parseInt(parts[2], 10) + 1;
    }
  }
  return `ADJ-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Creates a stock adjustment or customer/supplier return.
 * Requires a mandatory reason, ensures stock never becomes negative,
 * updates batch inventory atomically, and records movement in the stock ledger.
 */
function createAdjustment(adjustmentData, user, ip = '127.0.0.1') {
  const db = getDb();

  const {
    type,
    batchId,
    quantity, // Can be positive (increase) or negative (decrease)
    reason,
    relatedSaleId = null,
  } = adjustmentData;

  // 1. Mandatory reason check
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    const err = new Error('A detailed operational reason (minimum 3 characters) is strictly mandatory for all stock adjustments and returns');
    err.statusCode = 400;
    err.code = 'MANDATORY_REASON_REQUIRED';
    throw err;
  }

  const validTypes = ['CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'EXPIRED_DISPOSAL', 'DAMAGED_WRITE_OFF', 'PHYSICAL_AUDIT_CORRECTION'];
  if (!validTypes.includes(type)) {
    const err = new Error(`Invalid adjustment type '${type}'. Allowed: ${validTypes.join(', ')}`);
    err.statusCode = 400;
    err.code = 'INVALID_ADJUSTMENT_TYPE';
    throw err;
  }

  const qtyDelta = parseInt(quantity, 10);
  if (isNaN(qtyDelta) || qtyDelta === 0) {
    const err = new Error('Adjustment quantity must be a non-zero integer');
    err.statusCode = 400;
    err.code = 'INVALID_QUANTITY';
    throw err;
  }

  // Direction validation
  if ((type === 'DAMAGED_WRITE_OFF' || type === 'EXPIRED_DISPOSAL' || type === 'SUPPLIER_RETURN') && qtyDelta > 0) {
    const err = new Error(`Adjustment type '${type}' represents stock reduction and cannot have a positive quantity.`);
    err.statusCode = 400;
    err.code = 'INVALID_DIRECTION';
    throw err;
  }

  if (type === 'CUSTOMER_RETURN' && qtyDelta < 0) {
    const err = new Error(`Customer return restores stock and cannot have a negative quantity.`);
    err.statusCode = 400;
    err.code = 'INVALID_DIRECTION';
    throw err;
  }

  const executeAdjustmentTx = db.transaction(() => {
    // Lock and check current batch
    const batch = db.prepare(`
      SELECT b.*, m.name AS medicine_name, m.sku AS medicine_sku
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      WHERE b.id = ?
    `).get(batchId);

    if (!batch) {
      const err = new Error(`Batch ID ${batchId} not found`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const newQuantity = batch.quantity + qtyDelta;

    // CRITICAL: Stock must never silently become negative!
    if (newQuantity < 0) {
      const err = new Error(`Insufficient stock in batch '${batch.batch_number}' (${batch.medicine_name}). Current quantity is ${batch.quantity}, cannot reduce by ${Math.abs(qtyDelta)}.`);
      err.statusCode = 422;
      err.code = 'NEGATIVE_STOCK_PREVENTED';
      err.details = { currentQuantity: batch.quantity, requestedReduction: Math.abs(qtyDelta), resultingQuantity: newQuantity };
      throw err;
    }

    const refNo = generateAdjustmentRef(db);

    // Determine updated batch status
    let newStatus = batch.status;
    if (newQuantity === 0) {
      newStatus = 'DEPLETED';
    } else if (type === 'CUSTOMER_RETURN' && batch.status === 'DEPLETED') {
      newStatus = 'ACTIVE';
    } else if (type === 'EXPIRED_DISPOSAL' && newQuantity === 0) {
      newStatus = 'QUARANTINED';
    }

    // Update batch quantity
    db.prepare(`
      UPDATE batches SET 
        quantity = ?,
        status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(newQuantity, newStatus, batchId);

    // Insert adjustment record
    const insertAdjStmt = db.prepare(`
      INSERT INTO stock_adjustments (
        reference_no, type, medicine_id, batch_id, quantity,
        reason, related_sale_id, performed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const adjResult = insertAdjStmt.run(
      refNo,
      type,
      batch.medicine_id,
      batchId,
      qtyDelta,
      reason.trim(),
      relatedSaleId || null,
      user.id
    );

    const adjId = adjResult.lastInsertRowid;

    // Record immutable movement in StockLedger
    db.prepare(`
      INSERT INTO stock_ledger (
        movement_type, medicine_id, batch_id, quantity_delta,
        balance_after, reference_id, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      type === 'PHYSICAL_AUDIT_CORRECTION' ? 'AUDIT_ADJUSTMENT' : type,
      batch.medicine_id,
      batchId,
      qtyDelta,
      newQuantity,
      refNo,
      `Adjustment [${type}]: ${reason.trim()}`,
      user.id
    );

    // Write audit log
    logAudit({
      user,
      ip,
      action: 'STOCK_ADJUSTMENT_EXECUTED',
      entityType: 'ADJUSTMENT',
      entityId: adjId,
      details: {
        referenceNo: refNo,
        type,
        medicine: batch.medicine_name,
        batchNumber: batch.batch_number,
        quantityDelta: qtyDelta,
        previousQuantity: batch.quantity,
        newQuantity,
        reason: reason.trim(),
      },
    });

    return adjId;
  });

  const adjId = executeAdjustmentTx();
  return getAdjustmentById(adjId);
}

function getAdjustments({ medicineId = null, batchId = null, type = null, page = 1, limit = 50 } = {}) {
  const db = getDb();
  let whereClauses = [];
  let params = [];

  if (medicineId) {
    whereClauses.push('sa.medicine_id = ?');
    params.push(medicineId);
  }

  if (batchId) {
    whereClauses.push('sa.batch_id = ?');
    params.push(batchId);
  }

  if (type) {
    whereClauses.push('sa.type = ?');
    params.push(type);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      sa.*,
      m.name AS medicine_name,
      m.sku AS medicine_sku,
      b.batch_number,
      b.expiry_date,
      u.full_name AS performed_by_name,
      u.username AS performed_by_username,
      s.invoice_no AS related_invoice_no
    FROM stock_adjustments sa
    JOIN medicines m ON sa.medicine_id = m.id
    JOIN batches b ON sa.batch_id = b.id
    JOIN users u ON sa.performed_by = u.id
    LEFT JOIN sales s ON sa.related_sale_id = s.id
    ${whereSql}
    ORDER BY sa.id DESC
    LIMIT ? OFFSET ?
  `;

  const offset = (page - 1) * limit;
  return db.prepare(sql).all(...params, limit, offset);
}

function getAdjustmentById(id) {
  const db = getDb();
  const adj = db.prepare(`
    SELECT 
      sa.*,
      m.name AS medicine_name,
      m.sku AS medicine_sku,
      b.batch_number,
      b.expiry_date,
      u.full_name AS performed_by_name,
      u.username AS performed_by_username,
      s.invoice_no AS related_invoice_no
    FROM stock_adjustments sa
    JOIN medicines m ON sa.medicine_id = m.id
    JOIN batches b ON sa.batch_id = b.id
    JOIN users u ON sa.performed_by = u.id
    LEFT JOIN sales s ON sa.related_sale_id = s.id
    WHERE sa.id = ?
  `).get(id);

  if (!adj) {
    const err = new Error(`Stock adjustment ID ${id} not found`);
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  return adj;
}

module.exports = {
  createAdjustment,
  getAdjustments,
  getAdjustmentById,
};
