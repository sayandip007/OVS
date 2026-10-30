import React from 'react';

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}) {
  return (
    <div className="pb-6 mb-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold text-[#004d99] mb-1">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
