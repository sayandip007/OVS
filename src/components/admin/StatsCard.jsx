import React from 'react';

export default function StatsCard({ label, value, subtext, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
          {value}
        </p>
        {subtext && (
          <p className="text-xs text-slate-600 mt-1">{subtext}</p>
        )}
      </div>
      {Icon && (
        <div className="p-2.5 rounded-lg bg-slate-100 text-[#004d99] shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}
