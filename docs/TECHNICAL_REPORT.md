# Technical Architecture & Engineering Report: Pharmacy Management System

## 1. Executive Summary & Problem Scope

The **MediCare Pharmacy Management System** is an enterprise-grade, database-backed business application designed to manage operational workflows across three core roles: **Administrator**, **Pharmacist**, and **Cashier**. 

Managing pharmaceutical inventory requires strict operational safeguards beyond traditional retail POS:
1. **Batch-Level Granularity:** Stock cannot be tracked as an undifferentiated total. Each unit belongs to an identifiable manufacturer batch with specific manufacturing and expiry dates, purchase cost, and sale price.
2. **FEFO (First-Expiry-First-Out) Dispensing:** The system must automatically prioritize dispensing batches expiring earliest to minimize obsolescence and waste.
3. **Absolute Prohibition of Expired Sales:** Dispensing an expired batch is illegal and unsafe; the application strictly blocks expired batches at the database and service levels.
4. **Zero Negative Stock Guarantee:** Physical inventory cannot exist in negative quantities; database check constraints and transactional pre-validation prevent race conditions and over-dispensing.
5. **Perpetual Audit Ledger & Stock Reconciliation:** Every stock movement (purchase, sale, customer return, supplier recall, damaged write-off, or physical audit count) must be permanently logged so that:
   $$\text{Opening Stock} + \text{Inward Purchases} - \text{Sales} + \text{Customer Returns} - \text{Supplier Returns} - \text{Disposals} \pm \text{Audit Adjustments} = \text{Current Stock}$$
   reconciles with zero discrepancy.

---

## 2. Architecture & Design Decisions

### 2.1 Modular Monolith vs. Microservices
A **Modular Monolith** architecture was selected. In a healthcare/pharmacy environment, atomicity and strong consistency during inventory transactions are non-negotiable. A modular monolith provides:
- **ACID Transaction Guarantees:** Sales checkout, batch stock deduction, and ledger recording occur within a single database transaction, eliminating partial failures and distributed saga complexity.
- **Low Operational Overhead:** Zero network latency between services, zero reliance on external messaging brokers, and fully reproducible single-command local deployment.
- **Strict Domain Separation:** Modules are isolated into clean layers:
  - **Presentation Layer (React + Vite + Tailwind CSS):** Clean, accessible UX with printable invoice rendering, real-time alerts, and instant role switching for demonstration.
  - **Application / Services Layer (Express + Domain Services):** Houses core business logic (`batchService`, `salesService`, `adjustmentService`, `reportService`).
  - **Persistence Layer (SQLite with WAL & Foreign Keys):** Synchronous, high-performance, embedded relational database with strict SQL check constraints.

### 2.2 Relational Persistence (SQLite in WAL Mode)
SQLite was chosen with `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL`. 
- Write-Ahead Logging (WAL) permits concurrent readers while a write transaction executes without blocking.
- Embedded deployment ensures 100% reproducible local demonstration without requiring Docker daemon, external database services, or recurring hosting costs.
- Native SQL `CHECK (quantity >= 0)` guarantees at the lowest system boundary that stock cannot become negative.

---

## 3. Server-Side Role-Based Access Control (RBAC)

The system implements strict server-side authorization middleware (`authorize(...)`). Front-end UI button visibility is treated as a convenience, **never** as a security control:

| Role | Operational Permissions | Restricted Actions |
|---|---|---|
| **ADMIN** | Full administrative authority: Manage users, system catalogue, approve suppliers, view financial valuation, and inspect immutable system audit logs. | None |
| **PHARMACIST** | Manage medicine catalogue, receive supplier inward goods (PO), quarantine expired batches, perform audited stock adjustments/returns, view reports. | Cannot manage user accounts or alter system configuration. |
| **CASHIER** | Point of Sale (POS) operation, fast search, FEFO batch allocation, process customer payments, issue printable tax invoices, view shift sales. | Blocked (HTTP 403) from receiving purchase orders, modifying costs, adjusting inventory, or viewing audit logs. |

Every request validates the JWT bearer token, checks account activity status (`is_active = 1`), and enforces role membership on the route handler.

---

## 4. Key Algorithms & Business Rules

### 4.1 First-Expiry-First-Out (FEFO) Engine
When dispensing medicine, the algorithm executes the following query:
```sql
SELECT b.*, ROUND(julianday(b.expiry_date) - julianday('now')) AS days_to_expiry
FROM batches b
WHERE b.medicine_id = ?
  AND b.status = 'ACTIVE'
  AND b.quantity > 0
  AND date(b.expiry_date) > date('now')
ORDER BY b.expiry_date ASC, b.id ASC
```
- If the required quantity exceeds the earliest expiring batch, the engine splits the allocation across consecutive active batches in ascending order of expiration.
- Batches where `expiry_date <= today` or status is `EXPIRED`/`QUARANTINED` are strictly excluded from the result set.

### 4.2 Expired Batch Blocking
If a client explicitly submits a `batchId` that has expired (`date(expiry_date) <= date('now')`), the server aborts the transaction with an HTTP 422 error code `EXPIRED_BATCH_BLOCKED`:
```json
{
  "success": false,
  "error": "EXPIRED_BATCH_BLOCKED",
  "message": "BATCH EXPIRED: Batch 'MTF-B25-OLD' for 'Metformin 500mg' expired on 2026-10-31 and CANNOT be sold."
}
```

### 4.3 Atomic Checkout & Negative Stock Protection
The checkout operation executes inside `db.transaction(() => { ... })()`:
1. Locks batch rows.
2. Validates batch status and confirms `batch.quantity >= item.quantity`.
3. Atomically decrements `batches.quantity`.
4. If quantity hits zero, updates status to `DEPLETED`.
5. Inserts itemized sale record into `sales` and `sale_items`.
6. Appends audit log entry into `stock_ledger` with `quantity_delta = -qty` and new balance.

---

## 5. Audit Trail & Perpetual Reconciliation

Every inventory change appends an immutable entry to `stock_ledger`. The system provides an interactive Reconciliation Report verifying that for every batch:
$$\text{Calculated Stock} = \text{Opening} + \text{Purchases} - \text{Sales} + \text{Customer Returns} - \text{Supplier Returns} - \text{Disposals} \pm \text{Adjustments}$$
$$\text{Variance} = \text{Actual Batch Stock} - \text{Calculated Stock} = 0$$

If any variance occurred, the system would immediately flag `DISCREPANCY_ALERT`. In our automated test suite, 100% of batches achieve `PERFECTLY_RECONCILED`.

---

## 6. Verification & Automated Test Evidence

Automated tests in `tests/acceptance.test.js` verify all acceptance requirements:
- **Test 1:** Sale deducts quantity from correct batch and records stock movement (FEFO) — **PASSED**
- **Test 2:** Expired batch cannot be sold (HTTP 422) — **PASSED**
- **Test 3:** FEFO engine excludes expired batches from auto-allocation — **PASSED**
- **Test 4:** Low-stock warnings and near-expiry urgency classifications — **PASSED**
- **Test 5:** Returns/adjustments require mandatory reason and are auditable — **PASSED**
- **Test 6:** Stock report reconciles with opening stock, purchases, sales, and adjustments — **PASSED**
- **Test 7:** Negative stock prevention on over-sell and excessive adjustment — **PASSED**
- **Test 8:** Server-side RBAC authorization strictly blocks unprivileged roles — **PASSED**

