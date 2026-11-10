import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  Boxes,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  Calendar,
} from 'lucide-react';
import { api } from '../utils/api';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDate, getExpiryBadgeInfo } from '../utils/formatters';

export function Reports() {
  const [activeTab, setActiveTab] = useState('reconciliation'); // 'reconciliation', 'sales', 'valuation', 'expiry'

  // Data states
  const [salesData, setSalesData] = useState(null);
  const [valuationData, setValuationData] = useState(null);
  const [expiryData, setExpiryData] = useState(null);
  const [reconciliationData, setReconciliationData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllReports();
  }, []);

  async function loadAllReports() {
    try {
      setLoading(true);
      const [reconcileRes, salesRes, valRes, expRes] = await Promise.all([
        api.get('/reports/reconciliation'),
        api.get('/reports/sales'),
        api.get('/reports/valuation'),
        api.get('/reports/expiry?days=60'),
      ]);
      setReconciliationData(reconcileRes.data);
      setSalesData(salesRes.data);
      setValuationData(valRes.data);
      setExpiryData(expRes.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            <span>Reports, Stock Valuation & Perpetual Audit</span>
          </h2>
          <p className="text-xs text-slate-500">
            Real-time financial analytics, expiry segregation, and perpetual inventory reconciliation
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition border border-slate-200 shadow-2xs"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export / Print Report</span>
        </button>
      </div>

      {/* Report Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-px text-xs font-semibold">
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl transition border-t border-l border-r ${
            activeTab === 'reconciliation'
              ? 'bg-white text-emerald-700 border-slate-200 font-bold -mb-px'
              : 'text-slate-500 hover:text-slate-900 border-transparent bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Stock Reconciliation Audit</span>
        </button>

        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl transition border-t border-l border-r ${
            activeTab === 'sales'
              ? 'bg-white text-emerald-700 border-slate-200 font-bold -mb-px'
              : 'text-slate-500 hover:text-slate-900 border-transparent bg-slate-50'
          }`}
        >
          <DollarSign className="w-4 h-4 text-blue-600" />
          <span>Sales & Gross Margin</span>
        </button>

        <button
          onClick={() => setActiveTab('valuation')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl transition border-t border-l border-r ${
            activeTab === 'valuation'
              ? 'bg-white text-emerald-700 border-slate-200 font-bold -mb-px'
              : 'text-slate-500 hover:text-slate-900 border-transparent bg-slate-50'
          }`}
        >
          <Boxes className="w-4 h-4 text-purple-600" />
          <span>Inventory Valuation</span>
        </button>

        <button
          onClick={() => setActiveTab('expiry')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl transition border-t border-l border-r ${
            activeTab === 'expiry'
              ? 'bg-white text-emerald-700 border-slate-200 font-bold -mb-px'
              : 'text-slate-500 hover:text-slate-900 border-transparent bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-600" />
          <span>Expiry & Shelf-Life Watchlist</span>
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs">Computing report metrics...</div>
      ) : (
        <>
          {/* TAB 1: Stock Reconciliation Audit (Acceptance Test 5) */}
          {activeTab === 'reconciliation' && reconciliationData && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-emerald-900 flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Perpetual Inventory Reconciliation Audit</span>
                  </h3>
                  <p className="mt-1 text-emerald-800">
                    Mathematical Proof: <span className="font-mono font-bold">Opening Stock + Inward Purchases - Sales Deductions + Customer Returns - Supplier Returns - Disposals/Damaged + Audit Adjustments = Current Physical Stock</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider">
                    {reconciliationData.overallStatus}
                  </span>
                  <p className="text-[11px] text-emerald-700 mt-1">
                    Audited Batches: {reconciliationData.totalBatchesAudited} • Discrepancies: {reconciliationData.batchesWithDiscrepancy}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Batch & SKU</th>
                        <th className="py-2.5 px-3">Medicine Name</th>
                        <th className="py-2.5 px-2 text-center">Opening</th>
                        <th className="py-2.5 px-2 text-center text-emerald-700">Purchases (+)</th>
                        <th className="py-2.5 px-2 text-center text-rose-700">Sales (-)</th>
                        <th className="py-2.5 px-2 text-center text-emerald-700">Cust Ret (+)</th>
                        <th className="py-2.5 px-2 text-center text-amber-700">Supp Ret (-)</th>
                        <th className="py-2.5 px-2 text-center text-rose-700">Damaged/Exp (-)</th>
                        <th className="py-2.5 px-2 text-center text-purple-700">Audit Adj</th>
                        <th className="py-2.5 px-2 text-center bg-slate-100 font-bold">Calculated Closing</th>
                        <th className="py-2.5 px-2 text-center bg-emerald-50 text-emerald-900 font-bold">Physical Stock</th>
                        <th className="py-2.5 px-2 text-center">Variance</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {reconciliationData.batches.map(b => (
                        <tr key={b.batchId} className="hover:bg-slate-50/60 transition">
                          <td className="py-2 px-3 font-bold text-slate-900">{b.batchNumber}</td>
                          <td className="py-2 px-3 font-sans font-medium text-slate-800">{b.medicineName}</td>
                          <td className="py-2 px-2 text-center text-slate-600">{b.openingStock}</td>
                          <td className="py-2 px-2 text-center text-emerald-700 font-semibold">+{b.purchases}</td>
                          <td className="py-2 px-2 text-center text-rose-600 font-semibold">-{b.sales}</td>
                          <td className="py-2 px-2 text-center text-emerald-600">+{b.customerReturns}</td>
                          <td className="py-2 px-2 text-center text-amber-600">-{b.supplierReturns}</td>
                          <td className="py-2 px-2 text-center text-rose-600">-{b.damagedWriteOff + b.expiredDisposal}</td>
                          <td className="py-2 px-2 text-center text-purple-600">{b.auditAdjustments >= 0 ? `+${b.auditAdjustments}` : b.auditAdjustments}</td>
                          <td className="py-2 px-2 text-center font-bold bg-slate-50 text-slate-900">{b.calculatedClosingStock}</td>
                          <td className="py-2 px-2 text-center font-bold bg-emerald-50/60 text-emerald-800">{b.actualPhysicalStock}</td>
                          <td className="py-2 px-2 text-center font-bold text-slate-500">{b.discrepancy}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{b.status}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Sales & Gross Margin */}
          {activeTab === 'sales' && salesData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Gross Revenue"
                  value={formatCurrency(salesData.totals.total_revenue)}
                  subtitle={`${salesData.totals.total_transactions} total invoices`}
                  icon={DollarSign}
                  color="emerald"
                />
                <StatCard
                  title="Cost of Goods Sold (COGS)"
                  value={formatCurrency(salesData.totals.total_cogs)}
                  subtitle="Recorded batch purchase costs"
                  icon={Boxes}
                  color="slate"
                />
                <StatCard
                  title="Gross Profit"
                  value={formatCurrency(salesData.totals.estimated_gross_profit)}
                  subtitle={`Margin: ${salesData.totals.margin_percentage}%`}
                  icon={TrendingUp}
                  color="blue"
                />
                <StatCard
                  title="Sales Tax Collected"
                  value={formatCurrency(salesData.totals.total_tax)}
                  subtitle="10% configured tax pool"
                  icon={DollarSign}
                  color="amber"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Selling Medicines */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <h3 className="font-bold text-slate-900 text-sm mb-3">Top Performing Medicines by Volume</h3>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-slate-400 font-semibold text-[10px] uppercase">
                        <th className="py-2">Medicine</th>
                        <th className="py-2 text-center">Units Sold</th>
                        <th className="py-2 text-right">Revenue</th>
                        <th className="py-2 text-right">Gross Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {salesData.topProducts.map((p, idx) => (
                        <tr key={idx}>
                          <td className="py-2 font-semibold text-slate-800">{p.medicine_name}</td>
                          <td className="py-2 text-center font-bold text-slate-900">{p.units_sold}</td>
                          <td className="py-2 text-right font-medium text-slate-700">{formatCurrency(p.total_revenue)}</td>
                          <td className="py-2 text-right font-bold text-emerald-700">{formatCurrency(p.gross_profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Sales by Payment Method */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <h3 className="font-bold text-slate-900 text-sm mb-3">Revenue by Payment Channel</h3>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-slate-400 font-semibold text-[10px] uppercase">
                        <th className="py-2">Payment Method</th>
                        <th className="py-2 text-center">Transactions</th>
                        <th className="py-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {salesData.byPayment.map((pm, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 font-bold text-slate-800">{pm.payment_method}</td>
                          <td className="py-2.5 text-center text-slate-600">{pm.transaction_count}</td>
                          <td className="py-2.5 text-right font-bold text-slate-900">{formatCurrency(pm.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Inventory Valuation */}
          {activeTab === 'valuation' && valuationData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  title="Total Inventory Purchase Cost"
                  value={formatCurrency(valuationData.summary.costValuation)}
                  subtitle={`${valuationData.summary.totalUnits.toLocaleString()} units in stock`}
                  icon={Boxes}
                  color="purple"
                />
                <StatCard
                  title="Total Inventory Retail Value"
                  value={formatCurrency(valuationData.summary.retailValuation)}
                  subtitle="Potential selling value"
                  icon={DollarSign}
                  color="emerald"
                />
                <StatCard
                  title="Projected Unrealized Profit"
                  value={formatCurrency(valuationData.summary.potentialProfit)}
                  subtitle="Estimated gross spread"
                  icon={TrendingUp}
                  color="blue"
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Medicine Brand</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-center">Units on Hand</th>
                      <th className="py-3 px-4 text-right">Total Cost Value</th>
                      <th className="py-3 px-4 text-right">Total Retail Value</th>
                      <th className="py-3 px-4 text-right">Projected Spread</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {valuationData.medicines.map(m => (
                      <tr key={m.medicine_id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-600">{m.sku}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{m.medicine_name}</td>
                        <td className="py-2.5 px-4 text-slate-600">{m.category_name}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-900">{m.total_stock_units}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(m.total_cost_valuation)}</td>
                        <td className="py-2.5 px-4 text-right font-medium text-slate-800">{formatCurrency(m.total_retail_valuation)}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-700">{formatCurrency(m.potential_profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Expiry Report */}
          {activeTab === 'expiry' && expiryData && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                  <p className="text-[11px] font-semibold text-rose-800 uppercase">Expired Batches</p>
                  <p className="text-2xl font-bold text-rose-900 mt-1">{expiryData.counts.expired}</p>
                  <p className="text-[10px] text-rose-600 mt-1">Blocked from Point of Sale</p>
                </div>
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <p className="text-[11px] font-semibold text-red-800 uppercase">Critical (≤ 15 Days)</p>
                  <p className="text-2xl font-bold text-red-900 mt-1">{expiryData.counts.critical}</p>
                  <p className="text-[10px] text-red-600 mt-1">FEFO top priority / alert</p>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <p className="text-[11px] font-semibold text-amber-800 uppercase">Warning (16-60 Days)</p>
                  <p className="text-2xl font-bold text-amber-900 mt-1">{expiryData.counts.warning}</p>
                  <p className="text-[10px] text-amber-600 mt-1">Near expiry monitor</p>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <p className="text-[11px] font-semibold text-emerald-800 uppercase">Safe (&gt; 60 Days)</p>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">{expiryData.counts.safe}</p>
                  <p className="text-[10px] text-emerald-600 mt-1">Ample shelf life</p>
                </div>
              </div>

              {/* Expired Batches Warning */}
              {expiryData.groups.expired.length > 0 && (
                <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-xs">
                  <h3 className="font-bold text-rose-900 text-sm mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Expired Batches (Strictly Blocked from Dispensing)</span>
                  </h3>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-slate-400 font-semibold text-[10px] uppercase">
                        <th className="py-2">Batch</th>
                        <th className="py-2">Medicine</th>
                        <th className="py-2">Expired On</th>
                        <th className="py-2 text-center">Remaining Stock</th>
                        <th className="py-2 text-right">Cost Value Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expiryData.groups.expired.map(b => (
                        <tr key={b.id} className="bg-rose-50/40">
                          <td className="py-2 font-mono font-bold text-rose-900">{b.batch_number}</td>
                          <td className="py-2 font-semibold text-slate-900">{b.medicine_name}</td>
                          <td className="py-2 text-rose-700 font-bold">{b.expiry_date}</td>
                          <td className="py-2 text-center font-bold text-slate-800">{b.quantity}</td>
                          <td className="py-2 text-right font-medium text-rose-700">{formatCurrency(b.quantity * b.cost_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
