import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  Ban,
  Package,
  ShoppingCart,
  PlusCircle,
  Eye,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../utils/api';
import { StatCard } from '../components/StatCard';
import { Modal } from '../components/Modal';
import { PrintableInvoice } from '../components/PrintableInvoice';
import { formatCurrency, formatDateTime, getExpiryBadgeInfo } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

export function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const res = await api.get('/reports/dashboard');
      setData(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }

  async function viewInvoice(id) {
    try {
      const res = await api.get(`/sales/${id}`);
      setSelectedSale(res.data);
    } catch (err) {
      alert('Could not retrieve invoice: ' + err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700">
        <h3 className="font-bold">Error Loading Dashboard</h3>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Operations */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-6 rounded-2xl shadow-sm">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
            Role: {user?.role}
          </span>
          <h2 className="text-2xl font-bold mt-2">Welcome back, {user?.fullName}!</h2>
          <p className="text-xs text-emerald-200/80 mt-1 max-w-xl">
            FEFO Inventory & Batch Tracking active. All critical transactions are ACID-audited.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/pos"
            className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-xl text-sm transition shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Launch POS Checkout</span>
          </Link>
          {user?.role !== 'CASHIER' && (
            <Link
              to="/purchases"
              className="flex items-center space-x-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl text-sm transition border border-white/10"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Inward Goods</span>
            </Link>
          )}
        </div>
      </div>

      {/* Operational Alert Banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Low Stock Warning */}
        <Link
          to="/medicines?lowStock=true"
          className="p-4 bg-amber-50 border border-amber-200 hover:border-amber-300 rounded-xl flex items-center justify-between transition group shadow-2xs"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-900 uppercase">Low Stock Alert</p>
              <p className="text-lg font-bold text-amber-800">{data.alerts.lowStockCount} Medicines</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition" />
        </Link>

        {/* Near Expiry Warning */}
        <Link
          to="/reports"
          className="p-4 bg-orange-50 border border-orange-200 hover:border-orange-300 rounded-xl flex items-center justify-between transition group shadow-2xs"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-orange-100 rounded-xl text-orange-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-900 uppercase">Expiring in &lt; 60 Days</p>
              <p className="text-lg font-bold text-orange-800">{data.alerts.nearExpiryCount} Batches</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-orange-500 group-hover:translate-x-1 transition" />
        </Link>

        {/* Expired Batches Blocked */}
        <Link
          to="/batches"
          className="p-4 bg-rose-50 border border-rose-200 hover:border-rose-300 rounded-xl flex items-center justify-between transition group shadow-2xs"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-100 rounded-xl text-rose-700">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-rose-900 uppercase">Expired / Quarantined</p>
              <p className="text-lg font-bold text-rose-800">{data.alerts.expiredBatchCount} Blocked Batches</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-rose-500 group-hover:translate-x-1 transition" />
        </Link>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales Revenue"
          value={formatCurrency(data.sales.today.total_revenue)}
          subtitle={`${data.sales.today.count} transactions completed`}
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          title="Current Month Sales"
          value={formatCurrency(data.sales.month.total_revenue)}
          subtitle={`${data.sales.month.count} orders this month`}
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          title="Inventory Valuation (Cost)"
          value={formatCurrency(data.inventory.costValuation)}
          subtitle={`${data.inventory.totalUnits.toLocaleString()} total units on hand`}
          icon={Package}
          color="purple"
        />
        <StatCard
          title="Retail Valuation (MRP)"
          value={formatCurrency(data.inventory.retailValuation)}
          subtitle={`Proj. Margin: ${formatCurrency(data.inventory.potentialProfit)}`}
          icon={TrendingUp}
          color="amber"
        />
      </div>

      {/* Two Column Layout: Urgent Expiry Watchlist & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Batches Shelf-Life Watchlist */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Urgent Shelf-Life Watchlist</h3>
              <p className="text-xs text-slate-500">Batches requiring FIFO/FEFO priority or quarantine</p>
            </div>
            <Link to="/reports" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              View All &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {data.urgentBatches.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No urgent batches expiring soon.</p>
            ) : (
              data.urgentBatches.map(batch => {
                const badge = getExpiryBadgeInfo(batch.expiry_date);
                return (
                  <div key={batch.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{batch.medicine_name}</p>
                      <p className="text-slate-400 font-mono mt-0.5">
                        Batch: <span className="text-slate-700">{batch.batch_number}</span> • Expiry: {batch.expiry_date}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full font-medium border ${badge.color}`}>
                        {badge.label}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1 font-semibold">{batch.quantity} units in stock</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Completed Sales */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent Completed Invoices</h3>
              <p className="text-xs text-slate-500">ACID-deducted sales with printable receipts</p>
            </div>
            <Link to="/pos" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              Open POS &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {data.recentSales.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No sales recorded yet.</p>
            ) : (
              data.recentSales.map(sale => (
                <div key={sale.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-semibold text-slate-800">{sale.invoice_no}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 font-medium text-slate-600 border">
                        {sale.payment_method}
                      </span>
                    </div>
                    <p className="text-slate-500 mt-0.5">{sale.customer_name} • {formatDateTime(sale.sale_date)}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <p className="font-bold text-slate-900">{formatCurrency(sale.total_amount)}</p>
                    <button
                      onClick={() => viewInvoice(sale.id)}
                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                      title="View printable tax invoice"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Printable Invoice Modal */}
      <Modal
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        title={`Tax Invoice: ${selectedSale?.invoice_no}`}
        maxWidth="max-w-3xl"
      >
        <PrintableInvoice sale={selectedSale} onClose={() => setSelectedSale(null)} />
      </Modal>
    </div>
  );
}

