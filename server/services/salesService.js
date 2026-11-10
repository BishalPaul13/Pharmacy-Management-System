const { getDb } = require('../config/db');
const { validateBatchForSale, getFefoAllocation } = require('./batchService');
const { logAudit } = require('../middlewares/auditLogger');
const config = require('../config/config');

function generateInvoiceNumber(db) {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
  const prefix = `INV-${dateStr}`;
  
  const lastInvoice = db.prepare(`
    SELECT invoice_no FROM sales 
    WHERE invoice_no LIKE ? 
    ORDER BY id DESC LIMIT 1
  `).get(`${prefix}%`);

  let nextSequence = 1;
  if (lastInvoice && lastInvoice.invoice_no) {
    const parts = lastInvoice.invoice_no.split('-');
    if (parts.length === 3) {
      nextSequence = parseInt(parts[2], 10) + 1;
    }
  }

  return `${prefix}-${String(nextSequence).padStart(4, '0')}`;
}

/**
 * Executes a complete itemized sale within an ACID database transaction.
 * Supports explicit batch selection or automatic FEFO batch allocation.
 */
function createSale(saleData, user, ip = '127.0.0.1') {
  const db = getDb();

  const {
    customerName = 'Walk-in Customer',
    customerPhone = null,
    doctorName = null,
    items, // Array of { medicineId, batchId (optional), quantity, unitPrice (optional) }
    discount = 0.0,
    paymentMethod = 'CASH',
    amountPaid,
    notes = null,
  } = saleData;

  if (!items || !Array.isArray(items) || items.length === 0) {
    const err = new Error('A sale must contain at least one item');
    err.statusCode = 400;
    err.code = 'EMPTY_CART';
    throw err;
  }

  // Use SQLite transaction to guarantee atomicity and prevent race conditions / stale availability
  const executeSaleTransaction = db.transaction(() => {
    const invoiceNo = generateInvoiceNumber(db);
    const taxRate = config.taxRate; // e.g. 10%

    let calculatedSubtotal = 0;
    let preparedItems = [];

    // Step 1: Resolve items, apply FEFO or validate explicit batch, and lock batch stock
    for (const item of items) {
      const med = db.prepare('SELECT id, name, sku FROM medicines WHERE id = ?').get(item.medicineId);
      if (!med) {
        const err = new Error(`Medicine ID ${item.medicineId} not found`);
        err.statusCode = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }

      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        const err = new Error(`Invalid quantity ${item.quantity} for medicine '${med.name}'`);
        err.statusCode = 400;
        err.code = 'INVALID_QUANTITY';
        throw err;
      }

      if (item.batchId) {
        // Explicit batch requested: validate thoroughly
        const batch = validateBatchForSale(item.batchId, qty);
        if (batch.medicine_id !== item.medicineId) {
          const err = new Error(`Batch '${batch.batch_number}' does not belong to medicine '${med.name}'`);
          err.statusCode = 400;
          err.code = 'BATCH_MISMATCH';
          throw err;
        }

        const unitPrice = item.unitPrice !== undefined ? parseFloat(item.unitPrice) : batch.sale_price;
        const lineSubtotal = unitPrice * qty;
        calculatedSubtotal += lineSubtotal;

        preparedItems.push({
          medicineId: item.medicineId,
          medicineName: med.name,
          medicineSku: med.sku,
          batchId: batch.id,
          batchNumber: batch.batch_number,
          expiryDate: batch.expiry_date,
          quantity: qty,
          unitPrice,
          costPrice: batch.cost_price,
          subtotal: lineSubtotal,
        });
      } else {
        // Automatic FEFO allocation across earliest valid expiring batches
        const fefoPlan = getFefoAllocation(item.medicineId, qty);
        for (const alloc of fefoPlan.allocations) {
          const unitPrice = item.unitPrice !== undefined ? parseFloat(item.unitPrice) : alloc.salePrice;
          const lineSubtotal = unitPrice * alloc.quantityToDeduct;
          calculatedSubtotal += lineSubtotal;

          preparedItems.push({
            medicineId: item.medicineId,
            medicineName: med.name,
            medicineSku: med.sku,
            batchId: alloc.batchId,
            batchNumber: alloc.batchNumber,
            expiryDate: alloc.expiryDate,
            quantity: alloc.quantityToDeduct,
            unitPrice,
            costPrice: alloc.costPrice,
            subtotal: lineSubtotal,
          });
        }
      }
    }

    // Step 2: Calculate tax and totals
    const discountVal = Math.max(0, parseFloat(discount) || 0);
    const taxableAmount = Math.max(0, calculatedSubtotal - discountVal);
    const taxAmount = parseFloat(((taxableAmount * taxRate) / 100).toFixed(2));
    const totalAmount = parseFloat((taxableAmount + taxAmount).toFixed(2));

    const paidVal = amountPaid !== undefined ? parseFloat(amountPaid) : totalAmount;
    if (paidVal < totalAmount) {
      const err = new Error(`Tendered amount ($${paidVal.toFixed(2)}) is less than total invoice amount ($${totalAmount.toFixed(2)})`);
      err.statusCode = 400;
      err.code = 'INSUFFICIENT_PAYMENT';
      throw err;
    }
    const changeReturned = parseFloat((paidVal - totalAmount).toFixed(2));

    // Step 3: Insert Sale Header
    const insertSaleStmt = db.prepare(`
      INSERT INTO sales (
        invoice_no, customer_name, customer_phone, doctor_name,
        subtotal, discount, tax_amount, tax_rate, total_amount,
        payment_method, amount_paid, change_returned, cashier_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const saleResult = insertSaleStmt.run(
      invoiceNo,
      customerName,
      customerPhone,
      doctorName,
      calculatedSubtotal,
      discountVal,
      taxAmount,
      taxRate,
      totalAmount,
      paymentMethod,
      paidVal,
      changeReturned,
      user.id,
      notes
    );

    const saleId = saleResult.lastInsertRowid;

    // Step 4: Insert Sale Items, deduct batch stock, and record StockLedger movements
    const insertItemStmt = db.prepare(`
      INSERT INTO sale_items (
        sale_id, medicine_id, batch_id, quantity,
        unit_price, cost_price, tax_rate, tax_amount, subtotal, total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateBatchStmt = db.prepare(`
      UPDATE batches SET 
        quantity = quantity - ?,
        status = CASE WHEN (quantity - ?) = 0 THEN 'DEPLETED' ELSE status END,
        updated_at = datetime('now')
      WHERE id = ? AND quantity >= ?
    `);

    const insertLedgerStmt = db.prepare(`
      INSERT INTO stock_ledger (
        movement_type, medicine_id, batch_id, quantity_delta,
        balance_after, reference_id, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of preparedItems) {
      const itemTaxAmount = parseFloat(((item.subtotal * taxRate) / 100).toFixed(2));
      const itemTotal = parseFloat((item.subtotal + itemTaxAmount).toFixed(2));

      insertItemStmt.run(
        saleId,
        item.medicineId,
        item.batchId,
        item.quantity,
        item.unitPrice,
        item.costPrice,
        taxRate,
        itemTaxAmount,
        item.subtotal,
        itemTotal
      );

      // Atomic update with check constraint: if quantity - item.quantity < 0, SQLite throws or 0 rows updated
      const updateResult = updateBatchStmt.run(item.quantity, item.quantity, item.batchId, item.quantity);
      if (updateResult.changes === 0) {
        const err = new Error(`Stock deduction failed for batch '${item.batchNumber}'. Quantity cannot become negative.`);
        err.statusCode = 422;
        err.code = 'NEGATIVE_STOCK_PREVENTED';
        throw err;
      }

      // Fetch the updated balance
      const updatedBatch = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(item.batchId);

      // Record immutable stock movement in the Stock Ledger
      insertLedgerStmt.run(
        'SALE',
        item.medicineId,
        item.batchId,
        -item.quantity,
        updatedBatch.quantity,
        invoiceNo,
        `Sale checkout to ${customerName} (${invoiceNo})`,
        user.id
      );
    }

    // Step 5: Audit Log
    logAudit({
      user,
      ip,
      action: 'SALE_COMPLETED',
      entityType: 'SALE',
      entityId: saleId,
      details: {
        invoiceNo,
        totalAmount,
        paymentMethod,
        itemCount: preparedItems.length,
        items: preparedItems.map(i => ({ batch: i.batchNumber, qty: i.quantity, total: i.subtotal })),
      },
    });

    return saleId;
  });

  const saleId = executeSaleTransaction();
  return getSaleById(saleId);
}

function getSales({ search = '', startDate = null, endDate = null, cashierId = null, paymentMethod = null, page = 1, limit = 50 } = {}) {
  const db = getDb();
  let whereClauses = [];
  let params = [];

  if (search) {
    whereClauses.push('(s.invoice_no LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (startDate) {
    whereClauses.push('date(s.sale_date) >= date(?)');
    params.push(startDate);
  }

  if (endDate) {
    whereClauses.push('date(s.sale_date) <= date(?)');
    params.push(endDate);
  }

  if (cashierId) {
    whereClauses.push('s.cashier_id = ?');
    params.push(cashierId);
  }

  if (paymentMethod) {
    whereClauses.push('s.payment_method = ?');
    params.push(paymentMethod);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      s.*,
      u.full_name AS cashier_name,
      COUNT(si.id) AS total_items,
      SUM(si.quantity) AS total_units_sold
    FROM sales s
    JOIN users u ON s.cashier_id = u.id
    LEFT JOIN sale_items si ON s.id = si.sale_id
    ${whereSql}
    GROUP BY s.id
    ORDER BY s.id DESC
    LIMIT ? OFFSET ?
  `;

  const offset = (page - 1) * limit;
  return db.prepare(sql).all(...params, limit, offset);
}

function getSaleById(id) {
  const db = getDb();
  const sale = db.prepare(`
    SELECT 
      s.*,
      u.full_name AS cashier_name,
      u.username AS cashier_username
    FROM sales s
    JOIN users u ON s.cashier_id = u.id
    WHERE s.id = ?
  `).get(id);

  if (!sale) {
    const err = new Error(`Sale with ID ${id} not found`);
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const items = db.prepare(`
    SELECT 
      si.*,
      m.name AS medicine_name,
      m.sku AS medicine_sku,
      m.unit_of_measure,
      m.dosage_form,
      m.strength,
      b.batch_number,
      b.expiry_date
    FROM sale_items si
    JOIN medicines m ON si.medicine_id = m.id
    JOIN batches b ON si.batch_id = b.id
    WHERE si.sale_id = ?
    ORDER BY si.id ASC
  `).all(id);

  // Return full printable invoice structure
  return {
    ...sale,
    pharmacy: {
      name: 'MediCare Pharmacy & Healthcare',
      license: 'PH-REG-2026-99042',
      gstin: '27AABCM9921D1Z8',
      address: '742 Evergreen Healthcare Blvd, Suite 100',
      phone: '+1 (555) 019-9000',
      email: 'support@medicarepharma.local',
      disclaimer: 'Notice: Fictional demonstration products. This system does not provide medical advice. Consult licensed physicians.',
    },
    items,
  };
}

module.exports = {
  createSale,
  getSales,
  getSaleById,
};

