import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Clock,
  Ban,
  ShieldCheck,
  AlertTriangle,
  Filter,
  CheckCircle,
} from 'lucide-react';
import { api } from '../utils/api';
import { Modal } from '../components/Modal';
import { formatCurrency, getExpiryBadgeInfo } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

export function Batches() {
  const { hasRole } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [nearExpiryFilter, setNearExpiryFilter] = useState('');
  const [expiredOnly, setExpiredOnly] = useState(false);

  // Quarantine Modal
  const [quarantineTarget, setQuarantineTarget] = useState(null);
  const [quarantineReason, setQuarantineReason] = useState('Regulatory quarantine: Defective packaging identified');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadBatches();
  }, [statusFilter, nearExpiryFilter, expiredOnly]);

  async function loadBatches() {
    try {
      setLoading(true);
      let query = `?limit=50`;
      if (statusFilter) query += `&status=${statusFilter}`;
      if (nearExpiryFilter) query += `&nearExpiryDays=${nearExpiryFilter}`;
      if (expiredOnly) query += `&expiredOnly=true`;

      const res = await api.get(`/batches${query}`);
      setBatches(res.data);
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleQuarantine(e) {
    e.preventDefault();
    if (!quarantineTarget) return;

    setSubmitting(true);
    try {
      await api.patch(`/batches/${quarantineTarget.id}/status`, {
        status: 'QUARANTINED',
        reason: quarantineReason.trim(),
      });
      setQuarantineTarget(null);
      loadBatches();
    } catch (err) {
      alert('Failed to quarantine batch: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-emerald-600" />
            <span>Batch Inventory & FEFO Shelf-Life</span>
          </h2>
          <p className="text-xs text-slate-500">
            Track individual batch numbers, strict expiry dates, cost valuations, and FEFO priorities
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs text-xs">
        <div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white text-slate-700"
          >
            <option value="">All Batch Statuses</option>
            <option value="ACTIVE">Active Stock</option>
            <option value="EXPIRED">Expired</option>
            <option value="QUARANTINED">Quarantined</option>
            <option value="DEPLETED">Depleted (0 Stock)</option>
          </select>
        </div>

        <div>
          <select
            value={nearExpiryFilter}
            onChange={e => {
              setNearExpiryFilter(e.target.value);
              setExpiredOnly(false);
            }}
            className="px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white text-slate-700"
          >
            <option value="">All Expiry Ranges</option>
            <option value="15">Critical Expiry (≤ 15 days)</option>
            <option value="60">Near Expiry (≤ 60 days)</option>
            <option value="90">Expiring in 90 days</option>
          </select>
        </div>

        <div>
          <label className="flex items-center space-x-2 text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={expiredOnly}
              onChange={e => {
                setExpiredOnly(e.target.checked);
                setNearExpiryFilter('');
              }}
              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
            />
            <span className="font-semibold text-rose-700">Show Expired Batches Only</span>
          </label>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Medicine & SKU</th>
                <th className="py-3 px-4">Mfg Date</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4 text-center">Remaining / Initial</th>
                <th className="py-3 px-4 text-right">Cost Price</th>
                <th className="py-3 px-4 text-right">Sale Price</th>
                <th className="py-3 px-4 text-center">Expiry Tier</th>
                {hasRole('ADMIN', 'PHARMACIST') && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">Loading batches...</td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">No batches found for current filter.</td>
                </tr>
              ) : (
                batches.map(batch => {
                  const badge = getExpiryBadgeInfo(batch.expiry_date, batch.status);
                  const isBlocked = batch.expiry_urgency === 'EXPIRED' || batch.status === 'EXPIRED' || batch.status === 'QUARANTINED';

                  return (
                    <tr key={batch.id} className={`hover:bg-slate-50/60 transition ${isBlocked ? 'bg-rose-50/20' : ''}`}>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{batch.batch_number}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{batch.medicine_name}</div>
                        <div className="text-slate-400 font-mono text-[10px]">{batch.medicine_sku}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{batch.manufacturing_date}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{batch.expiry_date}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-900 text-sm">{batch.quantity}</span>
                        <span className="text-slate-400 text-[11px]"> / {batch.initial_quantity}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(batch.cost_price)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">{formatCurrency(batch.sale_price)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-medium border text-[11px] ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      {hasRole('ADMIN', 'PHARMACIST') && (
                        <td className="py-3 px-4 text-right">
                          {batch.status === 'ACTIVE' && batch.quantity > 0 && (
                            <button
                              onClick={() => setQuarantineTarget(batch)}
                              className="px-2.5 py-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition border border-rose-200"
                            >
                              Quarantine
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quarantine Modal */}
      <Modal
        isOpen={!!quarantineTarget}
        onClose={() => setQuarantineTarget(null)}
        title={`Quarantine Batch: ${quarantineTarget?.batch_number}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleQuarantine} className="space-y-3 text-xs">
          <p className="text-slate-600">
            Quarantining this batch will immediately block it from Point of Sale dispensing and audit the action.
          </p>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mandatory Operational Reason</label>
            <textarea
              required
              rows="3"
              value={quarantineReason}
              onChange={e => setQuarantineReason(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-rose-500"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setQuarantineTarget(null)}
              className="px-3 py-1.5 border rounded-xl text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Confirm Quarantine'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

