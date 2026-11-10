-- Pharmacy Management System Database Schema (SQLite)
-- Designed with ACID transaction integrity, strict CHECK constraints, and audit logging.

PRAGMA foreign_keys = ON;

-- 1. Users & Roles (RBAC: ADMIN, PHARMACIST, CASHIER)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('ADMIN', 'PHARMACIST', 'CASHIER')),
    email TEXT,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    tax_id TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Medicines Catalogue
CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    generic_name TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    dosage_form TEXT NOT NULL,
    strength TEXT NOT NULL,
    unit_of_measure TEXT NOT NULL DEFAULT 'Units',
    reorder_level INTEGER NOT NULL DEFAULT 20 CHECK(reorder_level >= 0),
    prescription_required INTEGER NOT NULL DEFAULT 0 CHECK(prescription_required IN (0, 1)),
    shelf_location TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Inward Purchases
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_no TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    invoice_no TEXT,
    purchase_date TEXT NOT NULL,
    total_cost REAL NOT NULL DEFAULT 0.0 CHECK(total_cost >= 0),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK(status IN ('RECEIVED', 'CANCELLED')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Batches (Inventory tracked strictly by batch, cost, price, and expiry)
CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
    batch_number TEXT NOT NULL,
    initial_quantity INTEGER NOT NULL CHECK(initial_quantity >= 0),
    quantity INTEGER NOT NULL CHECK(quantity >= 0), -- CRITICAL CHECK: prevents negative stock!
    cost_price REAL NOT NULL CHECK(cost_price >= 0),
    sale_price REAL NOT NULL CHECK(sale_price >= 0),
    manufacturing_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL, -- Core for FEFO ordering & expiry blocking
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'EXPIRED', 'DEPLETED', 'QUARANTINED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(medicine_id, batch_number)
);

-- 7. Sales Records (Invoices)
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT UNIQUE NOT NULL,
    customer_name TEXT DEFAULT 'Walk-in Customer',
    customer_phone TEXT,
    doctor_name TEXT,
    sale_date TEXT NOT NULL DEFAULT (datetime('now')),
    subtotal REAL NOT NULL CHECK(subtotal >= 0),
    discount REAL NOT NULL DEFAULT 0.0 CHECK(discount >= 0),
    tax_amount REAL NOT NULL DEFAULT 0.0 CHECK(tax_amount >= 0),
    tax_rate REAL NOT NULL DEFAULT 0.0 CHECK(tax_rate >= 0),
    total_amount REAL NOT NULL CHECK(total_amount >= 0),
    payment_method TEXT NOT NULL DEFAULT 'CASH' CHECK(payment_method IN ('CASH', 'CARD', 'UPI', 'INSURANCE')),
    amount_paid REAL NOT NULL CHECK(amount_paid >= 0),
    change_returned REAL NOT NULL DEFAULT 0.0 CHECK(change_returned >= 0),
    cashier_id INTEGER NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. Sale Items (Itemized records tracking specific batch used)
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    cost_price REAL NOT NULL DEFAULT 0.0 CHECK(cost_price >= 0),
    tax_rate REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    subtotal REAL NOT NULL CHECK(subtotal >= 0),
    total REAL NOT NULL CHECK(total >= 0)
);

-- 9. Stock Adjustments & Returns (Requires mandatory reason)
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_no TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'EXPIRED_DISPOSAL', 'DAMAGED_WRITE_OFF', 'PHYSICAL_AUDIT_CORRECTION')),
    medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL, -- Positive for increase, negative for decrease
    reason TEXT NOT NULL CHECK(length(trim(reason)) >= 3), -- Mandatory reason enforcement
    related_sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    performed_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. Stock Movement Ledger (Complete historical audit of every single stock change)
CREATE TABLE IF NOT EXISTS stock_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('OPENING_BALANCE', 'PURCHASE', 'SALE', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'EXPIRED_DISPOSAL', 'DAMAGED_WRITE_OFF', 'AUDIT_ADJUSTMENT')),
    medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
    quantity_delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL CHECK(balance_after >= 0),
    reference_id TEXT,
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 11. Comprehensive Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for high-performance searches, FEFO scans, and expiry checks
CREATE INDEX IF NOT EXISTS idx_medicines_sku ON medicines(sku);
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category_id);
CREATE INDEX IF NOT EXISTS idx_batches_fefo ON batches(medicine_id, status, quantity, expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_no);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_batch ON sale_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_batch ON stock_ledger(batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_medicine ON stock_ledger(medicine_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

