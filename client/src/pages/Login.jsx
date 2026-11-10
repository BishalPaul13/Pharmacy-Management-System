import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pill, Shield, Lock, User, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      setSuccess(true);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (u, p) => {
    setUsername(u);
    setPassword(p);
    setError('');
    setLoading(true);
    try {
      await login(u, p);
      setSuccess(true);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 items-center justify-center text-white shadow-lg shadow-emerald-950/40 mb-4">
          <Pill className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">MediCare PMS</h2>
        <p className="mt-1 text-sm text-slate-400">
          Enterprise Pharmacy Management & FEFO Inventory System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-800 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Authentication verified! Redirecting to operational portal...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition"
                  placeholder="Enter username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Authenticating & Loading...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Credentials Preset */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center mb-3">
              Instant One-Click Reviewer Sign In
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin', 'admin123')}
                disabled={loading}
                className="p-2 text-left bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition cursor-pointer"
                title="Click to instantly sign in as Administrator"
              >
                <div className="font-semibold text-xs text-purple-900 flex items-center justify-between">
                  <span>Admin</span>
                  <ArrowRight className="w-3 h-3 text-purple-600" />
                </div>
                <div className="text-[10px] text-purple-700 font-mono mt-0.5">admin / admin123</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('pharmacist', 'pharm123')}
                disabled={loading}
                className="p-2 text-left bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition cursor-pointer"
                title="Click to instantly sign in as Pharmacist"
              >
                <div className="font-semibold text-xs text-blue-900 flex items-center justify-between">
                  <span>Pharmacist</span>
                  <ArrowRight className="w-3 h-3 text-blue-600" />
                </div>
                <div className="text-[10px] text-blue-700 font-mono mt-0.5">pharm / pharm123</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('cashier', 'cash123')}
                disabled={loading}
                className="p-2 text-left bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer"
                title="Click to instantly sign in as Cashier"
              >
                <div className="font-semibold text-xs text-emerald-900 flex items-center justify-between">
                  <span>Cashier</span>
                  <ArrowRight className="w-3 h-3 text-emerald-600" />
                </div>
                <div className="text-[10px] text-emerald-700 font-mono mt-0.5">cash / cash123</div>
              </button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Operational safety: Fictional catalogue. Does not provide medical advice.
        </p>
      </div>
    </div>
  );
}
