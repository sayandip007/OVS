import React from 'react';
import { ELECTION_TYPES } from '../../utils/constants';

/**
 * Ballot Review Screen displayed before the final Demo Confirmation dialog.
 * Shows:
 * - Election name
 * - Election type
 * - Constituency
 * - Generic selected-option confirmation (held only in temporary component memory)
 * - Explicit privacy & demonstration notice
 */
export default function BallotReview({
  election,
  constituency,
  stateName,
  temporarySelection,
  onBackToBallot,
  onClearAndReturn,
  onOpenConfirmDialog,
}) {
  if (!election || !temporarySelection) return null;

  const isLokSabha =
    (election.type || election.electionType) === ELECTION_TYPES.LOK_SABHA;

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6"
      data-testid="ballot-review-screen"
    >
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Step 3 of 4 &bull; Pre-Confirmation Ballot Review
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">
            Review Your Demonstration Ballot Status
          </h2>
        </div>
        <span className="px-3 py-1 rounded-full bg-blue-100 text-[#002868] text-xs font-bold">
          1 Option Selected in Temporary Memory
        </span>
      </div>

      {/* Election & Constituency Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-slate-500 font-semibold block">
            Election Name
          </span>
          <strong className="text-sm text-slate-900 mt-0.5 block">
            {election.name || election.title}
          </strong>
          <span className="text-[11px] font-mono text-slate-500">
            ID: {election.id || election.electionId}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-slate-500 font-semibold block">
            Election Type
          </span>
          <strong className="text-sm text-slate-900 mt-0.5 block">
            {isLokSabha
              ? 'Lok Sabha General Election (MP)'
              : 'State Legislative Assembly Election (MLA)'}
          </strong>
          <span className="text-[11px] text-slate-500">
            Year: {election.year || 2029}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-slate-500 font-semibold block">
            Eligible Constituency
          </span>
          <strong className="text-sm text-slate-900 mt-0.5 block">
            {constituency?.name || 'Mapped Constituency'} (
            {constituency?.code || constituency?.id || 'N/A'})
          </strong>
          <span className="text-[11px] text-slate-500">
            State / UT: {stateName || election.stateId || constituency?.stateId || 'All India'}
          </span>
        </div>
      </div>

      {/* Generic Selected-Option Confirmation Card */}
      <div className="p-5 rounded-2xl bg-emerald-50/70 border-2 border-emerald-300 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="px-2.5 py-0.5 rounded bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider">
            Generic Selected-Option Confirmation
          </span>
          <span className="text-xs font-mono text-emerald-900 font-bold">
            Ready for Demo Confirmation
          </span>
        </div>

        <h3 className="text-base sm:text-lg font-extrabold text-emerald-950">
          A valid single ballot option has been selected for{' '}
          {constituency?.name || 'your constituency'}.
        </h3>

        <p className="text-xs text-emerald-900 leading-relaxed">
          Current temporary in-memory selection:{' '}
          <strong data-testid="review-temporary-selection-label">
            {temporarySelection.label} ({temporarySelection.partyAbbreviation})
          </strong>
          . This temporary selection is held strictly in volatile component state
          for this review step and will be discarded immediately upon completing
          demo participation.
        </p>
      </div>

      {/* Mandatory Privacy & Demonstration Disclaimer */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1.5">
        <strong className="block uppercase tracking-wider text-[11px] text-amber-900">
          Important Privacy &amp; Educational Prototype Notice
        </strong>
        <p className="leading-relaxed">
          This review screen is part of an educational frontend demonstration and
          does not submit a real vote. When you confirm below, only your{' '}
          <strong>participation status</strong> (<code className="font-mono">VOTED</code>),{' '}
          <strong>timestamp</strong>, and a{' '}
          <strong>non-sensitive demo reference</strong> will be recorded for{' '}
          <strong>{election.id || election.electionId}</strong>. Your selected
          candidate or party is <strong>never</strong> saved to{' '}
          <code className="font-mono">localStorage</code>, your voter profile,
          participation history, or confirmation receipt.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToBallot}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer"
          >
            &larr; Change Selection on Ballot
          </button>
          <button
            type="button"
            onClick={onClearAndReturn}
            className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold cursor-pointer"
          >
            Clear Selection
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenConfirmDialog}
          data-testid="open-demo-confirm-modal-btn"
          className="px-6 py-3 rounded-xl bg-[#138808] hover:bg-emerald-800 text-white text-xs sm:text-sm font-extrabold shadow-xs cursor-pointer"
        >
          Proceed to Final Demo Confirmation &rarr;
        </button>
      </div>
    </div>
  );
}
