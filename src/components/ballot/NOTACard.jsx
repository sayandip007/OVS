import React from 'react';
import { NOTA_OPTION } from '../../utils/constants';
import { notaImg, notaLogo } from '../../assets';

/**
 * Reusable None of the Above (NOTA) Ballot Option Card.
 */
export default function NOTACard({
  ballotNumber = 1,
  isSelected = false,
  onSelectNota,
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectNota(NOTA_OPTION.id);
    }
  };

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => onSelectNota(NOTA_OPTION.id)}
      data-testid="ballot-nota-card"
      className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 focus:outline-none focus:ring-2 focus:ring-[#002868] ${
        isSelected
          ? 'border-[#002868] bg-blue-50/70 shadow-sm'
          : 'border-slate-300 hover:border-slate-400 bg-slate-50/80'
      }`}
    >
      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold font-mono shrink-0 ${
            isSelected
              ? 'bg-[#002868] text-white'
              : 'bg-slate-200 text-slate-800'
          }`}
        >
          {ballotNumber}
        </div>

        <img
          src={notaImg}
          alt={NOTA_OPTION.name}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-slate-300 bg-white shrink-0"
        />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
              {NOTA_OPTION.name}
            </h3>
            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-bold uppercase tracking-wider">
              Statutory ECI Option
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600">
            {NOTA_OPTION.description}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200 shrink-0">
        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shrink-0">
          <img
            src={notaLogo}
            alt="NOTA Symbol"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`w-4 h-4 rounded-full border transition-all ${
              isSelected
                ? 'bg-red-600 border-red-700 shadow-[0_0_10px_#dc2626]'
                : 'bg-slate-200 border-slate-300'
            }`}
          />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectNota(NOTA_OPTION.id);
            }}
            aria-label="Select None of the Above (NOTA)"
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer flex items-center gap-2 ${
              isSelected
                ? 'bg-[#002868] text-white shadow-xs'
                : 'bg-slate-800 hover:bg-slate-950 text-white'
            }`}
          >
            <span
              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                isSelected ? 'border-white bg-white' : 'border-slate-300'
              }`}
            >
              {isSelected && (
                <span className="w-2 h-2 rounded-full bg-[#002868]" />
              )}
            </span>
            <span>{isSelected ? 'SELECTED (NOTA)' : 'Select NOTA'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
