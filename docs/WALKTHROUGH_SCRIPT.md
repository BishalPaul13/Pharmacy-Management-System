# 3–5 Minute Demonstration Walkthrough Script
## MediCare Pharmacy Management System

This script guides the reviewer or presenter through an end-to-end operational walkthrough of the MediCare Pharmacy Management System.

---

### Segment 1: System Overview & Role-Based Access (0:00 – 0:45)
- **Visual:** Browser opens to `http://localhost:5000`. Login screen is displayed.
- **Presenter Narration:**
  > *"Welcome to the MediCare Pharmacy Management System. In this demonstration, we will explore an enterprise, database-backed application that handles batch inventory, FEFO dispensing, strict expiry controls, printable invoicing, and perpetual stock reconciliation.*
  > *Notice the three one-click demo credentials for Admin, Pharmacist, and Cashier. Let's start by clicking 'Cashier' to complete a customer checkout journey."*
- **Action:** Click the "Cashier" chip and sign in.

---

### Segment 2: Point of Sale (POS) & Automated FEFO Allocation (0:45 – 1:40)
- **Visual:** Cashier lands on the Point of Sale interface (`/pos`).
- **Presenter Narration:**
  > *"As a Cashier, we are in the Point of Sale interface. Let's search for 'Amoxicillin'. Notice that Amoxicillin has multiple active batches in stock with different expiration dates.*
  > *When we add Amoxicillin to the cart, our FEFO engine automatically selects batch AMX-B26-01 because it expires soonest—ensuring older valid stock is dispensed first to minimize waste.*
  > *Notice that tax is automatically calculated at 10%, displaying subtotal, tax amount, and grand total in real time."*
- **Action:**
  1. In the search box, type `Amox`.
  2. Click on Amoxicillin 500mg.
  3. Show the cart displaying Batch `AMX-B26-01` with its expiry date.
  4. Enter customer name: `Jane Doe`, Phone: `+1-555-0144`.
  5. Select Payment Method: `Cash`. Enter Amount Tendered: `$50.00`.
  6. Click **Complete Sale**.

---

### Segment 3: Printable Tax Invoice & Safety Disclaimer (1:40 – 2:15)
- **Visual:** The Printable Invoice modal opens instantly upon checkout.
- **Presenter Narration:**
  > *"Upon completing the sale, the transaction is atomically committed to the database: batch quantities are decremented, and an immutable movement is recorded in the Stock Ledger.*
  > *Here is the generated tax invoice with the official pharmacy header, license details, itemized batch numbers, and tax breakdown.*
  > *We can toggle between standard A4 format and an 80mm thermal receipt slip, and click 'Print Invoice' for physical printing.*
  > *Notice the prominent disclaimer: 'Fictional test medicines. Not medical advice.' ensuring regulatory safety."*
- **Action:**
  1. Toggle to "80mm POS Thermal Slip" and back to "Standard A4 Invoice".
  2. Highlight the batch number and safety disclaimer.
  3. Close the modal.

---

### Segment 4: Security & Expired Batch Blocking (2:15 – 2:50)
- **Visual:** Navigate to Batch Inventory (`/batches`).
- **Presenter Narration:**
  > *"Now let's examine our batch inventory. Every single medicine is segregated by batch number, manufacturing date, and expiry date.*
  > *Notice batch MTF-B25-OLD for Metformin: it expired on October 31st and is marked in red.*
  > *If an operator or API attempts to sell from an expired batch, the system strictly blocks the transaction with an HTTP 422 error code 'EXPIRED_BATCH_BLOCKED'. Expired stock cannot be sold under any circumstances."*
- **Action:** Show the expired batch badge in the table and explain the automated server-side blocking rule.

---

### Segment 5: Pharmacist Workflow — Inward Shipments & Returns (2:50 – 3:45)
- **Visual:** Use the top Navbar quick switcher to switch to **Pharmacist**.
- **Presenter Narration:**
  > *"Now let's switch to the Pharmacist role using our convenient role-switcher in the header. Notice that new operational navigation links appear: Inward Purchases and Returns & Adjustments.*
  > *In the Returns & Adjustments module, all stock changes require an audited operational rationale. Let's record a Damaged Write-Off for a broken bottle.*
  > *The system mandates a detailed reason of at least 3 characters. Furthermore, our database check constraints guarantee that stock can never silently become negative."*
- **Action:**
  1. Click "Pharmacist" in the top bar.
  2. Navigate to "Returns & Adjustments" (`/adjustments`).
  3. Click "Record Return / Adjustment".
  4. Select `Damaged Write-Off`, choose a batch, enter Quantity `1`, Reason: `Broken vial during shelf reorganization`.
  5. Click "Commit Adjustment" and show the updated ledger entry.

---

### Segment 6: Admin View — Perpetual Reconciliation & Audit Trail (3:45 – 4:40)
- **Visual:** Switch to **Admin** role and navigate to **Reports & Reconciliation** (`/reports`).
- **Presenter Narration:**
  > *"Finally, let's switch to the Administrator view to inspect the ultimate audit capability: Perpetual Stock Reconciliation.*
  > *This report audits every batch by reconciling: Opening Stock plus Inward Purchases, minus Sales, plus Customer Returns, minus Supplier Returns, minus Damaged/Expired Write-offs, plus Audit Adjustments.*
  > *Notice that for 100% of batches, the calculated closing stock matches the physical inventory on hand with zero variance, giving an overall status of 'PERFECTLY_RECONCILED'.*
  > *Lastly, in the Audit Trail view, administrators can inspect the exact user, IP address, and JSON state mutation payload for every material business action."*
- **Action:**
  1. Click "Admin" in the top bar.
  2. Navigate to "Reports & Reconciliation".
  3. Highlight the reconciliation table columns and the 0 variance.
  4. Navigate to "Audit Trail" (`/audit`) and click "Inspect Payload" on a recent sale to show the JSON details.

---

### Segment 7: Summary & Verification Suite (4:40 – 5:00)
- **Visual:** Open terminal showing Jest test results.
- **Presenter Narration:**
  > *"To summarize, MediCare PMS delivers a complete, responsive, database-backed application that satisfies all business and technical criteria.*
  > *All 16 unit and integration tests covering FEFO deduction, expired batch blocking, negative stock prevention, and server-side RBAC pass with 100% success.*
  > *The entire system runs locally via a single command with zero external dependencies. Thank you!"*
