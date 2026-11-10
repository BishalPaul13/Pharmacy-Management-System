import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem('pharmacy_token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch (e) {
          console.warn('Session expired or invalid token:', e.message);
          localStorage.removeItem('pharmacy_token');
          setUser(null);
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  async function login(username, password) {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('pharmacy_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }

  async function quickSwitch(role) {
    const credentials = {
      ADMIN: { u: 'admin', p: 'admin123' },
      PHARMACIST: { u: 'pharmacist', p: 'pharm123' },
      CASHIER: { u: 'cashier', p: 'cash123' },
    };
    const cred = credentials[role] || credentials.ADMIN;
    return await login(cred.u, cred.p);
  }

  function logout() {
    localStorage.removeItem('pharmacy_token');
    setUser(null);
  }

  function hasRole(...roles) {
    if (!user) return false;
    return roles.includes(user.role);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, quickSwitch, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
