import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  Boxes,
  Truck,
  Users,
  RotateCcw,
  BarChart3,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Sidebar() {
  const { user, hasRole } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['ADMIN', 'PHARMACIST', 'CASHIER'] },
    { label: 'Point of Sale (POS)', path: '/pos', icon: ShoppingCart, roles: ['ADMIN', 'PHARMACIST', 'CASHIER'], highlight: true },
    { label: 'Medicine Catalogue', path: '/medicines', icon: Pill, roles: ['ADMIN', 'PHARMACIST', 'CASHIER'] },
    { label: 'Batch Inventory & FEFO', path: '/batches', icon: Boxes, roles: ['ADMIN', 'PHARMACIST', 'CASHIER'] },
    { label: 'Purchases (Inward)', path: '/purchases', icon: Truck, roles: ['ADMIN', 'PHARMACIST'] },
    { label: 'Suppliers Directory', path: '/suppliers', icon: Users, roles: ['ADMIN', 'PHARMACIST'] },
    { label: 'Returns & Adjustments', path: '/adjustments', icon: RotateCcw, roles: ['ADMIN', 'PHARMACIST'] },
    { label: 'Reports & Reconciliation', path: '/reports', icon: BarChart3, roles: ['ADMIN', 'PHARMACIST'] },
    { label: 'Audit Trail', path: '/audit', icon: ShieldCheck, roles: ['ADMIN'] },
  ];

  const visibleItems = navItems.filter(item => hasRole(...item.roles));

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-5 flex items-center space-x-3 border-b border-slate-800/80">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-900/30">
          <Pill className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
            MediCare <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PMS</span>
          </h1>
          <p className="text-xs text-slate-400">Enterprise Pharmacy</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Operations & Inventory
        </div>
        {visibleItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : item.highlight
                    ? 'text-emerald-400 hover:bg-slate-800/80 hover:text-white'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Operational Disclaimer & Version */}
      <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-500 space-y-1">
        <p className="font-medium text-slate-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          FEFO Engine Active
        </p>
        <p className="text-[10px] leading-relaxed text-slate-500">
          Demo Dataset • Fictional Medicines • Not Medical Advice
        </p>
      </div>
    </aside>
  );
}

