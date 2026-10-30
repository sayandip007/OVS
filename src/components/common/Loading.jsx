import React from 'react';

export default function Loading({ label = 'Loading election data...' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center my-4">
      <div className="w-7 h-7 border-3 border-slate-200 border-t-[#004d99] rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}
