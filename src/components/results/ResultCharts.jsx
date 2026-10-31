import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';

const PARTY_COLORS = {
  BJP: '#EA580C',
  INC: '#0284C7',
  AITC: '#0D9488',
  CPIM: '#DC2626',
  TDP: '#CA8A04',
  JDU: '#16A34A',
  BPM: '#4F46E5',
  IND: '#64748B',
  NOTA: '#94A3B8',
};

export function getPartyColor(abbr, index = 0) {
  if (abbr && PARTY_COLORS[abbr]) return PARTY_COLORS[abbr];
  const palette = [
    '#002868',
    '#0D9488',
    '#D97706',
    '#2563EB',
    '#7C3AED',
    '#059669',
    '#DC2626',
    '#475569',
  ];
  return palette[index % palette.length];
}

/**
 * Mandatory Simulated Data Disclaimer Banner (Phase 6 Section 11 & 20)
 */
export function SimulatedResultDisclaimer({ compact = false }) {
  return (
    <div
      role="note"
      aria-label="Simulated Demonstration Results Disclaimer"
      className={`rounded-xl border border-amber-200 bg-amber-50/90 text-amber-950 ${
        compact ? 'px-3.5 py-2.5 text-xs' : 'p-4 text-xs sm:text-sm'
      } flex items-start gap-3`}
    >
      <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="font-semibold">
          Simulated Demonstration Results Only — Not Official ECI Data
        </p>
        <p className="text-amber-900/90 text-xs leading-relaxed">
          All counting rounds, vote tallies, seat distributions, and turnout percentages displayed on this portal are deterministic frontend demonstration figures (DEMO_SAMPLE). They are strictly separate from voter participation records and do not represent official Election Commission of India election results.
        </p>
      </div>
    </div>
  );
}

/**
 * 1. Party-Wise Seats & Vote Share Bar Chart
 */
export function PartySeatsBarChart({
  partyRows = [],
  title = 'Party-Wise Seat Distribution (Simulated)',
  subtitle = 'Seats won (declared) and seats leading (ongoing counting)',
}) {
  const [hoveredParty, setHoveredParty] = useState(null);

  if (!partyRows || partyRows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 text-center text-xs text-slate-500">
        No party seat data available for the selected scope.
      </div>
    );
  }

  const maxSeats = Math.max(
    1,
    ...partyRows.map((p) => (p.seatsWon || 0) + (p.seatsLeading || 0))
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#002868]" />
            Seats Won
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
            Seats Leading
          </span>
        </div>
      </div>

      {/* Accessible Screen Reader Summary */}
      <div className="sr-only">
        Party-wise seat summary:{' '}
        {partyRows
          .map(
            (p) =>
              `${p.partyName} (${p.abbreviation}): ${p.seatsWon} won, ${p.seatsLeading} leading, ${p.totalVotes} votes (${p.voteShareTotalBallotPct}%)`
          )
          .join('; ')}
      </div>

      <div className="space-y-3" role="img" aria-label={title}>
        {partyRows.map((p, idx) => {
          const totalActiveSeats = (p.seatsWon || 0) + (p.seatsLeading || 0);
          const wonWidthPct = Math.round(((p.seatsWon || 0) / maxSeats) * 100);
          const leadWidthPct = Math.round(
            ((p.seatsLeading || 0) / maxSeats) * 100
          );
          const color = getPartyColor(p.abbreviation, idx);

          return (
            <div
              key={p.partyId}
              onMouseEnter={() => setHoveredParty(p.partyId)}
              onMouseLeave={() => setHoveredParty(null)}
              className="space-y-1.5 p-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-bold text-slate-900 truncate">
                    {p.partyName}
                  </span>
                  <span className="text-slate-500 font-mono">
                    ({p.abbreviation})
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                  <span className="text-slate-900 font-bold">
                    {p.seatsWon} Won
                  </span>
                  {p.seatsLeading > 0 && (
                    <span className="text-amber-700 font-semibold">
                      +{p.seatsLeading} Leading
                    </span>
                  )}
                  <span className="text-slate-500">
                    {p.totalVotes.toLocaleString('en-IN')} votes (
                    {p.voteShareTotalBallotPct}%)
                  </span>
                </div>
              </div>

              <div className="w-full h-3 bg-slate-100 rounded-md overflow-hidden flex">
                {p.seatsWon > 0 && (
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.max(4, wonWidthPct)}%`,
                      backgroundColor: color,
                    }}
                    title={`${p.abbreviation}: ${p.seatsWon} Seats Won`}
                  />
                )}
                {p.seatsLeading > 0 && (
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: `${Math.max(4, leadWidthPct)}%` }}
                    title={`${p.abbreviation}: ${p.seatsLeading} Seats Leading`}
                  />
                )}
                {totalActiveSeats === 0 && p.totalVotes > 0 && (
                  <div
                    className="h-full bg-slate-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(2, p.voteShareTotalBallotPct)
                      )}%`,
                    }}
                    title={`${p.abbreviation}: 0 Seats (${p.voteShareTotalBallotPct}% Vote Share)`}
                  />
                )}
              </div>

              {hoveredParty === p.partyId && (
                <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-3 pt-0.5 font-mono tabular-nums">
                  <span>Seats Won: {p.seatsWon}</span>
                  <span>·</span>
                  <span>Seats Leading: {p.seatsLeading}</span>
                  <span>·</span>
                  <span>
                    Simulated Votes: {p.totalVotes.toLocaleString('en-IN')}
                  </span>
                  <span>·</span>
                  <span>Total Ballot Share: {p.voteShareTotalBallotPct}%</span>
                  <span>·</span>
                  <span>Valid Candidate Share: {p.voteShareValidPct}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 2. Donut Chart for Vote Share / Seat Share Distribution
 */
export function VoteShareDonutChart({
  partyRows = [],
  notaVotes = 0,
  notaSharePct = 0,
  totalCountedVotes = 0,
  title = 'Vote Share Distribution (Simulated)',
}) {
  if (!partyRows || partyRows.length === 0 || totalCountedVotes <= 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 text-center text-xs text-slate-500">
        No counted votes available to render vote share distribution.
      </div>
    );
  }

  const slices = [
    ...partyRows
      .filter((p) => p.totalVotes > 0)
      .map((p, idx) => ({
        id: p.partyId,
        label: p.abbreviation,
        fullName: p.partyName,
        votes: p.totalVotes,
        pct: p.voteShareTotalBallotPct,
        color: getPartyColor(p.abbreviation, idx),
      })),
    ...(notaVotes > 0
      ? [
          {
            id: 'NOTA',
            label: 'NOTA',
            fullName: 'None of the Above (NOTA)',
            votes: notaVotes,
            pct: notaSharePct,
            color: PARTY_COLORS.NOTA,
          },
        ]
      : []),
  ];

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulativeFraction = 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">
          Denominator: {totalCountedVotes.toLocaleString('en-IN')} total counted ballot votes (including NOTA)
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative w-36 h-36 shrink-0">
          <svg
            viewBox="0 0 140 140"
            className="w-full h-full -rotate-90"
            role="img"
            aria-label={title}
          >
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth="20"
            />
            {slices.map((s) => {
              const fraction = Math.max(0, (s.pct || 0) / 100);
              const strokeDasharray = `${fraction * circumference} ${circumference}`;
              const strokeDashoffset = -cumulativeFraction * circumference;
              cumulativeFraction += fraction;
              return (
                <circle
                  key={s.id}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke={s.color}
                  strokeWidth="20"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                >
                  <title>
                    {s.fullName}: {s.votes.toLocaleString('en-IN')} votes ({s.pct}%)
                  </title>
                </circle>
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-slate-500">Total Counted</span>
            <span className="text-xs font-extrabold text-slate-900 font-mono tabular-nums">
              {totalCountedVotes.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {slices.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/60"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-bold text-slate-800 truncate">
                  {s.label}
                </span>
              </div>
              <span className="font-mono tabular-nums text-slate-700 shrink-0">
                {s.pct}% ({s.votes.toLocaleString('en-IN')})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 3. Cumulative Counting Progress Line Chart across Rounds
 */
export function CumulativeRoundLineChart({
  rounds = [],
  candidates = [],
  totalConfiguredVotes = 15000,
}) {
  if (!rounds || rounds.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 text-center text-xs text-slate-500">
        No counting rounds have been processed yet. Start counting to inspect round-by-round progression.
      </div>
    );
  }

  const width = 560;
  const height = 210;
  const padLeft = 52;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 32;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxCandidateVote = Math.max(
    100,
    ...rounds.flatMap((r) =>
      (r.candidateVotes || []).map((cv) => Number(cv.cumulativeVotes || 0))
    )
  );

  const getX = (roundIdx) => {
    if (rounds.length === 1) return padLeft + plotW / 2;
    return padLeft + (roundIdx / (rounds.length - 1)) * plotW;
  };

  const getY = (votes) => {
    return padTop + plotH - (Math.min(maxCandidateVote, votes) / maxCandidateVote) * plotH;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Cumulative Counting Round Progression (Simulated)
          </h3>
          <p className="text-xs text-slate-500">
            Sequential cumulative candidate totals across {rounds.length} completed round(s) · Configured limit: {Number(totalConfiguredVotes).toLocaleString('en-IN')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {candidates.map((c, idx) => (
            <span key={c.candidateId} className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-xs"
                style={{
                  backgroundColor: getPartyColor(c.snapshotPartyAbbr, idx),
                }}
              />
              <span className="font-semibold text-slate-700">
                {c.snapshotName || c.candidateId} ({c.snapshotPartyAbbr || 'IND'})
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[420px] h-52"
          role="img"
          aria-label="Cumulative counting round line chart"
        >
          {/* Horizontal grid lines */}
          {[0, 0.5, 1].map((frac) => {
            const y = padTop + plotH * (1 - frac);
            const labelVal = Math.round(maxCandidateVote * frac);
            return (
              <g key={frac}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 6}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-500 font-mono"
                >
                  {labelVal.toLocaleString('en-IN')}
                </text>
              </g>
            );
          })}

          {/* Candidate lines */}
          {candidates.map((cand, cIdx) => {
            const color = getPartyColor(cand.snapshotPartyAbbr, cIdx);
            const points = rounds.map((r, rIdx) => {
              const cv = (r.candidateVotes || []).find(
                (item) => item.candidateId === cand.candidateId
              );
              const val = Number(cv?.cumulativeVotes || 0);
              return { x: getX(rIdx), y: getY(val), val, roundNumber: r.roundNumber };
            });

            const pathD = points
              .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
              .join(' ');

            return (
              <g key={cand.candidateId}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                />
                {points.map((pt) => (
                  <circle
                    key={`${cand.candidateId}-R${pt.roundNumber}`}
                    cx={pt.x}
                    cy={pt.y}
                    r="4"
                    fill={color}
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  >
                    <title>
                      Round {pt.roundNumber} — {cand.snapshotName}: {pt.val.toLocaleString('en-IN')} cumulative votes
                    </title>
                  </circle>
                ))}
              </g>
            );
          })}

          {/* X-axis round labels */}
          {rounds.map((r, rIdx) => (
            <text
              key={r.roundNumber}
              x={getX(rIdx)}
              y={height - 8}
              textAnchor="middle"
              className="text-[10px] fill-slate-600 font-semibold font-mono"
            >
              Round {r.roundNumber}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
