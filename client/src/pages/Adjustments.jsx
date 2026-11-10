import React, { useState, useEffect } from 'react';
import { RotateCcw, Plus, AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';
import { api } from '../utils/api';
import { Modal } from '../components/Modal';
import { formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

export function Adjustments() {
  const { hasRole } = useAuth();
  const [adjustments, setAdjustments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [type, setType] = useState('DAMAGED_WRITE_OFF');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [adjRes, bRes] = await Promise.all([
        api.get('/adjustments'),
        api.get('/batches?limit=100'),
      ]);
      setAdjustments(adjRes.data);
      setBatches(bRes.data);
    } catch (err) {
      console.error('Failed to load adjustments data:', err);
    } finally {
      setLoading(false);
    }
  }

  const selectedBatch = batches.find(b => b.id === parseInt(selectedBatchId, 10));

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    if (!selectedBatchId) {
      setFormError('Please select a target batch');
      return;
    }

    if (!reason || reason.trim().length < 3) {
      setFormError('A detailed operational reason (minimum 3 characters) is strictly mandatory');
      return;
    }

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum === 0) {
      setFormError('Quantity must be a non-zero integer');
      return;
    }

    // Determine sign: reduction vs addition
    let delta = qtyNum;
    if (type === 'DAMAGED_WRITE_OFF' || type === 'EXPIRED_DISPOSAL' || type === 'SUPPLIER_RETURN') {
      delta = -Math.abs(qtyNum);
    } else if (type === 'CUSTOMER_RETURN') {
      delta = Math.abs(qtyNum);
    }

    // Pre-validate negative stock
    if (selectedBatch && selectedBatch.quantity + delta < 0) {
      setFormError(`Insufficient stock in batch. Current stock is ${selectedBatch.quantity}, cannot reduce by ${Math.abs(delta)}.`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/adjustments', {
        type,
        batchId: parseInt(selectedBatchId, 10),
        quantity: delta,
        reason: reason.trim(),
      });

      setIsModalOpen(false);
      setSelectedBatchId('');
      setQuantity('1');
      setReason('');
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to process adjustment');
    } finally {
      setSubmitting(false);
    }
  }

  const typeLabels = {
    CUSTOMER_RETURN: { label: 'Customer Return', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    SUPPLIER_RETURN: { label: 'Supplier Return', color: 'bg-blue-50 text-blue-800 border-blue-200' },
    EXPIRED_DISPOSAL: { label: 'Expired Disposal', color: 'bg-rose-50 text-rose-800 border-rose-200' },
    DAMAGED_WRITE_OFF: { label: 'Damaged Write-Off', color: 'bg-amber-50 text-amber-800 border-amber-200' },
    PHYSICAL_AUDIT_CORRECTION: { label: 'Audit Correction', color: 'bg-purple-50 text-purple-800 border-purple-200' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-emerald-600" />
            <span>Returns & Inventory Adjustments</span>
          </h2>
          <p className="text-xs text-slate-500">
            Audit-backed stock write-offs, customer returns, expired disposals, and perpetual ledger tracking
          </p>
        </div>

        {hasRole('ADMIN', 'PHARMACIST') && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Record Return / Adjustment</span>
          </button>
        )}
      </div>

      {/* Adjustments Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Ref Number</th>
                <th className="py-3 px-4">Adjustment Type</th>
                <th className="py-3 px-4">Medicine & SKU</th>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4 text-center">Quantity Delta</th>
                <th className="py-3 px-4">Mandatory Operational Reason</th>
                <th className="py-3 px-4">Audited Performer</th>
                <th className="py-3 px-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">Loading adjustments...</td>
                </tr>
              ) : adjustments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">No stock adjustments recorded.</td>
                </tr>
              ) : (
                adjustments.map(adj => {
                  const typeInfo = typeLabels[adj.type] || { label: adj.type, color: 'bg-slate-100' };
                  const isPositive = adj.quantity > 0;

                  return (
                    <tr key={adj.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{adj.reference_no}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-medium border text-[11px] ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{adj.medicine_name}</div>
                        <div className="text-slate-400 text-[10px] font-mono">{adj.medicine_sku}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 font-medium">{adj.batch_number}</td>
                      <td className="py-3 px-4 text-center font-bold text-sm">
                        <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                          {isPositive ? `+${adj.quantity}` : adj.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={adj.reason}>
                        {adj.reason}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{adj.performed_by_name}</td>
                      <td className="py-3 px-4 text-right text-slate-500">{formatDate(adj.created_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Adjustment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Stock Adjustment or Customer Return"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Adjustment Scenario *</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white text-xs font-medium"
            >
              <option value="CUSTOMER_RETURN">Customer Return (Restores Stock +)</option>
              <option value="DAMAGED_WRITE_OFF">Damaged / Broken Write-off (Reduces Stock -)</option>
              <option value="EXPIRED_DISPOSAL">Expired Stock Disposal (Reduces Stock -)</option>
              <option value="SUPPLIER_RETURN">Return to Supplier / Recall (Reduces Stock -)</option>
              <option value="PHYSICAL_AUDIT_CORRECTION">Physical Count Reconciliation</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Batch to Adjust *</label>
            <select
              required
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white text-xs"
            >
              <option value="">Select Target Batch</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.medicine_name} — Batch: {b.batch_number} (Current Stock: {b.quantity}, Exp: {b.expiry_date})
                </option>
              ))}
            </select>
            {selectedBatch && (
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Current active stock on hand: <span className="font-bold text-slate-800">{selectedBatch.quantity} units</span>
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Quantity {type === 'CUSTOMER_RETURN' ? 'to Add (+)' : 'to Deduct (-)'} *
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Mandatory Operational Reason (Required for Audit Trail) *
            </label>
            <textarea
              required
              rows="3"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Provide specific reason (e.g., Unopened sealed bottle returned with receipt; or Dropped glass vial during stocking)"
              className="w-full p-2.5 bg-slate-50 border rounded-xl outline-none focus:bg-white"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">
              Minimum 3 characters required. Stored permanently in system audit ledger.
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t">
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
              {submitting ? 'Auditing & Adjusting...' : 'Commit Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
