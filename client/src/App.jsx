import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Medicines } from './pages/Medicines';
import { Batches } from './pages/Batches';
import { Purchases } from './pages/Purchases';
import { Suppliers } from './pages/Suppliers';
import { Adjustments } from './pages/Adjustments';
import { Reports } from './pages/Reports';
import { AuditTrail } from './pages/AuditTrail';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-rose-600">Access Restricted</h2>
        <p className="text-sm text-slate-500 mt-1">
          Your role ({user.role}) is not authorized to access this operational view.
        </p>
      </div>
    );
  }

  return children;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="pos" element={<POS />} />
            <Route path="medicines" element={<Medicines />} />
            <Route path="batches" element={<Batches />} />
            <Route
              path="purchases"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'PHARMACIST']}>
                  <Purchases />
                </ProtectedRoute>
              }
            />
            <Route
              path="suppliers"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'PHARMACIST']}>
                  <Suppliers />
                </ProtectedRoute>
              }
            />
            <Route
              path="adjustments"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'PHARMACIST']}>
                  <Adjustments />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'PHARMACIST']}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AuditTrail />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

