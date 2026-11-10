import React, { useState, useEffect } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  AlertCircle,
  Printer,
  Sparkles,
  ShieldAlert,
  CreditCard,
  Banknote,
  QrCode,
} from 'lucide-react';
import { api } from '../utils/api';
import { Modal } from '../components/Modal';
import { PrintableInvoice } from '../components/PrintableInvoice';
import { formatCurrency, getExpiryBadgeInfo } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

export function POS() {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingMeds, setLoadingMeds] = useState(false);

  // Cart state: Array of { medicine, batchId, batchNumber, expiryDate, quantity, unitPrice, availableQty }
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [discount, setDiscount] = useState('0');

  // Checkout states
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [completedSale, setCompletedSale] = useState(null);

  // Load medicines catalog for POS
  useEffect(() => {
    loadMedicines();
  }, [search]);

  async function loadMedicines() {
    try {
      setLoadingMeds(true);
      const res = await api.get(`/medicines?search=${encodeURIComponent(search)}&limit=25`);
      setMedicines(res.data);
    } catch (err) {
      console.error('Failed to load medicines:', err);
    } finally {
      setLoadingMeds(false);
    }
  }

  // Add medicine to cart using FEFO allocation
  async function handleAddToCart(med) {
    if (med.total_active_stock <= 0) {
      alert(`'${med.name}' is currently OUT OF STOCK!`);
      return;
    }

    try {
      // Query FEFO recommendation for this medicine
      const fefoRes = await api.get(`/medicines/${med.id}/fefo?quantity=1`);
      const allocation = fefoRes.data.allocations[0];

      if (!allocation) {
        alert('No active, non-expired batch found for this medicine.');
        return;
      }

      setCart(prev => {
        const existingIndex = prev.findIndex(item => item.medicineId === med.id && item.batchId === allocation.batchId);
        if (existingIndex >= 0) {
          const item = prev[existingIndex];
          if (item.quantity + 1 > allocation.availableQuantity) {
            alert(`Cannot add more: Batch '${allocation.batchNumber}' has only ${allocation.availableQuantity} units available.`);
            return prev;
          }
          const updated = [...prev];
          updated[existingIndex] = { ...item, quantity: item.quantity + 1 };
          return updated;
        }

        return [
          ...prev,
          {
            medicineId: med.id,
            medicineName: med.name,
            dosageForm: med.dosage_form,
            strength: med.strength,
            unitOfMeasure: med.unit_of_measure,
            batchId: allocation.batchId,
            batchNumber: allocation.batchNumber,
            expiryDate: allocation.expiryDate,
            unitPrice: allocation.salePrice,
            quantity: 1,
            availableQuantity: allocation.availableQuantity,
          },
        ];
      });
    } catch (err) {
      alert(err.message || 'Error resolving FEFO batch for medicine');
    }
  }

  function updateQuantity(index, newQty) {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    const item = cart[index];
    if (newQty > item.availableQuantity) {
      alert(`Batch '${item.batchNumber}' only has ${item.availableQuantity} units available.`);
      return;
    }
    setCart(prev => {
      const next = [...prev];
      next[index] = { ...item, quantity: newQty };
      return next;
    });
  }

  function removeFromCart(index) {
    setCart(prev => prev.filter((_, i) => i !== index));
  }

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountVal = Math.min(subtotal, Math.max(0, parseFloat(discount) || 0));
  const taxable = Math.max(0, subtotal - discountVal);
  const taxRate = 10; // 10%
  const taxAmount = parseFloat(((taxable * taxRate) / 100).toFixed(2));
  const grandTotal = parseFloat((taxable + taxAmount).toFixed(2));

  // Set default amount paid when total changes
  useEffect(() => {
    if (!amountPaid || parseFloat(amountPaid) < grandTotal) {
      setAmountPaid(grandTotal > 0 ? grandTotal.toFixed(2) : '');
    }
  }, [grandTotal]);

  const paidVal = parseFloat(amountPaid) || 0;
  const changeDue = Math.max(0, paidVal - grandTotal);

  async function handleCheckout(e) {
    e.preventDefault();
    if (cart.length === 0) {
      setCheckoutError('Shopping cart is empty. Add at least one medicine.');
      return;
    }
    if (paidVal < grandTotal) {
      setCheckoutError(`Tendered amount ($${paidVal.toFixed(2)}) is less than grand total ($${grandTotal.toFixed(2)}).`);
      return;
    }

    setSubmitting(true);
    setCheckoutError('');

    try {
      const payload = {
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim() || null,
        doctorName: doctorName.trim() || null,
        paymentMethod,
        amountPaid: paidVal,
        discount: discountVal,
        items: cart.map(item => ({
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      const res = await api.post('/sales', payload);
      setCompletedSale(res.data);
      // Reset POS cart
      setCart([]);
      setDiscount('0');
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
      setDoctorName('');
      loadMedicines(); // Refresh stock counts
    } catch (err) {
      setCheckoutError(err.message || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* POS Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-emerald-600" />
            <span>Point of Sale (POS) Checkout</span>
          </h2>
          <p className="text-xs text-slate-500">
            Real-time batch stock deduction • Automated FEFO allocation • Instant Tax Invoicing
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500">Cashier on Shift:</span>
          <p className="text-sm font-semibold text-slate-800">{user?.fullName} ({user?.role})</p>
        </div>
      </div>

      {/* Main Grid: Left = Medicine Selector, Right = Cart & Payment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Medicine Search & Catalogue (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by medicine name, generic salt, SKU barcode..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none shadow-2xs"
            />
          </div>

          {/* Medicines Grid */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider pb-2 border-b border-slate-100">
              <span>Available Products ({medicines.length})</span>
              <span>Click to Add (FEFO Automated)</span>
            </div>

            {loadingMeds ? (
              <div className="py-12 text-center text-slate-400 text-sm">Searching inventory...</div>
            ) : medicines.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No medicines found matching criteria.</div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[58vh] overflow-y-auto">
                {medicines.map(med => {
                  const isOutOfStock = med.total_active_stock <= 0;
                  const isLowStock = med.total_active_stock > 0 && med.total_active_stock <= med.reorder_level;

                  return (
                    <div
                      key={med.id}
                      onClick={() => !isOutOfStock && handleAddToCart(med)}
                      className={`py-3 px-2 flex items-center justify-between rounded-xl transition ${
                        isOutOfStock
                          ? 'opacity-50 cursor-not-allowed bg-slate-50'
                          : 'hover:bg-emerald-50/60 cursor-pointer'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-semibold text-sm text-slate-900">{med.name}</p>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600 border">
                            {med.dosage_form}
                          </span>
                          {med.prescription_required === 1 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-amber-100 text-amber-800 border border-amber-200">
                              Rx Required
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {med.generic_name} • <span className="font-mono">{med.sku}</span>
                        </p>
                        {med.earliest_expiry && (
                          <p className="text-[11px] text-emerald-700 flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-3 h-3" />
                            <span>Earliest Exp: {med.earliest_expiry}</span>
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-sm text-slate-900">
                          {med.min_sale_price ? formatCurrency(med.min_sale_price) : '—'}
                        </p>
                        <p
                          className={`text-xs font-semibold mt-0.5 ${
                            isOutOfStock
                              ? 'text-rose-600'
                              : isLowStock
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {isOutOfStock ? 'OUT OF STOCK' : `${med.total_active_stock} units`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Cart, Customer & Checkout (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <form onSubmit={handleCheckout} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col h-full">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span>Sale Cart</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  {cart.length} items
                </span>
              </h3>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="py-3 flex-1 min-h-[220px] max-h-[300px] overflow-y-auto divide-y divide-slate-100">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <ShoppingCart className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  Cart is empty. Select medicines from the left to allocate batches.
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex-1 mr-2">
                      <p className="font-semibold text-slate-900 leading-tight">{item.medicineName}</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Batch: <span className="text-slate-800 font-medium">{item.batchNumber}</span> (Exp: {item.expiryDate})
                      </p>
                      <p className="text-slate-600 mt-0.5">
                        {formatCurrency(item.unitPrice)} each
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => updateQuantity(idx, item.quantity - 1)}
                          className="p-1 text-slate-600 hover:text-slate-900"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-bold text-slate-900">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(idx, item.quantity + 1)}
                          className="p-1 text-slate-600 hover:text-slate-900"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <p className="w-16 text-right font-bold text-slate-900">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </p>

                      <button
                        type="button"
                        onClick={() => removeFromCart(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Customer & Prescription Details */}
            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-0.5">Customer Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Walk-in Customer"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-0.5">Contact Phone</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="+1-555-0000"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-0.5">Prescribing Doctor (Optional)</label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={e => setDoctorName(e.target.value)}
                  placeholder="Dr. Name / Hospital Ref"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Payment Method</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'CASH', label: 'Cash', icon: Banknote },
                    { id: 'CARD', label: 'Card', icon: CreditCard },
                    { id: 'UPI', label: 'UPI/QR', icon: QrCode },
                    { id: 'INSURANCE', label: 'Insure', icon: ShieldAlert },
                  ].map(m => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`p-2 rounded-xl text-center border font-medium transition flex flex-col items-center justify-center gap-1 ${
                          paymentMethod === m.id
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-[10px]">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Totals & Cash Tender */}
            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Estimated Tax (10%):</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="text-emerald-700">{formatCurrency(grandTotal)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-0.5">Amount Tendered ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg font-bold text-slate-900 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-0.5">Change Due</label>
                  <div className="px-2.5 py-1.5 bg-slate-100 border rounded-lg font-bold text-slate-900 text-right">
                    {formatCurrency(changeDue)}
                  </div>
                </div>
              </div>
            </div>

            {checkoutError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

            {/* Checkout Action Button */}
            <button
              type="submit"
              disabled={submitting || cart.length === 0}
              className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>{submitting ? 'Processing Transaction...' : `Complete Sale (${formatCurrency(grandTotal)})`}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Invoice Print Preview Modal upon checkout */}
      <Modal
        isOpen={!!completedSale}
        onClose={() => setCompletedSale(null)}
        title="Sale Completed Successfully • Tax Invoice"
        maxWidth="max-w-3xl"
      >
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-800 text-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Batch stock successfully deducted and recorded in immutable Stock Ledger. Click Print Invoice below.</span>
        </div>
        <PrintableInvoice sale={completedSale} onClose={() => setCompletedSale(null)} />
      </Modal>
    </div>
  );
}
