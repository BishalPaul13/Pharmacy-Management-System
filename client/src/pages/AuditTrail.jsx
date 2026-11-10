import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, Clock, Eye, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/formatters';
import { Modal } from '../components/Modal';

export function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    loadLogs();
  }, [actionFilter, entityFilter, usernameFilter]);

  async function loadLogs() {
    try {
      setLoading(true);
      let query = `?limit=100`;
      if (actionFilter) query += `&action=${actionFilter}`;
      if (entityFilter) query += `&entityType=${entityFilter}`;
      if (usernameFilter) query += `&username=${encodeURIComponent(usernameFilter)}`;

      const res = await api.get(`/audit-logs${query}`);
      setLogs(res.data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve system audit trail (Requires ADMIN role)');
    } finally {
      setLoading(false);
    }
  }

  const actionColors = {
    AUTH_LOGIN_SUCCESS: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    SALE_COMPLETED: 'bg-blue-50 text-blue-800 border-blue-200',
    PURCHASE_RECEIVED: 'bg-purple-50 text-purple-800 border-purple-200',
    STOCK_ADJUSTMENT_EXECUTED: 'bg-amber-50 text-amber-800 border-amber-200',
    BATCH_STATUS_CHANGED: 'bg-rose-50 text-rose-800 border-rose-200',
    MEDICINE_CREATED: 'bg-teal-50 text-teal-800 border-teal-200',
    MEDICINE_UPDATED: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-600" />
            <span>Enterprise System Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-500">
            Immutable log of all user authentications, sales checkout events, batch adjustments, and state mutations
          </p>
        </div>
        <div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            Admin Authority Enforced
          </span>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">Access Prohibited</p>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs text-xs">
            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={usernameFilter}
                onChange={e => setUsernameFilter(e.target.value)}
                placeholder="Filter by operator username..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white"
              />
            </div>

            <div className="md:col-span-4">
              <select
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white text-slate-700"
              >
                <option value="">All Action Types</option>
                <option value="SALE_COMPLETED">SALE_COMPLETED</option>
                <option value="STOCK_ADJUSTMENT_EXECUTED">STOCK_ADJUSTMENT_EXECUTED</option>
                <option value="PURCHASE_RECEIVED">PURCHASE_RECEIVED</option>
                <option value="BATCH_STATUS_CHANGED">BATCH_STATUS_CHANGED</option>
                <option value="AUTH_LOGIN_SUCCESS">AUTH_LOGIN_SUCCESS</option>
                <option value="MEDICINE_CREATED">MEDICINE_CREATED</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <select
                value={entityFilter}
                onChange={e => setEntityFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none focus:bg-white text-slate-700"
              >
                <option value="">All Entity Categories</option>
                <option value="SALE">SALE</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
                <option value="BATCH">BATCH</option>
                <option value="PURCHASE">PURCHASE</option>
                <option value="MEDICINE">MEDICINE</option>
                <option value="USER">USER</option>
              </select>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Operator & Role</th>
                    <th className="py-3 px-4">Audit Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Entity Ref</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4 text-right">Details Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400">Loading audit ledger...</td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400">No audit events match current criteria.</td>
                    </tr>
                  ) : (
                    logs.map(log => {
                      const colorClass = actionColors[log.action] || 'bg-slate-100 text-slate-800';
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                            {formatDateTime(log.created_at)}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="font-bold text-slate-900">{log.username}</span>
                            <span className="text-slate-400 text-[10px] ml-1.5 font-medium">({log.role})</span>
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${colorClass}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-700">{log.entity_type}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-800">{log.entity_id || '—'}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px]">{log.ip_address}</td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="inline-flex items-center space-x-1 px-2 py-1 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition border border-slate-200"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect Payload</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* JSON Payload Inspection Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Audit Record #${selectedLog?.id} • ${selectedLog?.action}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-500">Operator:</span>
              <p className="font-bold text-slate-800">{selectedLog?.username} ({selectedLog?.role})</p>
            </div>
            <div>
              <span className="text-slate-500">Entity:</span>
              <p className="font-bold text-slate-800">{selectedLog?.entity_type} #{selectedLog?.entity_id}</p>
            </div>
            <div>
              <span className="text-slate-500">Timestamp:</span>
              <p className="font-mono text-slate-800">{formatDateTime(selectedLog?.created_at)}</p>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">State Mutation Data Payload (JSON)</label>
            <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed">
              {JSON.stringify(selectedLog?.details, null, 2)}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  );
}

