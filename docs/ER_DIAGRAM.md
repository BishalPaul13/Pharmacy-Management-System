# Entity-Relationship (ER) Diagram & Schema Data Dictionary

This document details the relational data architecture of the **MediCare Pharmacy Management System**, implemented in SQLite with ACID compliance, strict check constraints, foreign keys, and immutable stock ledger auditing.

---

## 1. Mermaid Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ PURCHASES : "receives (created_by)"
    USERS ||--o{ SALES : "transacts (cashier_id)"
    USERS ||--o{ STOCK_ADJUSTMENTS : "authorizes (performed_by)"
    USERS ||--o{ STOCK_LEDGER : "records (created_by)"
    USERS ||--o{ AUDIT_LOGS : "generates (user_id)"

    CATEGORIES ||--o{ MEDICINES : "classifies"
    SUPPLIERS ||--o{ PURCHASES : "fulfills"

    MEDICINES ||--o{ BATCHES : "contains"
    MEDICINES ||--o{ SALE_ITEMS : "sold_as"
    MEDICINES ||--o{ STOCK_ADJUSTMENTS : "adjusted_as"
    MEDICINES ||--o{ STOCK_LEDGER : "tracked_in"

    PURCHASES ||--o{ BATCHES : "inward_manifest"

    BATCHES ||--o{ SALE_ITEMS : "dispensed_from"
    BATCHES ||--o{ STOCK_ADJUSTMENTS : "target_batch"
    BATCHES ||--o{ STOCK_LEDGER : "batch_movement"

    SALES ||--|{ SALE_ITEMS : "line_items"
    SALES ||--o{ STOCK_ADJUSTMENTS : "optional_return_link"

    USERS {
        int id PK
        string username UK
        string password_hash
        string full_name
        string role "ADMIN | PHARMACIST | CASHIER"
        string email
        string phone
        int is_active "0 | 1"
        datetime created_at
        datetime updated_at
    }

    CATEGORIES {
        int id PK
        string name UK
        string description
        datetime created_at
    }

    SUPPLIERS {
        int id PK
        string code UK
        string name
        string contact_person
        string phone
        string email
        string address
        string tax_id
        string status "ACTIVE | INACTIVE"
        datetime created_at
    }

    MEDICINES {
        int id PK
        string sku UK
        string name
        string generic_name
        int category_id FK
        string dosage_form "Tablet | Capsule | Syrup | etc."
        string strength
        string unit_of_measure
        int reorder_level "CHECK >= 0"
        int prescription_required "0 | 1"
        string shelf_location
        string description
        datetime created_at
        datetime updated_at
    }

    PURCHASES {
        int id PK
        string reference_no UK
        int supplier_id FK
        string invoice_no
        date purchase_date
        real total_cost "CHECK >= 0"
        string notes
        string status "RECEIVED | CANCELLED"
        int created_by FK
        datetime created_at
    }

    BATCHES {
        int id PK
        int medicine_id FK
        int purchase_id FK
        string batch_number
        int initial_quantity "CHECK >= 0"
        int quantity "CHECK >= 0"
        real cost_price "CHECK >= 0"
        real sale_price "CHECK >= 0"
        date manufacturing_date
        date expiry_date "FEFO Index"
        string status "ACTIVE | EXPIRED | DEPLETED | QUARANTINED"
        datetime created_at
        datetime updated_at
    }

    SALES {
        int id PK
        string invoice_no UK
        string customer_name
        string customer_phone
        string doctor_name
        datetime sale_date
        real subtotal "CHECK >= 0"
        real discount "CHECK >= 0"
        real tax_amount "CHECK >= 0"
        real tax_rate "CHECK >= 0"
        real total_amount "CHECK >= 0"
        string payment_method "CASH | CARD | UPI | INSURANCE"
        real amount_paid "CHECK >= 0"
        real change_returned "CHECK >= 0"
        int cashier_id FK
        string notes
        datetime created_at
    }

    SALE_ITEMS {
        int id PK
        int sale_id FK
        int medicine_id FK
        int batch_id FK
        int quantity "CHECK > 0"
        real unit_price "CHECK >= 0"
        real cost_price "CHECK >= 0"
        real tax_rate
        real tax_amount
        real subtotal
        real total
    }

    STOCK_ADJUSTMENTS {
        int id PK
        string reference_no UK
        string type "CUSTOMER_RETURN | SUPPLIER_RETURN | EXPIRED_DISPOSAL | DAMAGED_WRITE_OFF | PHYSICAL_AUDIT_CORRECTION"
        int medicine_id FK
        int batch_id FK
        int quantity "Non-zero integer"
        string reason "CHECK length >= 3"
        int related_sale_id FK
        int performed_by FK
        datetime created_at
    }

    STOCK_LEDGER {
        int id PK
        string movement_type "OPENING_BALANCE | PURCHASE | SALE | CUSTOMER_RETURN | SUPPLIER_RETURN | EXPIRED_DISPOSAL | DAMAGED_WRITE_OFF | AUDIT_ADJUSTMENT"
        int medicine_id FK
        int batch_id FK
        int quantity_delta
        int balance_after "CHECK >= 0"
        string reference_id
        string notes
        int created_by FK
        datetime created_at
    }

    AUDIT_LOGS {
        int id PK
        int user_id FK
        string username
        string role
        string action
        string entity_type
        string entity_id
        string details "JSON"
        string ip_address
        datetime created_at
    }
```

---

## 2. Relational Integrity and Data Constraints

1. **Atomic Batch Tracking & Non-Negative Stock Guarantee:**
   - Every stock deduction references a specific `batch_id`. Stock is never treated as an undifferentiated lump sum.
   - Database constraint `batches.quantity CHECK(quantity >= 0)` guarantees at the engine level that stock cannot become negative.
   - Pre-validation in `salesService` and `adjustmentService` enforces that `available >= requested` before deducting.

2. **Mandatory Operational Reasons:**
   - `stock_adjustments.reason CHECK(length(trim(reason)) >= 3)` enforces at the database level that no stock adjustment or write-off can be saved without an explicit operational rationale.

3. **Perpetual Inventory Reconciliation:**
   - The immutable `stock_ledger` table captures the exact delta and post-transaction balance for every single business action (`PURCHASE`, `SALE`, `CUSTOMER_RETURN`, `SUPPLIER_RETURN`, `EXPIRED_DISPOSAL`, `DAMAGED_WRITE_OFF`, `AUDIT_ADJUSTMENT`).
   - The perpetual formula `Opening + Purchases - Sales + CustomerReturns - SupplierReturns - Disposals/Damaged +/- AuditAdjustments = Closing Stock` guarantees 100% mathematical auditability.

