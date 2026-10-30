import React from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { eciLogo, g20Logo, years75Logo } from '../../assets';

export default function About() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader
        badge="About ECI OVS Portal"
        title="India-Wide Election Management & Online Voting Architecture"
        subtitle="Designed to model the Election Commission of India's dual-tier electoral framework supporting Lok Sabha General Elections, State Legislative Assembly Elections, and Simultaneous Multi-Election Ballots."
        actions={
          <Link
            to="/feedback"
            className="px-4 py-2 bg-[#002868] hover:bg-blue-900 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Share Citizen Feedback
          </Link>
        }
      />

      {/* Core Mission & Heritage */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-8 space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            Constitutional Mandate &amp; Digital Modernization
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            The Online Voting System (OVS) portal demonstrates a transparent, accessible,
            and structured electoral workflow across all <strong>28 Indian States</strong>{' '}
            and <strong>8 Union Territories</strong>. It preserves the original Voting
            Portal workflows while introducing strict separation between national
            Parliamentary elections and state-level Legislative Assembly elections.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            Every registered voter is mapped to two independent geographical jurisdictions
            within their State and District:
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <li className="p-3.5 rounded-lg bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950">
              <strong className="block text-sm mb-1 text-indigo-900">
                1. Parliamentary Constituency (PC)
              </strong>
              Used exclusively for nationwide <strong>Lok Sabha General Elections</strong>{' '}
              to elect Members of Parliament (MPs).
            </li>
            <li className="p-3.5 rounded-lg bg-teal-50/70 border border-teal-200 text-xs text-teal-950">
              <strong className="block text-sm mb-1 text-teal-900">
                2. Assembly Constituency (AC)
              </strong>
              Used exclusively for state-level{' '}
              <strong>State Legislative Assembly Elections</strong> to elect MLAs.
            </li>
          </ul>
        </div>

        <div className="lg:col-span-4 bg-slate-50 rounded-xl border border-slate-200 p-6 flex flex-col items-center text-center space-y-4">
          <div className="flex items-center justify-center gap-4">
            <img src={eciLogo} alt="ECI Logo" className="h-12 w-auto object-contain" />
            <img src={g20Logo} alt="G20 Logo" className="h-12 w-auto object-contain" />
            <img
              src={years75Logo}
              alt="75 Years Logo"
              className="h-12 w-auto object-contain"
            />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">
              Universal Adult Franchise (18+ Years)
            </h3>
            <p className="text-xs text-slate-600">
              Every eligible citizen of India aged 18 or older can register with their EPIC
              reference and cast independent ballots with full NOTA (None of the Above)
              support.
            </p>
          </div>
        </div>
      </div>

      {/* Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-2">
          <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-900 text-xs font-bold">
            Simultaneous Elections
          </span>
          <h3 className="text-base font-bold text-slate-900 pt-1">
            Independent Multi-Ballot Tracking
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            When both a Lok Sabha election and a State Assembly election are active in a
            voter&apos;s state, the voter sees two distinct election cards. Participating in
            one election updates only that election (<code className="font-mono">1/2 completed</code>)
            and never marks the second election as completed.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-2">
          <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 text-xs font-bold">
            Ballot Secrecy by Design
          </span>
          <h3 className="text-base font-bold text-slate-900 pt-1">
            Zero Voter-to-Candidate Linkage
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            When a simulated ballot is submitted, the voter&apos;s participation record stores
            only <code className="font-mono">status: &quot;VOTED&quot;</code> and a timestamp
            while incrementing the anonymous constituency tally—ensuring the voter&apos;s
            chosen candidate is never stored in their profile.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-2">
          <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 text-xs font-bold">
            Data Transparency
          </span>
          <h3 className="text-base font-bold text-slate-900 pt-1">
            Official vs Demo Sample Metadata
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            All 28 States and 8 Union Territories carry official Lok Sabha and Assembly seat
            allocations (<code className="font-mono">VERIFIED_OFFICIAL</code>), while
            representative districts and sample constituencies are explicitly tagged when
            using <code className="font-mono">DEMO_SAMPLE</code> records.
          </p>
        </div>
      </div>
    </div>
  );
}
