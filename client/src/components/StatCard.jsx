import React from 'react';

export function StatCard({ title, value, subtitle, icon: Icon, color = 'emerald', alert = false }) {
  const colorMap = {
    emerald: {
      bg: 'bg-emerald-50',
      icon: 'text-emerald-600',
      border: 'border-emerald-100',
    },
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      border: 'border-blue-100',
    },
    amber: {
      bg: 'bg-amber-50',
      icon: 'text-amber-600',
      border: 'border-amber-200',
    },
    rose: {
      bg: 'bg-rose-50',
      icon: 'text-rose-600',
      border: 'border-rose-200',
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600',
      border: 'border-purple-100',
    },
  };

  const scheme = colorMap[color] || colorMap.emerald;

  return (
    <div className={`bg-white rounded-xl p-5 border shadow-xs transition hover:shadow-sm ${alert ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${scheme.bg} ${scheme.border} border`}>
            <Icon className={`w-6 h-6 ${scheme.icon}`} />
          </div>
        )}
      </div>
    </div>
  );
}

