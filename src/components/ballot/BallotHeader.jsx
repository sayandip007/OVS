import React from 'react';
import { ELECTION_TYPES } from '../../utils/constants';

const STEPS = [
  { id: 'INFO', label: '1. Election Info' },
  { id: 'BALLOT', label: '2. Candidate Ballot' },
  { id: 'REVIEW', label: '3. Review Selection' },
  { id: 'RECEIPT', label: '4. Demo Receipt' },
];

export default function BallotHeader({
  election,
  constituency,
  stateName,
  voterEpic,
  currentStep = 'BALLOT',
}) {
  if (!election) return null;

  const isLokSabha =
    (election.type || election.electionType) === ELECTION_TYPES.LOK_SABHA;

  const mandatoryRoleBanner = isLokSabha
    ? 'Parliamentary Election — Select your Member of Parliament.'
    : 'State Legislative Assembly Election — Select your Member of Legislative Assembly.';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Subtle Tricolour Top Accent Bar */}
      <div className="h-1.5 w-full flex">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      {/* Prominent Statutory Election Type Banner */}
      <div
        className={`px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wider ${
          isLokSabha
            ? 'bg-[#002868] text-white'
            : 'bg-teal-900 text-white'
        }`}
      >
        <span data-testid="ballot-role-banner">{mandatoryRoleBanner}</span>
        <span className="px-2.5 py-0.5 rounded bg-white/15 font-mono text-[11px]">
          {election.id || election.electionId} &middot; {election.year || 2029}
        </span>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                  isLokSabha
                    ? 'bg-indigo-100 text-indigo-900'
                    : 'bg-teal-100 text-teal-900'
                }`}
              >
                {isLokSabha
                  ? 'Lok Sabha (Parliamentary)'
                  : 'State Legislative Assembly'}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-xs font-bold">
                Official Ballot
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {election.name || election.title}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600">
              {isLokSabha
                ? 'Parliamentary Constituency:'
                : 'Assembly Constituency:'}{' '}
              <strong className="text-slate-900">
                {constituency?.name || 'Mapped Constituency'} (
                {constituency?.code || constituency?.id || 'N/A'})
              </strong>{' '}
              &bull; State / UT:{' '}
              <strong className="text-slate-900">
                {stateName || election.stateId || constituency?.stateId || 'All India'}
              </strong>
            </p>
          </div>

          {voterEpic && (
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs shrink-0">
              <span className="text-slate-500 block">Voter EPIC Reference</span>
              <strong className="font-mono text-sm text-[#002868]">
                {voterEpic}
              </strong>
            </div>
          )}
        </div>

        {/* 4-Step Ballot Progress Bar */}
        <div
          aria-label="Voting workflow steps"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-slate-100"
        >
          {STEPS.map((step) => {
            const isActive = step.id === currentStep;
            return (
              <div
                key={step.id}
                className={`px-3 py-2 rounded-xl text-xs font-bold text-center border transition-colors ${
                  isActive
                    ? 'bg-[#002868] text-white border-[#002868]'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                {step.label}
              </div>
            );
          })}
        </div>

        {/* Secret Ballot Assurance */}
        <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-[#002868] flex items-center gap-2">
          <span className="font-bold">Secret Ballot:</span>
          <span>Your candidate choice is confidential and never stored with your identity.</span>
        </div>
      </div>
    </div>
  );
}
