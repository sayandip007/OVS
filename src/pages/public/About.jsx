import React from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { eciLogo } from '../../assets';

export default function About() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader
        badge="Election Commission of India"
        title="National Electoral Platform"
        subtitle="Official election management and online voting service for Parliamentary and State Legislative Assembly elections."
        actions={
          <Link
            to="/feedback"
            className="px-4 py-2 bg-[#002868] hover:bg-blue-900 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Citizen Feedback
          </Link>
        }
      />

      {/* Core Mission */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-8 space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            Constitutional Mandate &amp; Electoral Framework
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            The Election Commission of India administers free, fair, and transparent elections across
            all <strong>28 States</strong> and <strong>8 Union Territories</strong>. The platform provides a unified
            digital infrastructure supporting both nationwide Parliamentary polls and State Legislative Assembly elections.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-lg bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950">
              <strong className="block text-sm mb-1 text-indigo-900">
                Parliamentary Constituencies (PC)
              </strong>
              543 constituencies nationwide electing Members of Parliament (MPs) to the Lok Sabha.
            </div>
            <div className="p-3.5 rounded-lg bg-teal-50/70 border border-teal-200 text-xs text-teal-950">
              <strong className="block text-sm mb-1 text-teal-900">
                Assembly Constituencies (AC)
              </strong>
              State-level legislative constituencies electing Members of the Legislative Assembly (MLAs).
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-slate-50 rounded-xl border border-slate-200 p-6 flex flex-col items-center text-center space-y-3">
          <img src={eciLogo} alt="Election Commission of India" className="h-16 w-16 object-contain" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Universal Adult Suffrage
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Every eligible Indian citizen aged 18 or above with a valid EPIC card is entitled to exercise their democratic right.
            </p>
          </div>
        </div>
      </div>

      {/* Key Guarantees */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-2">
          <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-900 text-xs font-bold">
            Simultaneous Voting
          </span>
          <h3 className="text-base font-bold text-slate-900 pt-1">
            Independent Ballots
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Parliamentary and State Assembly elections operate with separate ballots. Voting in one election is recorded independently without affecting the other.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-2">
          <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 text-xs font-bold">
            Secrecy of the Ballot
          </span>
          <h3 className="text-base font-bold text-slate-900 pt-1">
            Guaranteed Privacy
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Ballot choices are strictly confidential. No record linking an individual voter to their chosen candidate is ever stored or transmitted.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-2">
          <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 text-xs font-bold">
            Transparent Tallying
          </span>
          <h3 className="text-base font-bold text-slate-900 pt-1">
            Certified Counting
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Multi-round verification ensures accurate vote tallying and prompt public declaration of results with full NOTA accounting.
          </p>
        </div>
      </div>
    </div>
  );
}
