import React, { useState } from 'react';
import { Printer, Download, CheckCircle, ShieldAlert } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export function PrintableInvoice({ sale, onClose }) {
  const [format, setFormat] = useState('a4'); // 'a4' or 'thermal'

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Top action toolbar (Hidden during print) */}
      <div className="no-print flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFormat('a4')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${format === 'a4' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
          >
            Standard A4 Invoice
          </button>
          <button
            onClick={() => setFormat('thermal')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${format === 'thermal' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
          >
            80mm POS Thermal Slip
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>

      {/* Invoice Document Canvas */}
      <div
        id="printable-invoice-area"
        className={`bg-white border rounded-xl p-6 shadow-sm mx-auto transition-all ${
          format === 'thermal' ? 'max-w-sm text-xs font-mono' : 'max-w-3xl text-sm'
        }`}
      >
        {/* Pharmacy Header */}
        <div className="text-center pb-4 border-b border-slate-200">
          <h2 className={`font-bold text-slate-900 ${format === 'thermal' ? 'text-base' : 'text-xl'}`}>
            {sale.pharmacy?.name || 'MediCare Pharmacy & Healthcare'}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {sale.pharmacy?.address || '742 Evergreen Healthcare Blvd, Suite 100'}
          </p>
          <div className="flex justify-center items-center gap-3 text-xs text-slate-500 mt-1">
            <span>Lic: {sale.pharmacy?.license || 'PH-REG-2026-99042'}</span>
            <span>•</span>
            <span>GSTIN: {sale.pharmacy?.gstin || '27AABCM9921D1Z8'}</span>
          </div>
          <p className="text-xs text-slate-500">Tel: {sale.pharmacy?.phone || '+1 (555) 019-9000'}</p>
        </div>

        {/* Invoice & Customer Meta */}
        <div className="py-3 border-b border-slate-200 grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-semibold text-slate-800">TAX INVOICE</p>
            <p className="text-slate-600 mt-0.5"><span className="font-medium text-slate-800">Invoice No:</span> {sale.invoice_no}</p>
            <p className="text-slate-600"><span className="font-medium text-slate-800">Date:</span> {formatDateTime(sale.sale_date)}</p>
            <p className="text-slate-600"><span className="font-medium text-slate-800">Cashier:</span> {sale.cashier_name || sale.cashier_username}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-800">PATIENT / CUSTOMER</p>
            <p className="text-slate-600 mt-0.5"><span className="font-medium text-slate-800">Name:</span> {sale.customer_name || 'Walk-in Customer'}</p>
            {sale.customer_phone && <p className="text-slate-600"><span className="font-medium text-slate-800">Phone:</span> {sale.customer_phone}</p>}
            {sale.doctor_name && <p className="text-slate-600"><span className="font-medium text-slate-800">Doctor:</span> {sale.doctor_name}</p>}
            <p className="text-slate-600"><span className="font-medium text-slate-800">Payment:</span> {sale.payment_method}</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="py-3 border-b border-slate-200 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold text-xs">
                <th className="py-1.5">#</th>
                <th className="py-1.5">Medicine Description</th>
                <th className="py-1.5">Batch</th>
                <th className="py-1.5">Expiry</th>
                <th className="py-1.5 text-center">Qty</th>
                <th className="py-1.5 text-right">Rate</th>
                <th className="py-1.5 text-right">Tax</th>
                <th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sale.items?.map((item, index) => (
                <tr key={item.id || index}>
                  <td className="py-2 text-slate-400">{index + 1}</td>
                  <td className="py-2 font-medium text-slate-800">
                    <div>{item.medicine_name}</div>
                    <div className="text-slate-400 text-[10px]">{item.dosage_form} • {item.strength}</div>
                  </td>
                  <td className="py-2 font-mono text-slate-600">{item.batch_number}</td>
                  <td className="py-2 text-slate-600">{item.expiry_date}</td>
                  <td className="py-2 text-center font-semibold text-slate-800">{item.quantity}</td>
                  <td className="py-2 text-right text-slate-600">{formatCurrency(item.unit_price)}</td>
                  <td className="py-2 text-right text-slate-500">{formatCurrency(item.tax_amount)}</td>
                  <td className="py-2 text-right font-semibold text-slate-900">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="py-3 border-b border-slate-200 flex justify-end">
          <div className="w-64 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount:</span>
                <span>-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Tax ({sale.tax_rate}%):</span>
              <span>{formatCurrency(sale.tax_amount)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-slate-900 pt-1.5 border-t border-slate-200">
              <span>Grand Total:</span>
              <span>{formatCurrency(sale.total_amount)}</span>
            </div>
            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
              <span>Amount Tendered:</span>
              <span>{formatCurrency(sale.amount_paid)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Change Returned:</span>
              <span>{formatCurrency(sale.change_returned)}</span>
            </div>
          </div>
        </div>

        {/* Safety Disclaimer and Legal Footer */}
        <div className="pt-4 text-center space-y-1">
          <div className="inline-flex items-center space-x-1.5 text-[11px] text-amber-700 bg-amber-50 px-3 py-1 rounded-md border border-amber-200">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>Operational safety notice: Fictional test medicines. Not intended for actual medical treatment or advice.</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Goods once sold can only be returned in unopened, original sealed packaging within 7 days with valid tax receipt.
          </p>
          <p className="text-[10px] font-mono text-slate-400">
            Certified System Hash: {sale.invoice_no} • Tracked via Immutable Stock Ledger
          </p>
        </div>
      </div>
    </div>
  );
}

