import React from 'react';
import EmptyState from '../common/EmptyState';

export default function DataTable({
  columns = [],
  data = [],
  keyField = 'id',
  emptyTitle,
  emptyDescription,
}) {
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle || 'No matching records'}
        description={emptyDescription || 'Adjust filters or add a new record.'}
      />
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-3 px-4 text-xs font-semibold text-[#002d72] uppercase tracking-wider ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {data.map((row, idx) => (
              <tr
                key={row[keyField] || idx}
                className="hover:bg-slate-50/80 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-3 px-4 text-slate-700 ${
                      col.align === 'right'
                        ? 'text-right font-mono tabular-nums'
                        : 'text-left'
                    }`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
