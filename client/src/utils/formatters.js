export function formatCurrency(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {
    return dateString;
  }
}

export function formatDateTime(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return dateString;
  }
}

export function getDaysToExpiry(expiryDate) {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  const diffTime = exp - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getExpiryBadgeInfo(expiryDate, status = 'ACTIVE') {
  if (status === 'EXPIRED') {
    return { label: 'Expired', color: 'bg-rose-100 text-rose-800 border-rose-300' };
  }
  if (status === 'QUARANTINED') {
    return { label: 'Quarantined', color: 'bg-purple-100 text-purple-800 border-purple-300' };
  }
  if (status === 'DEPLETED') {
    return { label: 'Depleted', color: 'bg-slate-100 text-slate-700 border-slate-300' };
  }

  const days = getDaysToExpiry(expiryDate);
  if (days <= 0) {
    return { label: 'Expired', color: 'bg-rose-100 text-rose-800 border-rose-300' };
  }
  if (days <= 15) {
    return { label: `Critical: ${days}d left`, color: 'bg-red-100 text-red-800 border-red-300' };
  }
  if (days <= 60) {
    return { label: `Near Expiry: ${days}d`, color: 'bg-amber-100 text-amber-800 border-amber-300' };
  }
  return { label: `Healthy: ${days}d`, color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
}

