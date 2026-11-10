import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Eye,
  CheckCircle,
} from 'lucide-react';
import { api } from '../utils/api';
import { Modal } from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

export function Purchases() {
  const { hasRole } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);

  // Inward Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    {
      medicineId: '',
      batchNumber: '',
      initialQuantity: 50,
      costPrice: 10.0,
      salePrice: 18.0,
      manufacturingDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [pRes, sRes, mRes] = await Promise.all([
        api.get('/purchases'),
        api.get('/suppliers'),
        api.get('/medicines?limit=100'),
      ]);
      setPurchases(pRes.data);
      setSuppliers(sRes.data);
      setMedicines(mRes.data);
    } catch (err) {
      console.error('Failed to load purchases:', err);
    } finally {
      setLoading(false);
    }
  }

  function addItemRow() {
    setItems([
      ...items,
      {
        medicineId: '',
        batchNumber: `B26-${Math.floor(100 + Math.random() * 900)}`,
        initialQuantity: 50,
        costPrice: 10.0,
        salePrice: 18.0,
        manufacturingDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    ]);
  }

  function removeItemRow(index) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index, field, value) {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  }

  async function handleCreatePurchase(e) {
    e.preventDefault();
    setFormError('');

    if (!supplierId) {
      setFormError('Please select a supplier');
      return;
    }

    for (const item of items) {
      if (!item.medicineId || !item.batchNumber) {
        setFormError('All items must have a medicine and batch number');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        supplierId: parseInt(supplierId, 10),
        invoiceNo: invoiceNo || null,
        purchaseDate,
        notes: notes || null,
        items: items.map(i => ({
          medicineId: parseInt(i.medicineId, 10),
          batchNumber: i.batchNumber.trim().toUpperCase(),
          initialQuantity: parseInt(i.initialQuantity, 10),
          costPrice: parseFloat(i.costPrice),
          salePrice: parseFloat(i.salePrice),
          manufacturingDate: i.manufacturingDate,
          expiryDate: i.expiryDate,
        })),
      };

      await api.post('/purchases', payload);
      setIsModalOpen(false);
      // Reset form
      setSupplierId('');
      setInvoiceNo('');
      setNotes('');
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to record inward goods');
    } finally {
      setSubmitting(false);
    }
  }

  async function viewPurchaseDetails(id) {
    try {
      const res = await api.get(`/purchases/${id}`);
      setSelectedPurchase(res.data);
    } catch (err) {
      alert('Failed to load purchase details: ' + err.message);
    }
  }

  const calculatedTotal = items.reduce((sum, i) => sum + (parseFloat(i.initialQuantity) || 0) * (parseFloat(i.costPrice) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-600" />
            <span>Supplier Inward Goods & Purchases</span>
          </h2>
          <p className="text-xs text-slate-500">
            Receive new stock shipments, register manufacturer batch numbers, and update perpetual inventory
          </p>
        </div>

        {hasRole('ADMIN', 'PHARMACIST') && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Receive Inward Shipment</span>
          </button>
        )}
      </div>

      {/* Purchases Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">PO Reference</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Vendor Invoice</th>
                <th className="py-3 px-4">Inward Date</th>
                <th className="py-3 px-4 text-center">Batches Created</th>
                <th className="py-3 px-4 text-right">Total Inward Cost</th>
                <th className="py-3 px-4">Received By</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">Loading purchase records...</td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">No inward purchase records found.</td>
                </tr>
              ) : (
                purchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.reference_no}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{p.supplier_name}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{p.invoice_no || '—'}</td>
                    <td className="py-3 px-4 text-slate-600">{formatDate(p.purchase_date)}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                      {p.total_batches_received}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(p.total_cost)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.received_by_name}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => viewPurchaseDetails(p.id)}
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                        title="View Inward Batches"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inward Details Modal */}
      <Modal
        isOpen={!!selectedPurchase}
        onClose={() => setSelectedPurchase(null)}
        title={`Inward Receipt: ${selectedPurchase?.reference_no}`}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-500">Supplier:</span>
              <p className="font-semibold text-slate-800">{selectedPurchase?.supplier_name}</p>
            </div>
            <div>
              <span className="text-slate-500">Invoice No:</span>
              <p className="font-semibold text-slate-800">{selectedPurchase?.invoice_no || '—'}</p>
            </div>
            <div>
              <span className="text-slate-500">Date Received:</span>
              <p className="font-semibold text-slate-800">{formatDate(selectedPurchase?.purchase_date)}</p>
            </div>
            <div>
              <span className="text-slate-500">Total Valuation:</span>
              <p className="font-bold text-emerald-700 text-sm">{formatCurrency(selectedPurchase?.total_cost)}</p>
            </div>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                <th className="py-2 px-3">Medicine</th>
                <th className="py-2 px-3">Batch Number</th>
                <th className="py-2 px-3">Mfg Date</th>
                <th className="py-2 px-3">Expiry Date</th>
                <th className="py-2 px-3 text-center">Quantity</th>
                <th className="py-2 px-3 text-right">Cost Price</th>
                <th className="py-2 px-3 text-right">Sale Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedPurchase?.items?.map(item => (
                <tr key={item.id}>
                  <td className="py-2 px-3 font-semibold text-slate-800">{item.medicine_name}</td>
                  <td className="py-2 px-3 font-mono font-bold text-slate-900">{item.batch_number}</td>
                  <td className="py-2 px-3 text-slate-600">{item.manufacturing_date}</td>
                  <td className="py-2 px-3 text-slate-800 font-semibold">{item.expiry_date}</td>
                  <td className="py-2 px-3 text-center font-bold text-slate-900">{item.initial_quantity}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(item.cost_price)}</td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-800">{formatCurrency(item.sale_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Receive Inward Shipment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Receive Supplier Inward Shipment"
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleCreatePurchase} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Supplier *</label>
              <select
                required
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white"
              >
                <option value="">Select Supplier</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vendor Invoice / Challan</label>
              <input
                type="text"
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                placeholder="INV-SUP-9901"
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Inward Date *</label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white"
              />
            </div>
          </div>

          {/* Dynamic Itemized Batches */}
          <div className="pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Shipment Batch Items ({items.length})
              </span>
              <button
                type="button"
                onClick={addItemRow}
                className="flex items-center space-x-1 text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item Line</span>
              </button>
            </div>

            <div className="space-y-3 pt-3 max-h-[40vh] overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Medicine *</label>
                      <select
                        required
                        value={item.medicineId}
                        onChange={e => updateItem(idx, 'medicineId', e.target.value)}
                        className="w-full p-1.5 bg-white border rounded-lg"
                      >
                        <option value="">Select Medicine</option>
                        {medicines.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.dosage_form})</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Batch Number *</label>
                      <input
                        type="text"
                        required
                        value={item.batchNumber}
                        onChange={e => updateItem(idx, 'batchNumber', e.target.value)}
                        placeholder="BATCH-001"
                        className="w-full p-1.5 bg-white border rounded-lg font-mono"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.initialQuantity}
                        onChange={e => updateItem(idx, 'initialQuantity', e.target.value)}
                        className="w-full p-1.5 bg-white border rounded-lg text-center font-bold"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Cost Price ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={item.costPrice}
                        onChange={e => updateItem(idx, 'costPrice', e.target.value)}
                        className="w-full p-1.5 bg-white border rounded-lg text-right"
                      />
                    </div>

                    <div className="col-span-1 text-right pt-4">
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length <= 1}
                        className="text-slate-400 hover:text-rose-600 disabled:opacity-20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Sale Price ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={item.salePrice}
                        onChange={e => updateItem(idx, 'salePrice', e.target.value)}
                        className="w-full p-1.5 bg-white border rounded-lg text-right font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Mfg Date *</label>
                      <input
                        type="date"
                        required
                        value={item.manufacturingDate}
                        onChange={e => updateItem(idx, 'manufacturingDate', e.target.value)}
                        className="w-full p-1.5 bg-white border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Expiry Date *</label>
                      <input
                        type="date"
                        required
                        value={item.expiryDate}
                        onChange={e => updateItem(idx, 'expiryDate', e.target.value)}
                        className="w-full p-1.5 bg-white border rounded-lg font-semibold"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 border-t">
            <div className="text-xs">
              <span className="text-slate-500">Calculated Total Shipment Cost: </span>
              <span className="font-bold text-emerald-800 text-sm">{formatCurrency(calculatedTotal)}</span>
            </div>

            <div className="space-x-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border rounded-xl text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
              >
                {submitting ? 'Receiving...' : 'Confirm Inward Stock'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
