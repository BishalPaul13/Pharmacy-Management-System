const { getDb } = require('../config/db');
const { logAudit } = require('../middlewares/auditLogger');

function generatePurchaseRef(db) {
  const year = new Date().getFullYear();
  const lastPO = db.prepare('SELECT reference_no FROM purchases WHERE reference_no LIKE ? ORDER BY id DESC LIMIT 1').get(`PO-${year}-%`);
  let seq = 1;
  if (lastPO && lastPO.reference_no) {
    const parts = lastPO.reference_no.split('-');
    if (parts.length === 3) {
      seq = parseInt(parts[2], 10) + 1;
    }
  }
  return `PO-${year}-${String(seq).padStart(3, '0')}`;
}

function createPurchase(purchaseData, user, ip = '127.0.0.1') {
  const db = getDb();

  const {
    supplierId,
    invoiceNo = null,
    purchaseDate = new Date().toISOString().split('T')[0],
    notes = null,
    items, // Array of { medicineId, batchNumber, initialQuantity, costPrice, salePrice, manufacturingDate, expiryDate }
  } = purchaseData;

  const supplier = db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(supplierId);
  if (!supplier) {
    const err = new Error(`Supplier ID ${supplierId} not found`);
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    const err = new Error('A purchase receipt must contain at least one batch item');
    err.statusCode = 400;
    err.code = 'EMPTY_PURCHASE';
    throw err;
  }

  const executePurchaseTx = db.transaction(() => {
    const referenceNo = generatePurchaseRef(db);
    let totalCost = 0;

    for (const item of items) {
      const qty = parseInt(item.initialQuantity || item.quantity, 10);
      const cost = parseFloat(item.costPrice);
      if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
        const err = new Error('Invalid quantity or cost price in purchase items');
        err.statusCode = 400;
        err.code = 'INVALID_ITEM';
        throw err;
      }
      totalCost += qty * cost;
    }

    // Insert purchase header
    const insertPOStmt = db.prepare(`
      INSERT INTO purchases (
        reference_no, supplier_id, invoice_no, purchase_date,
        total_cost, notes, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'RECEIVED', ?)
    `);

    const poResult = insertPOStmt.run(
      referenceNo,
      supplierId,
      invoiceNo,
      purchaseDate,
      totalCost,
      notes,
      user.id
    );

    const purchaseId = poResult.lastInsertRowid;

    // Insert batches and stock ledger
    const insertBatchStmt = db.prepare(`
      INSERT INTO batches (
        medicine_id, purchase_id, batch_number, initial_quantity,
        quantity, cost_price, sale_price, manufacturing_date, expiry_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `);

    const updateBatchStmt = db.prepare(`
      UPDATE batches SET 
        quantity = quantity + ?,
        initial_quantity = initial_quantity + ?,
        cost_price = ?,
        sale_price = ?,
        status = 'ACTIVE',
        updated_at = datetime('now')
      WHERE id = ?
    `);

    const insertLedgerStmt = db.prepare(`
      INSERT INTO stock_ledger (
        movement_type, medicine_id, batch_id, quantity_delta,
        balance_after, reference_id, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const qty = parseInt(item.initialQuantity || item.quantity, 10);
      const cost = parseFloat(item.costPrice);
      const price = parseFloat(item.salePrice);

      // Check if batch already exists for this medicine
      const existingBatch = db.prepare('SELECT id, quantity FROM batches WHERE medicine_id = ? AND batch_number = ?').get(item.medicineId, item.batchNumber);

      let batchId;
      let newBalance;

      if (existingBatch) {
        updateBatchStmt.run(qty, qty, cost, price, existingBatch.id);
        batchId = existingBatch.id;
        newBalance = existingBatch.quantity + qty;
      } else {
        const res = insertBatchStmt.run(
          item.medicineId,
          purchaseId,
          item.batchNumber,
          qty,
          qty,
          cost,
          price,
          item.manufacturingDate,
          item.expiryDate
        );
        batchId = res.lastInsertRowid;
        newBalance = qty;
      }

      insertLedgerStmt.run(
        'PURCHASE',
        item.medicineId,
        batchId,
        qty,
        newBalance,
        referenceNo,
        `Inward shipment received from ${supplier.name} (${referenceNo})`,
        user.id
      );
    }

    logAudit({
      user,
      ip,
      action: 'PURCHASE_RECEIVED',
      entityType: 'PURCHASE',
      entityId: purchaseId,
      details: {
        referenceNo,
        supplier: supplier.name,
        totalCost,
        itemCount: items.length,
      },
    });

    return purchaseId;
  });

  const purchaseId = executePurchaseTx();
  return getPurchaseById(purchaseId);
}

function getPurchases({ supplierId = null, page = 1, limit = 50 } = {}) {
  const db = getDb();
  let whereClauses = [];
  let params = [];

  if (supplierId) {
    whereClauses.push('p.supplier_id = ?');
    params.push(supplierId);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      p.*,
      s.name AS supplier_name,
      s.code AS supplier_code,
      u.full_name AS received_by_name,
      COUNT(b.id) AS total_batches_received
    FROM purchases p
    JOIN suppliers s ON p.supplier_id = s.id
    JOIN users u ON p.created_by = u.id
    LEFT JOIN batches b ON p.id = b.purchase_id
    ${whereSql}
    GROUP BY p.id
    ORDER BY p.id DESC
    LIMIT ? OFFSET ?
  `;

  const offset = (page - 1) * limit;
  return db.prepare(sql).all(...params, limit, offset);
}

function getPurchaseById(id) {
  const db = getDb();
  const purchase = db.prepare(`
    SELECT 
      p.*,
      s.name AS supplier_name,
      s.code AS supplier_code,
      s.contact_person AS supplier_contact,
      s.phone AS supplier_phone,
      u.full_name AS received_by_name
    FROM purchases p
    JOIN suppliers s ON p.supplier_id = s.id
    JOIN users u ON p.created_by = u.id
    WHERE p.id = ?
  `).get(id);

  if (!purchase) {
    const err = new Error(`Purchase record ID ${id} not found`);
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const batches = db.prepare(`
    SELECT 
      b.*,
      m.name AS medicine_name,
      m.sku AS medicine_sku,
      m.unit_of_measure
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.purchase_id = ?
    ORDER BY b.id ASC
  `).all(id);

  return {
    ...purchase,
    items: batches,
  };
}

module.exports = {
  createPurchase,
  getPurchases,
  getPurchaseById,
};
