const bcrypt = require('bcryptjs');
const { getDb } = require('../config/db');
const { runMigrations } = require('./migrate');

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function seedDatabase(dbInstance = null) {
  const db = dbInstance || getDb();
  runMigrations(db);

  console.log('Seeding database with test & operational data...');

  const clearExisting = db.transaction(() => {
    db.prepare('DELETE FROM audit_logs').run();
    db.prepare('DELETE FROM stock_ledger').run();
    db.prepare('DELETE FROM stock_adjustments').run();
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM batches').run();
    db.prepare('DELETE FROM purchases').run();
    db.prepare('DELETE FROM medicines').run();
    db.prepare('DELETE FROM suppliers').run();
    db.prepare('DELETE FROM categories').run();
    db.prepare('DELETE FROM users').run();
  });
  clearExisting();

  // 1. Users
  const passwordSalt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('admin123', passwordSalt);
  const pharmHash = bcrypt.hashSync('pharm123', passwordSalt);
  const cashHash = bcrypt.hashSync('cash123', passwordSalt);

  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, email, phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const adminUser = insertUser.run('admin', adminHash, 'System Administrator', 'ADMIN', 'admin@pharmacy.local', '+1-555-0101');
  const pharmUser = insertUser.run('pharmacist', pharmHash, 'Senior Pharmacist Sarah', 'PHARMACIST', 'sarah@pharmacy.local', '+1-555-0102');
  const cashUser = insertUser.run('cashier', cashHash, 'POS Cashier Alex', 'CASHIER', 'alex@pharmacy.local', '+1-555-0103');

  const adminId = adminUser.lastInsertRowid;
  const pharmId = pharmUser.lastInsertRowid;
  const cashId = cashUser.lastInsertRowid;

  // 2. Categories
  const insertCat = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
  const catAntibiotics = insertCat.run('Antibiotics', 'Bacterial infection treatments').lastInsertRowid;
  const catAnalgesics = insertCat.run('Analgesics & Antipyretics', 'Pain and fever relief medications').lastInsertRowid;
  const catCardio = insertCat.run('Cardiovascular', 'Heart and blood pressure management').lastInsertRowid;
  const catAntidiabetic = insertCat.run('Antidiabetic', 'Blood glucose regulation therapy').lastInsertRowid;
  const catRespiratory = insertCat.run('Respiratory', 'Asthma and allergy treatments').lastInsertRowid;
  const catGastro = insertCat.run('Gastrointestinal', 'Acid reflux and digestive relief').lastInsertRowid;
  const catVitamins = insertCat.run('Vitamins & Supplements', 'Nutritional and wellness supplements').lastInsertRowid;

  // 3. Suppliers
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (name, code, contact_person, phone, email, address, tax_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sup1 = insertSupplier.run('MediPharma Direct', 'SUP-MPD-01', 'David Ross', '+1-800-555-0191', 'orders@medipharma.com', '124 Industrial Way, Pharma City', 'TAX-998811', 'ACTIVE').lastInsertRowid;
  const sup2 = insertSupplier.run('Apex Health Supplies', 'SUP-AHS-02', 'Elena Gomez', '+1-800-555-0192', 'supply@apexhealth.com', '78 Healthcare Blvd, Metro', 'TAX-998822', 'ACTIVE').lastInsertRowid;
  const sup3 = insertSupplier.run('BioCare Global Labs', 'SUP-BCG-03', 'Dr. Ken Wu', '+1-800-555-0193', 'contact@biocareglobal.com', '45 Biotech Park, Science Bay', 'TAX-998833', 'ACTIVE').lastInsertRowid;

  // 4. Fictional Medicines
  const insertMed = db.prepare(`
    INSERT INTO medicines (sku, name, generic_name, category_id, dosage_form, strength, unit_of_measure, reorder_level, prescription_required, shelf_location, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const medAmox = insertMed.run('MED-AMX-500', 'Amoxicillin 500mg', 'Amoxicillin Trihydrate', catAntibiotics, 'Capsule', '500mg', 'Strip of 10', 25, 1, 'Shelf A-12', 'Fictional broad-spectrum antibiotic capsule. Not medical advice.').lastInsertRowid;
  const medPara = insertMed.run('MED-PAR-650', 'Paracetamol 650mg', 'Acetaminophen', catAnalgesics, 'Tablet', '650mg', 'Strip of 15', 30, 0, 'Shelf B-04', 'Fictional fever and mild pain relief tablet. Not medical advice.').lastInsertRowid;
  const medAtor = insertMed.run('MED-ATV-020', 'Atorvastatin 20mg', 'Atorvastatin Calcium', catCardio, 'Tablet', '20mg', 'Strip of 10', 15, 1, 'Shelf C-08', 'Fictional lipid-lowering cardiovascular agent. Not medical advice.').lastInsertRowid;
  const medMetf = insertMed.run('MED-MTF-500', 'Metformin 500mg', 'Metformin Hydrochloride', catAntidiabetic, 'Tablet', '500mg', 'Strip of 20', 20, 1, 'Shelf C-15', 'Fictional type 2 diabetes management tablet. Not medical advice.').lastInsertRowid;
  const medCeti = insertMed.run('MED-CTZ-010', 'Cetirizine 10mg', 'Cetirizine Hydrochloride', catRespiratory, 'Tablet', '10mg', 'Strip of 10', 20, 0, 'Shelf B-11', 'Fictional anti-allergy antihistamine tablet. Not medical advice.').lastInsertRowid;
  const medOmep = insertMed.run('MED-OMP-020', 'Omeprazole 20mg', 'Omeprazole', catGastro, 'Capsule', '20mg', 'Strip of 14', 15, 0, 'Shelf D-02', 'Fictional proton pump inhibitor for gastric acid. Not medical advice.').lastInsertRowid;
  const medSalb = insertMed.run('MED-SLB-100', 'Salbutamol Inhaler', 'Albuterol Sulfate', catRespiratory, 'Inhaler', '100mcg', 'Canister (200 doses)', 10, 1, 'Cold Storage 1', 'Fictional bronchodilator aerosol inhaler. Not medical advice.').lastInsertRowid;
  const medVita = insertMed.run('MED-VIT-300', 'Multi-Immune VitaSyrup', 'Multivitamins & Zinc', catVitamins, 'Syrup', '300ml', 'Bottle', 12, 0, 'Shelf E-01', 'Fictional wellness dietary multivitamin syrup. Not medical advice.').lastInsertRowid;
  const medCipro = insertMed.run('MED-CPR-003', 'Ciprofloxacin Eye Drops', 'Ciprofloxacin 0.3%', catAntibiotics, 'Drops', '0.3%', 'Vial 5ml', 10, 1, 'Shelf A-05', 'Fictional ophthalmic antibiotic drops. Not medical advice.').lastInsertRowid;

  // 5. Inward Purchases
  const insertPO = db.prepare(`
    INSERT INTO purchases (reference_no, supplier_id, invoice_no, purchase_date, total_cost, notes, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const po1 = insertPO.run('PO-2026-001', sup1, 'INV-SUP-8821', addDays(-60), 3450.00, 'Initial bulk stocking order', 'RECEIVED', pharmId).lastInsertRowid;
  const po2 = insertPO.run('PO-2026-002', sup2, 'INV-SUP-9104', addDays(-30), 1820.00, 'Monthly replenishment order', 'RECEIVED', pharmId).lastInsertRowid;

  // 6. Batches with distinct scenarios
  const insertBatch = db.prepare(`
    INSERT INTO batches (medicine_id, purchase_id, batch_number, initial_quantity, quantity, cost_price, sale_price, manufacturing_date, expiry_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLedger = db.prepare(`
    INSERT INTO stock_ledger (movement_type, medicine_id, batch_id, quantity_delta, balance_after, reference_id, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  // Helper to add batch and initial purchase ledger entry
  function createBatchWithLedger(medId, poId, batchNo, initQty, curQty, cost, price, mfdDays, expDays, status, notes = 'Initial Stock Receipt') {
    const batchRes = insertBatch.run(medId, poId, batchNo, initQty, curQty, cost, price, addDays(mfdDays), addDays(expDays), status);
    const batchId = batchRes.lastInsertRowid;
    insertLedger.run('PURCHASE', medId, batchId, initQty, initQty, poId ? `PO-${poId}` : 'OPENING-STK', notes, pharmId, '-30 days');
    return batchId;
  }

  // A. Amoxicillin: Demonstrates FEFO across 3 active batches with different expiry dates!
  // Batch 1: Expiring soonest (in 30 days) -> starts at 50, after sale1 becomes 45
  const bAmox1 = createBatchWithLedger(medAmox, po1, 'AMX-B26-01', 50, 45, 12.00, 22.00, -180, 30, 'ACTIVE', 'FEFO Primary - Expiring in 30 days');
  // Batch 2: Expiring in 180 days -> starts at 100
  const bAmox2 = createBatchWithLedger(medAmox, po1, 'AMX-B26-02', 100, 100, 12.50, 22.00, -90, 180, 'ACTIVE', 'FEFO Secondary - Expiring in 180 days');
  // Batch 3: Expiring in 450 days -> starts at 100
  const bAmox3 = createBatchWithLedger(medAmox, po2, 'AMX-B26-03', 100, 100, 13.00, 24.00, -30, 450, 'ACTIVE', 'FEFO Long-term');

  // B. Paracetamol: Ample stock, active (120 initial, 100 after sale1)
  const bPara1 = createBatchWithLedger(medPara, po1, 'PAR-B26-10', 120, 100, 4.00, 9.50, -120, 365, 'ACTIVE');

  // C. Atorvastatin: Near-Expiry demonstration! (Expires in 15 days, 40 initial, 32 after past sale)
  const bAtor1 = createBatchWithLedger(medAtor, po1, 'ATV-B26-01', 40, 32, 18.00, 35.00, -300, 15, 'ACTIVE', 'Near-expiry batch alert test');

  // D. Metformin: Already EXPIRED batch demonstration! (Expired 10 days ago, 30 initial, 25 after quarantine adjustment)
  const bMetfExpired = createBatchWithLedger(medMetf, po1, 'MTF-B25-OLD', 30, 25, 8.00, 16.00, -400, -10, 'EXPIRED', 'Expired batch test fixture');
  // And a fresh active batch for Metformin
  const bMetfActive = createBatchWithLedger(medMetf, po2, 'MTF-B26-NEW', 60, 60, 8.50, 16.50, -20, 400, 'ACTIVE');

  // E. Cetirizine: LOW STOCK demonstration! Initial 50, 5 remaining after sales
  const bCeti1 = createBatchWithLedger(medCeti, po1, 'CTZ-B26-05', 50, 5, 3.50, 8.00, -150, 240, 'ACTIVE', 'Low stock threshold alert fixture');

  // F. Omeprazole: Initial 80, 75 after damaged write-off
  const bOmep1 = createBatchWithLedger(medOmep, po2, 'OMP-B26-22', 80, 75, 10.00, 21.00, -60, 300, 'ACTIVE');

  // G. Salbutamol Inhaler: Critical Expiry demonstration (Expires in 5 days, 25 initial, 18 after past sale)
  const bSalb1 = createBatchWithLedger(medSalb, po2, 'SLB-B26-01', 25, 18, 45.00, 85.00, -200, 5, 'ACTIVE', 'Critical near-expiry alert fixture');

  // H. Multi-Immune VitaSyrup: Normal stock
  const bVita1 = createBatchWithLedger(medVita, po2, 'VIT-B26-88', 35, 35, 25.00, 48.00, -45, 360, 'ACTIVE');

  // I. Ciprofloxacin: OUT OF STOCK fixture (30 initial, 0 remaining after past sales)
  const bCipro1 = createBatchWithLedger(medCipro, po1, 'CPR-B26-00', 30, 0, 7.00, 15.00, -200, 120, 'DEPLETED', 'Depleted out-of-stock fixture');

  // 7. Initial Sales and historical movements for 100% stock reconciliation
  const insertSale = db.prepare(`
    INSERT INTO sales (invoice_no, customer_name, customer_phone, doctor_name, sale_date, subtotal, discount, tax_amount, tax_rate, total_amount, payment_method, amount_paid, change_returned, cashier_id, notes)
    VALUES (?, ?, ?, ?, datetime('now', ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (sale_id, medicine_id, batch_id, quantity, unit_price, cost_price, tax_rate, tax_amount, subtotal, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Sale 1: Sold 5 units of Amoxicillin from bAmox1 and 20 units of Paracetamol from bPara1
  const sale1 = insertSale.run('INV-202611-0001', 'John Doe', '+1-555-8801', 'Dr. Adams', '-2 days', 300.00, 0.00, 30.00, 10.0, 330.00, 'CASH', 350.00, 20.00, cashId, 'Standard walk-in customer sale').lastInsertRowid;
  insertSaleItem.run(sale1, medAmox, bAmox1, 5, 22.00, 12.00, 10.0, 11.00, 110.00, 121.00);
  insertSaleItem.run(sale1, medPara, bPara1, 20, 9.50, 4.00, 10.0, 19.00, 190.00, 209.00);
  insertLedger.run('SALE', medAmox, bAmox1, -5, 45, 'INV-202611-0001', 'Sale to John Doe', cashId, '-2 days');
  insertLedger.run('SALE', medPara, bPara1, -20, 100, 'INV-202611-0001', 'Sale to John Doe', cashId, '-2 days');

  // Sale 2: Historical sale for Atorvastatin (8 units) and Salbutamol (7 units)
  const sale2 = insertSale.run('INV-202611-0002', 'Robert Taylor', '+1-555-8802', 'Dr. Smith', '-10 days', 875.00, 0.00, 87.50, 10.0, 962.50, 'CARD', 962.50, 0.00, cashId, 'Prescription dispensing').lastInsertRowid;
  insertSaleItem.run(sale2, medAtor, bAtor1, 8, 35.00, 18.00, 10.0, 28.00, 280.00, 308.00);
  insertSaleItem.run(sale2, medSalb, bSalb1, 7, 85.00, 45.00, 10.0, 59.50, 595.00, 654.50);
  insertLedger.run('SALE', medAtor, bAtor1, -8, 32, 'INV-202611-0002', 'Sale to Robert Taylor', cashId, '-10 days');
  insertLedger.run('SALE', medSalb, bSalb1, -7, 18, 'INV-202611-0002', 'Sale to Robert Taylor', cashId, '-10 days');

  // Sale 3: Historical sale for Cetirizine (45 units sold) and Ciprofloxacin (30 units sold to depletion)
  const sale3 = insertSale.run('INV-202611-0003', 'Community Health Clinic', '+1-555-8803', 'Dr. Patel', '-15 days', 810.00, 0.00, 81.00, 10.0, 891.00, 'UPI', 891.00, 0.00, cashId, 'Bulk institutional order').lastInsertRowid;
  insertSaleItem.run(sale3, medCeti, bCeti1, 45, 8.00, 3.50, 10.0, 36.00, 360.00, 396.00);
  insertSaleItem.run(sale3, medCipro, bCipro1, 30, 15.00, 7.00, 10.0, 45.00, 450.00, 495.00);
  insertLedger.run('SALE', medCeti, bCeti1, -45, 5, 'INV-202611-0003', 'Bulk clinic dispensing', cashId, '-15 days');
  insertLedger.run('SALE', medCipro, bCipro1, -30, 0, 'INV-202611-0003', 'Bulk clinic dispensing', cashId, '-15 days');

  // 8. Stock Adjustments (Damaged write-off & expired disposal with mandatory reasons)
  const insertAdj = db.prepare(`
    INSERT INTO stock_adjustments (reference_no, type, medicine_id, batch_id, quantity, reason, performed_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  // Adjustment 1: Omeprazole Damaged Write-off (5 units)
  insertAdj.run('ADJ-2026-0001', 'DAMAGED_WRITE_OFF', medOmep, bOmep1, -5, 'Damaged carton during warehouse reorganization; inspected and safely discarded', pharmId, '-5 days');
  insertLedger.run('DAMAGED_WRITE_OFF', medOmep, bOmep1, -5, 75, 'ADJ-2026-0001', 'Damaged write-off: Damaged carton', pharmId, '-5 days');

  // Adjustment 2: Metformin Expired Disposal write-down (5 units)
  insertAdj.run('ADJ-2026-0002', 'EXPIRED_DISPOSAL', medMetf, bMetfExpired, -5, 'Partial sample packaging disposed following regulatory inspection', pharmId, '-4 days');
  insertLedger.run('EXPIRED_DISPOSAL', medMetf, bMetfExpired, -5, 25, 'ADJ-2026-0002', 'Expired batch partial disposal', pharmId, '-4 days');

  // 9. Initial Audit Log Entries
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_id, username, role, action, entity_type, entity_id, details, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  insertAudit.run(adminId, 'admin', 'ADMIN', 'SYSTEM_INITIALIZATION', 'SYSTEM', '1', JSON.stringify({ message: 'Pharmacy database seeded with operational catalogue and stock' }), '127.0.0.1', '-30 days');
  insertAudit.run(pharmId, 'pharmacist', 'PHARMACIST', 'PURCHASE_RECEIPT', 'PURCHASE', 'PO-2026-001', JSON.stringify({ reference: 'PO-2026-001', supplier: 'MediPharma Direct', total: 3450.00 }), '127.0.0.1', '-30 days');
  insertAudit.run(cashId, 'cashier', 'CASHIER', 'SALE_COMPLETED', 'SALE', 'INV-202611-0001', JSON.stringify({ invoice: 'INV-202611-0001', total: 330.00, items: 2 }), '127.0.0.1', '-2 days');
  insertAudit.run(pharmId, 'pharmacist', 'PHARMACIST', 'STOCK_ADJUSTMENT', 'ADJUSTMENT', 'ADJ-2026-0001', JSON.stringify({ type: 'DAMAGED_WRITE_OFF', batch: 'OMP-B26-22', quantity: -5, reason: 'Damaged carton' }), '127.0.0.1', '-5 days');

  console.log('Seeding completed successfully!');
  console.log('Demo accounts created:');
  console.log('  1. ADMIN      -> admin / admin123');
  console.log('  2. PHARMACIST -> pharmacist / pharm123');
  console.log('  3. CASHIER    -> cashier / cash123');
}

if (require.main === module) {
  try {
    seedDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

module.exports = { seedDatabase };
