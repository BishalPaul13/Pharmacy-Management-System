# MediCare — Enterprise Pharmacy Management System

A responsive, database-backed business application designed for operational pharmacy workflows with batch inventory tracking, First-Expiry-First-Out (FEFO) dispensing, expired batch blocking, POS invoicing, auditable stock returns, and perpetual reconciliation.

---

## 1. Quick Start & Local Run

### Prerequisites
- **Node.js**: v18.0.0 or higher (Tested and certified on Node v20+ and v24)
- **npm**: v9.0.0 or higher
- **No external database services or Docker daemon required** (Uses embedded SQLite with WAL mode).

### Installation & Run Steps
```bash
# 1. Clone repository & enter workspace
git clone <repository-url>
cd "Pharmacy Management System"

# 2. Install all dependencies
npm install

# 3. Initialize and seed the database with demo operational data
npm run db:reset

# 4. Start the application (serves both full-stack API and Frontend on single port)
npm start
```

Once started, open your web browser to:
- **Application Portal:** [http://localhost:5000](http://localhost:5000)
- **Interactive Swagger API Docs:** [http://localhost:5000/api/docs](http://localhost:5000/api/docs)
- **Backend Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

*(Optional: For frontend active development with Vite HMR, run `npm run dev` to launch concurrently on port 3000 & 5000).*

---

## 2. Demo User Credentials (RBAC)

The application implements strict server-side Role-Based Access Control (RBAC). The login screen and navbar include **One-Click Demo Switchers** for instant testing:

| Role | Username | Password | Operational Access Scope |
|---|---|---|---|
| **ADMIN** | `admin` | `admin123` | Full access: Catalogue, Inward Goods, POS, Returns, Adjustments, Users, Reports, and System Audit Logs |
| **PHARMACIST** | `pharmacist` | `pharm123` | Operational access: Catalogue, Inward Goods (PO), Batch Status, Expiry Quarantining, Stock Adjustments, Reports |
| **CASHIER** | `cashier` | `cash123` | Front-counter POS: Medicine search, FEFO batch allocation, process sales, print tax invoices, view shift sales |

---

## 3. Core Features & Business Problem Coverage

1. **Medicine & Supplier Catalogue:**
   - Manage brand names, generic formulations, SKU barcodes, dosage forms, strength, reorder level alert thresholds, prescription required flags, and shelf locations.
   - Comprehensive supplier directory with contact details, GSTIN/tax numbers, and purchase order history.

2. **Batch-Level Inventory:**
   - Stock is strictly tracked by batch number, manufacturing date, expiry date, purchase cost, and sale price. Stock is **never** treated as an undifferentiated total.

3. **FEFO (First-Expiry-First-Out) Dispensing:**
   - POS automatically allocates the earliest expiring active batch first. If required quantity exceeds the batch, it cascades to the next earliest batch.

4. **Strict Expired Batch Blocking:**
   - Batches with `expiry_date <= today` are blocked from dispensing at the database and API level with HTTP 422 code `EXPIRED_BATCH_BLOCKED`.

5. **Point of Sale (POS) & Printable Invoices:**
   - Real-time stock display with search by brand, generic, or SKU.
   - Configurable tax calculation (subtotal, 10% tax, total).
   - Generates professional printable tax invoices with pharmacy header, license numbers, itemized batch numbers, and medical disclaimer. Supports standard A4 and 80mm thermal slip print modes.

6. **Audited Returns & Adjustments:**
   - Supports 5 distinct scenarios: `CUSTOMER_RETURN`, `SUPPLIER_RETURN`, `EXPIRED_DISPOSAL`, `DAMAGED_WRITE_OFF`, and `PHYSICAL_AUDIT_CORRECTION`.
   - Strictly enforces a mandatory operational reason (minimum 3 characters).
   - **Zero Negative Stock Guarantee:** Database check constraint `CHECK (quantity >= 0)` and transactional validation prevent negative stock balances.

7. **Perpetual Stock Reconciliation:**
   - Every movement appends an immutable entry to `stock_ledger`.
   - The Reconciliation Report verifies that:
     $$\text{Opening Stock} + \text{Inward Purchases} - \text{Sales} + \text{Customer Returns} - \text{Supplier Returns} - \text{Disposals} \pm \text{Audit Adjustments} = \text{Current Stock}$$
     holds with 0 discrepancy for 100% of batches.

8. **System Audit Trail:**
   - Administrators can review the operator, role, action, timestamp, IP address, and JSON state mutation payload for all material business actions.

---

## 4. Acceptance Criteria Demonstration

| Acceptance Test | Where to Verify in UI | Automated Test File | Status |
|---|---|---|---|
| **1. Sale deducts from correct batch & records movement (FEFO)** | Launch POS (`/pos`), add Amoxicillin, observe earliest batch `AMX-B26-01` allocated and quantity decremented in Batches table. | `tests/acceptance.test.js` (Test 1) | **PASSED** |
| **2. Expired batch cannot be sold** | Navigate to `/batches`, observe Metformin `MTF-B25-OLD` marked as Expired. Attempting sale triggers HTTP 422 `EXPIRED_BATCH_BLOCKED`. | `tests/acceptance.test.js` (Test 2) | **PASSED** |
| **3. Low stock and near-expiry warnings** | Dashboard (`/`) and Catalogue (`/medicines`) highlight Cetirizine as Low Stock; Expiry Watchlist alerts on batches expiring in <60 days. | `tests/acceptance.test.js` (Test 3) | **PASSED** |
| **4. Returns/adjustments require reason & are auditable** | Returns module (`/adjustments`) rejects submission without reason; records reason in ledger and system audit trail. | `tests/acceptance.test.js` (Test 4) | **PASSED** |
| **5. Stock report reconciles with opening, purchases, sales, adjustments** | Reports (`/reports` -> Stock Reconciliation tab) proves calculated closing stock matches actual physical stock with 0 variance. | `tests/acceptance.test.js` (Test 5) | **PASSED** |
| **6. Negative stock prevention** | Over-sale or over-adjustment beyond current batch stock is aborted with HTTP 422 `NEGATIVE_STOCK_PREVENTED`. | `tests/acceptance.test.js` (Test 6) | **PASSED** |
| **7. Server-side RBAC enforcement** | Cashier account is blocked (HTTP 403) from accessing audit logs, receiving purchase orders, or executing stock write-offs. | `tests/acceptance.test.js` (Test 7) | **PASSED** |

---

## 5. Automated Test Suite Execution

Run the complete test suite:
```bash
npm test
```
**Test Evidence:**
- Test Suites: 1 passed, 1 total
- Tests: 16 passed, 16 total
- Time: ~4.9 seconds

---

## 6. Architecture & Tech Stack

```
Pharmacy Management System (Modular Monolith)
├── client/                     # Presentation Layer (React 19, Tailwind CSS, Lucide Icons, Vite)
│   ├── src/pages/              # Dashboard, POS, Medicines, Batches, Purchases, Suppliers, Adjustments, Reports, Audit
│   ├── src/components/         # Layout, Sidebar, Navbar, StatCard, Badge, Modal, PrintableInvoice
│   └── src/context/            # AuthContext (JWT, session persistence, role-switcher)
├── server/                     # Backend Layer (Express REST API, Middleware, Services)
│   ├── config/                 # SQLite connection, WAL mode, Swagger/OpenAPI setup
│   ├── database/               # schema.sql, migrate.js, seed.js, reset.js
│   ├── middlewares/            # JWT authentication, server-side RBAC guards, centralized error handler
│   ├── routes/                 # REST controllers (/api/v1/*)
│   └── services/               # Domain logic (batchService, salesService, adjustmentService, reportService)
├── tests/                      # Automated Jest & Supertest Integration Suite
└── docs/                       # Technical report, ER diagram, OpenAPI spec, Walkthrough script
```

---

## 7. Environment Variables (`.env`)

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `5000` | Port for the backend API and static client server |
| `NODE_ENV` | `development` | Runtime environment mode |
| `JWT_SECRET` | `pharmacy_super_secure_jwt_secret_token_2026` | Secret key for signing authentication tokens |
| `DATABASE_PATH` | `server/database/pharmacy.db` | File path to persistent SQLite database |
| `TAX_RATE` | `10` | Default sales tax percentage applied at checkout |
| `EXPIRY_ALERT_DAYS`| `60` | Days threshold for near-expiry alert banners |

---

## 8. Regulatory & Safety Disclaimer

**Notice:** All medicine names, generic compositions, dosages, batch identifiers, customer profiles, and supplier credentials in this application are **entirely fictional** and generated for software engineering demonstration and evaluation purposes. This system does not diagnose conditions, dispense medical advice, or replace licensed pharmacists and physicians.

