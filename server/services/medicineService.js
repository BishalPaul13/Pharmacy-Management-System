const { getDb } = require('../config/db');
const { logAudit } = require('../middlewares/auditLogger');

function getMedicines({ search = '', categoryId = null, lowStockOnly = false, page = 1, limit = 50 } = {}) {
  const db = getDb();
  let whereClauses = [];
  let params = [];

  if (search) {
    whereClauses.push('(m.name LIKE ? OR m.generic_name LIKE ? OR m.sku LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (categoryId) {
    whereClauses.push('m.category_id = ?');
    params.push(categoryId);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      m.*,
      c.name AS category_name,
      COALESCE(SUM(CASE WHEN b.status = 'ACTIVE' AND date(b.expiry_date) > date('now') THEN b.quantity ELSE 0 END), 0) AS total_active_stock,
      COALESCE(SUM(CASE WHEN date(b.expiry_date) <= date('now') THEN b.quantity ELSE 0 END), 0) AS expired_stock,
      COUNT(DISTINCT b.id) AS total_batches,
      MIN(CASE WHEN b.status = 'ACTIVE' AND b.quantity > 0 AND date(b.expiry_date) > date('now') THEN b.expiry_date ELSE NULL END) AS earliest_expiry,
      MIN(CASE WHEN b.status = 'ACTIVE' AND b.quantity > 0 THEN b.sale_price ELSE NULL END) AS min_sale_price,
      MAX(CASE WHEN b.status = 'ACTIVE' AND b.quantity > 0 THEN b.sale_price ELSE NULL END) AS max_sale_price
    FROM medicines m
    JOIN categories c ON m.category_id = c.id
    LEFT JOIN batches b ON m.id = b.medicine_id
    ${whereSql}
    GROUP BY m.id
    ${lowStockOnly ? 'HAVING total_active_stock <= m.reorder_level' : ''}
    ORDER BY m.name ASC
    LIMIT ? OFFSET ?
  `;

  const offset = (page - 1) * limit;
  const medicines = db.prepare(sql).all(...params, limit, offset);

  // Annotate with stock status
  return medicines.map(med => {
    let stockStatus = 'IN_STOCK';
    if (med.total_active_stock === 0) {
      stockStatus = 'OUT_OF_STOCK';
    } else if (med.total_active_stock <= med.reorder_level) {
      stockStatus = 'LOW_STOCK';
    }

    return {
      ...med,
      stock_status: stockStatus,
      is_low_stock: med.total_active_stock <= med.reorder_level,
    };
  });
}

function getMedicineById(id) {
  const db = getDb();
  const medicine = db.prepare(`
    SELECT 
      m.*,
      c.name AS category_name,
      COALESCE(SUM(CASE WHEN b.status = 'ACTIVE' AND date(b.expiry_date) > date('now') THEN b.quantity ELSE 0 END), 0) AS total_active_stock,
      COALESCE(SUM(CASE WHEN date(b.expiry_date) <= date('now') THEN b.quantity ELSE 0 END), 0) AS expired_stock
    FROM medicines m
    JOIN categories c ON m.category_id = c.id
    LEFT JOIN batches b ON m.id = b.medicine_id
    WHERE m.id = ?
    GROUP BY m.id
  `).get(id);

  if (!medicine) {
    const err = new Error(`Medicine with ID ${id} not found`);
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const batches = db.prepare(`
    SELECT b.*, 
      ROUND((julianday(b.expiry_date) - julianday('now'))) AS days_to_expiry
    FROM batches b
    WHERE b.medicine_id = ?
    ORDER BY b.expiry_date ASC
  `).all(id);

  return {
    ...medicine,
    batches,
  };
}

function createMedicine(data, user, ip) {
  const db = getDb();

  // Validate unique SKU
  const existing = db.prepare('SELECT id FROM medicines WHERE sku = ?').get(data.sku);
  if (existing) {
    const err = new Error(`Medicine with SKU '${data.sku}' already exists`);
    err.statusCode = 409;
    err.code = 'DUPLICATE_SKU';
    throw err;
  }

  const stmt = db.prepare(`
    INSERT INTO medicines (
      sku, name, generic_name, category_id, dosage_form, strength,
      unit_of_measure, reorder_level, prescription_required, shelf_location, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.sku,
    data.name,
    data.generic_name,
    data.category_id,
    data.dosage_form,
    data.strength,
    data.unit_of_measure || 'Units',
    data.reorder_level !== undefined ? data.reorder_level : 20,
    data.prescription_required ? 1 : 0,
    data.shelf_location || null,
    data.description || null
  );

  const newMed = getMedicineById(result.lastInsertRowid);

  logAudit({
    user,
    ip,
    action: 'MEDICINE_CREATED',
    entityType: 'MEDICINE',
    entityId: newMed.id,
    details: { sku: newMed.sku, name: newMed.name },
  });

  return newMed;
}

function updateMedicine(id, data, user, ip) {
  const db = getDb();
  const existing = getMedicineById(id);

  const stmt = db.prepare(`
    UPDATE medicines SET
      name = COALESCE(?, name),
      generic_name = COALESCE(?, generic_name),
      category_id = COALESCE(?, category_id),
      dosage_form = COALESCE(?, dosage_form),
      strength = COALESCE(?, strength),
      unit_of_measure = COALESCE(?, unit_of_measure),
      reorder_level = COALESCE(?, reorder_level),
      prescription_required = COALESCE(?, prescription_required),
      shelf_location = COALESCE(?, shelf_location),
      description = COALESCE(?, description),
      updated_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(
    data.name || null,
    data.generic_name || null,
    data.category_id || null,
    data.dosage_form || null,
    data.strength || null,
    data.unit_of_measure || null,
    data.reorder_level !== undefined ? data.reorder_level : null,
    data.prescription_required !== undefined ? (data.prescription_required ? 1 : 0) : null,
    data.shelf_location !== undefined ? data.shelf_location : null,
    data.description !== undefined ? data.description : null,
    id
  );

  const updated = getMedicineById(id);

  logAudit({
    user,
    ip,
    action: 'MEDICINE_UPDATED',
    entityType: 'MEDICINE',
    entityId: id,
    details: { changes: data },
  });

  return updated;
}

module.exports = {
  getMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
};

