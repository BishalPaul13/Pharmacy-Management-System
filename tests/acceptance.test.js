const request = require('supertest');
const app = require('../server/app');
const { getDb, closeDb } = require('../server/config/db');
const { seedDatabase } = require('../server/database/seed');
const { getAuthTokens } = require('./testHelper');

describe('Pharmacy Management System - Acceptance & Verification Suite', () => {
  let db;
  let tokens;

  beforeAll(async () => {
    // Initialize in-memory test database with full seed data
    db = getDb(':memory:');
    seedDatabase(db);
    tokens = await getAuthTokens();
  });

  afterAll(() => {
    closeDb();
  });

  describe('Acceptance Test 1: Sale deducts quantity from correct batch and records stock movement (FEFO)', () => {
    it('should automatically select the earliest expiring batch (FEFO) when batchId is omitted', async () => {
      // Find Amoxicillin which has 3 batches with different expiry dates:
      // AMX-B26-01 (expires in 30 days, qty = 45)
      // AMX-B26-02 (expires in 180 days, qty = 100)
      // AMX-B26-03 (expires in 450 days, qty = 100)
      const medRes = await request(app)
        .get('/api/v1/medicines?search=Amoxicillin')
        .expect(200);

      const amox = medRes.body.data[0];
      expect(amox).toBeDefined();

      // Check initial quantity of earliest expiring batch (AMX-B26-01)
      const initialBatch = db.prepare("SELECT * FROM batches WHERE batch_number = 'AMX-B26-01'").get();
      const initialQty = initialBatch.quantity;
      expect(initialQty).toBeGreaterThan(0);

      // Perform a sale for 5 units without specifying a batchId
      const salePayload = {
        customerName: 'Alice Springs',
        customerPhone: '+1-555-4422',
        items: [
          { medicineId: amox.id, quantity: 5 }
        ],
        paymentMethod: 'CASH',
        amountPaid: 200.00,
      };

      const saleRes = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${tokens.cashierToken}`)
        .send(salePayload)
        .expect(201);

      expect(saleRes.body.success).toBe(true);
      expect(saleRes.body.data.invoice_no).toMatch(/^INV-\d{6}-\d{4}$/);
      expect(saleRes.body.data.items).toHaveLength(1);
      // Verify the allocated batch is indeed AMX-B26-01 (FEFO)
      expect(saleRes.body.data.items[0].batch_number).toBe('AMX-B26-01');
      expect(saleRes.body.data.items[0].quantity).toBe(5);

      // Verify the batch quantity in the database was decremented by 5
      const updatedBatch = db.prepare('SELECT * FROM batches WHERE id = ?').get(initialBatch.id);
      expect(updatedBatch.quantity).toBe(initialQty - 5);

      // Verify a corresponding SALE movement was recorded in stock_ledger
      const ledgerEntry = db.prepare(`
        SELECT * FROM stock_ledger 
        WHERE batch_id = ? AND reference_id = ? AND movement_type = 'SALE'
      `).get(initialBatch.id, saleRes.body.data.invoice_no);

      expect(ledgerEntry).toBeDefined();
      expect(ledgerEntry.quantity_delta).toBe(-5);
      expect(ledgerEntry.balance_after).toBe(updatedBatch.quantity);
    });
  });

  describe('Acceptance Test 2: Expired batch cannot be sold', () => {
    it('should reject a sale from an expired batch with HTTP 422 and EXPIRED_BATCH_BLOCKED code', async () => {
      // Metformin has an expired batch MTF-B25-OLD
      const expiredBatch = db.prepare("SELECT * FROM batches WHERE batch_number = 'MTF-B25-OLD'").get();
      expect(expiredBatch).toBeDefined();
      expect(expiredBatch.quantity).toBeGreaterThan(0);

      const salePayload = {
        customerName: 'Test Patient',
        items: [
          {
            medicineId: expiredBatch.medicine_id,
            batchId: expiredBatch.id,
            quantity: 2,
          }
        ],
        amountPaid: 100.00,
      };

      const response = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${tokens.cashierToken}`)
        .send(salePayload)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('EXPIRED_BATCH_BLOCKED');
      expect(response.body.message).toContain('BATCH EXPIRED');

      // Verify stock was NOT deducted
      const batchAfter = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(expiredBatch.id);
      expect(batchAfter.quantity).toBe(expiredBatch.quantity);
    });

    it('FEFO engine should strictly exclude expired batches from automatic allocation', async () => {
      const expiredBatch = db.prepare("SELECT * FROM batches WHERE batch_number = 'MTF-B25-OLD'").get();

      const fefoRes = await request(app)
        .get(`/api/v1/medicines/${expiredBatch.medicine_id}/fefo?quantity=10`)
        .expect(200);

      // Active fresh batch should be allocated, NOT the expired batch
      const allocations = fefoRes.body.data.allocations;
      expect(allocations.length).toBeGreaterThan(0);
      for (const alloc of allocations) {
        expect(alloc.batchNumber).not.toBe('MTF-B25-OLD');
        expect(alloc.batchNumber).toBe('MTF-B26-NEW');
      }
    });
  });

  describe('Acceptance Test 3: The system warns about low stock and near-expiry batches', () => {
    it('should identify medicines below reorder level as LOW_STOCK', async () => {
      // Cetirizine has only 5 units in stock, reorder level is 20
      const res = await request(app)
        .get('/api/v1/medicines?search=Cetirizine')
        .expect(200);

      const ceti = res.body.data[0];
      expect(ceti).toBeDefined();
      expect(ceti.stock_status).toBe('LOW_STOCK');
      expect(ceti.is_low_stock).toBe(true);
      expect(ceti.total_active_stock).toBeLessThanOrEqual(ceti.reorder_level);
    });

    it('should classify batches into NEAR_EXPIRY and CRITICAL_EXPIRY in expiry report', async () => {
      const expiryRes = await request(app)
        .get('/api/v1/reports/expiry?days=60')
        .set('Authorization', `Bearer ${tokens.adminToken}`)
        .expect(200);

      expect(expiryRes.body.success).toBe(true);
      const data = expiryRes.body.data;

      expect(data.counts.critical).toBeGreaterThan(0); // Salbutamol expires in 5 days
      expect(data.counts.warning).toBeGreaterThan(0);  // Atorvastatin & Amoxicillin
      expect(data.counts.expired).toBeGreaterThan(0);  // Metformin expired

      // Validate critical batch details
      const criticalBatches = data.groups.critical;
      const foundSalb = criticalBatches.find(b => b.batch_number === 'SLB-B26-01');
      expect(foundSalb).toBeDefined();
      expect(foundSalb.status_tier).toBe('CRITICAL');
    });

    it('should report correct alert counts in dashboard metrics', async () => {
      const dashRes = await request(app)
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${tokens.adminToken}`)
        .expect(200);

      const alerts = dashRes.body.data.alerts;
      expect(alerts.lowStockCount).toBeGreaterThan(0);
      expect(alerts.nearExpiryCount).toBeGreaterThan(0);
      expect(alerts.expiredBatchCount).toBeGreaterThan(0);
    });
  });

  describe('Acceptance Test 4: Returns/adjustments require a reason and are auditable', () => {
    it('should reject a stock adjustment if reason is omitted or too short', async () => {
      const batch = db.prepare("SELECT id FROM batches WHERE status = 'ACTIVE' LIMIT 1").get();

      const invalidPayload = {
        type: 'DAMAGED_WRITE_OFF',
        batchId: batch.id,
        quantity: -2,
        reason: '  ', // Empty reason
      };

      const res = await request(app)
        .post('/api/v1/adjustments')
        .set('Authorization', `Bearer ${tokens.pharmToken}`)
        .send(invalidPayload)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/ValidationError|MANDATORY_REASON_REQUIRED/);
    });

    it('should successfully record an adjustment with valid reason, adjust stock, and log in audit trail', async () => {
      const batch = db.prepare("SELECT * FROM batches WHERE batch_number = 'PAR-B26-10'").get();
      const initialStock = batch.quantity;

      const validAdjustment = {
        type: 'DAMAGED_WRITE_OFF',
        batchId: batch.id,
        quantity: -3,
        reason: '3 blister packs water damaged by leak in aisle 4',
      };

      const res = await request(app)
        .post('/api/v1/adjustments')
        .set('Authorization', `Bearer ${tokens.pharmToken}`)
        .send(validAdjustment)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.reference_no).toMatch(/^ADJ-\d{4}-\d{4}$/);

      // Verify batch quantity adjusted
      const batchAfter = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(batch.id);
      expect(batchAfter.quantity).toBe(initialStock - 3);

      // Verify ledger entry created
      const ledger = db.prepare('SELECT * FROM stock_ledger WHERE reference_id = ?').get(res.body.data.reference_no);
      expect(ledger).toBeDefined();
      expect(ledger.movement_type).toBe('DAMAGED_WRITE_OFF');
      expect(ledger.quantity_delta).toBe(-3);

      // Verify audit trail logged
      const audit = db.prepare("SELECT * FROM audit_logs WHERE action = 'STOCK_ADJUSTMENT_EXECUTED' ORDER BY id DESC LIMIT 1").get();
      expect(audit).toBeDefined();
      expect(audit.username).toBe('pharmacist');
      expect(audit.details).toContain('3 blister packs water damaged');
    });

    it('should support customer return to increase stock with mandatory reason', async () => {
      const batch = db.prepare("SELECT * FROM batches WHERE batch_number = 'PAR-B26-10'").get();
      const initialStock = batch.quantity;

      const customerReturn = {
        type: 'CUSTOMER_RETURN',
        batchId: batch.id,
        quantity: 2,
        reason: 'Customer brought back sealed un-opened pack with original receipt',
      };

      const res = await request(app)
        .post('/api/v1/adjustments')
        .set('Authorization', `Bearer ${tokens.pharmToken}`)
        .send(customerReturn)
        .expect(201);

      const batchAfter = db.prepare('SELECT quantity FROM batches WHERE id = ?').get(batch.id);
      expect(batchAfter.quantity).toBe(initialStock + 2);
    });
  });

  describe('Acceptance Test 5: The stock report reconciles with opening stock, purchases, sales and adjustments', () => {
    it('should perfectly reconcile actual physical stock against historical stock ledger movements', async () => {
      const res = await request(app)
        .get('/api/v1/reports/reconciliation')
        .set('Authorization', `Bearer ${tokens.adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const report = res.body.data;

      expect(report.overallStatus).toBe('PERFECTLY_RECONCILED');
      expect(report.batchesWithDiscrepancy).toBe(0);
      expect(report.totalBatchesAudited).toBeGreaterThan(0);

      // Verify every batch in the audit satisfies the reconciliation equation:
      // Opening + Purchases - Sales + CustomerReturns - SupplierReturns - Damaged - Expired + AuditAdjustments === ActualPhysicalStock
      for (const batch of report.batches) {
        const expected = batch.openingStock +
          batch.purchases -
          batch.sales +
          batch.customerReturns -
          batch.supplierReturns -
          batch.damagedWriteOff -
          batch.expiredDisposal +
          batch.auditAdjustments;

        expect(batch.calculatedClosingStock).toBe(expected);
        expect(batch.actualPhysicalStock).toBe(expected);
        expect(batch.discrepancy).toBe(0);
        expect(batch.status).toBe('RECONCILED');
      }
    });
  });

  describe('Edge Case Test 6: Negative stock prevention', () => {
    it('should abort and prevent negative stock when attempting to adjust more than available quantity', async () => {
      const batch = db.prepare("SELECT id, quantity, batch_number FROM batches WHERE status = 'ACTIVE' AND quantity > 0 LIMIT 1").get();

      const excessiveReduction = {
        type: 'DAMAGED_WRITE_OFF',
        batchId: batch.id,
        quantity: -(batch.quantity + 100), // More than current stock!
        reason: 'Accidental inventory typo test',
      };

      const res = await request(app)
        .post('/api/v1/adjustments')
        .set('Authorization', `Bearer ${tokens.pharmToken}`)
        .send(excessiveReduction)
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('NEGATIVE_STOCK_PREVENTED');
    });

    it('should abort and reject sale when requested quantity exceeds total active available stock', async () => {
      const med = db.prepare("SELECT id, name FROM medicines WHERE sku = 'MED-CTZ-010'").get(); // Only 5 units left

      const overSalePayload = {
        customerName: 'Over-buyer',
        items: [{ medicineId: med.id, quantity: 999 }],
        amountPaid: 10000,
      };

      const res = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${tokens.cashierToken}`)
        .send(overSalePayload)
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('INSUFFICIENT_STOCK');
    });
  });

  describe('Security Test 7: Server-side RBAC authorization enforcement', () => {
    it('should forbid CASHIER from accessing system audit logs (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${tokens.cashierToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.userRole).toBe('CASHIER');
    });

    it('should forbid CASHIER from creating supplier inward purchase orders (HTTP 403)', async () => {
      const res = await request(app)
        .post('/api/v1/purchases')
        .set('Authorization', `Bearer ${tokens.cashierToken}`)
        .send({
          supplierId: 1,
          items: [{ medicineId: 1, batchNumber: 'HACK-01', initialQuantity: 10, costPrice: 10, salePrice: 15, manufacturingDate: '2026-01-01', expiryDate: '2027-01-01' }]
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should forbid CASHIER from performing stock write-offs (HTTP 403)', async () => {
      const res = await request(app)
        .post('/api/v1/adjustments')
        .set('Authorization', `Bearer ${tokens.cashierToken}`)
        .send({
          type: 'DAMAGED_WRITE_OFF',
          batchId: 1,
          quantity: -1,
          reason: 'Unauthorized write-off attempt',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should allow ADMIN full access to audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${tokens.adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
