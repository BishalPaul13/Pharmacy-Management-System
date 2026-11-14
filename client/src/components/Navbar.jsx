import React from 'react';
import { LogOut, User, Shield, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user, logout, quickSwitch } = useAuth();

  const roleColors = {
    ADMIN: 'bg-purple-100 text-purple-800 border-purple-300',
    PHARMACIST: 'bg-blue-100 text-blue-800 border-blue-300',
    CASHIER: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 select-none">
      {/* Quick Role Switcher for Reviewers */}
      <div className="flex items-center space-x-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">
          Switch Demo Role:
        </span>
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => quickSwitch('ADMIN')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              user?.role === 'ADMIN'
                ? 'bg-purple-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Admin
          </button>
          <button
            onClick={() => quickSwitch('PHARMACIST')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              user?.role === 'PHARMACIST'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Pharmacist
          </button>
          <button
            onClick={() => quickSwitch('CASHIER')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              user?.role === 'CASHIER'
                ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Cashier
          </button>
        </div>
      </div>

      {/* Right User & System Controls */}
      <div className="flex items-center space-x-4">
        {/* User Info & Badge */}
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800 leading-tight">{user?.fullName || user?.username}</p>
            <span className={`inline-block px-2 py-0.5 mt-0.5 rounded-md text-[10px] font-bold border ${roleColors[user?.role] || 'bg-slate-100 text-slate-700'}`}>
              {user?.role}
            </span>
          </div>

          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm">
            {user?.fullName ? user.fullName[0] : 'U'}
          </div>

          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

