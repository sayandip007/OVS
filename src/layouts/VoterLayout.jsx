import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Vote, User, Landmark } from 'lucide-react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import { useVoter } from '../context/VoterContext';

export default function VoterLayout() {
  const { currentVoter, voterGeography, participationSummary } = useVoter();

  const voterLinks = [
    { to: '/voter/dashboard', label: 'Voter Dashboard', icon: LayoutDashboard },
    { to: '/voter/elections', label: 'Simultaneous Ballot Hub', icon: Vote },
    { to: '/voter/constituencies', label: 'My Constituencies (PC & AC)', icon: Landmark },
    { to: '/voter/profile', label: 'Electoral Profile', icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      {/* Voter Context Sub-bar */}
      {currentVoter && (
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span className="font-bold text-slate-900">
                {currentVoter.fullName}
              </span>
              <span aria-hidden="true">&middot;</span>
              <span className="font-mono">EPIC: {currentVoter.epicRef}</span>
              <span aria-hidden="true">&middot;</span>
              <span>
                State: <strong>{voterGeography.state?.name || currentVoter.stateId}</strong>
              </span>
              <span aria-hidden="true">&middot;</span>
              <span>
                Lok Sabha PC:{' '}
                <strong className="text-[#004d99]">
                  {voterGeography.parliamentaryConstituency?.name ||
                    currentVoter.parliamentaryConstituencyId}
                </strong>
              </span>
              <span aria-hidden="true">&middot;</span>
              <span>
                Assembly AC:{' '}
                <strong className="text-[#004d99]">
                  {voterGeography.assemblyConstituency?.name ||
                    currentVoter.assemblyConstituencyId}
                </strong>
              </span>
            </div>

            <div className="text-xs font-mono font-semibold text-slate-800 shrink-0 tabular-nums">
              Participation: {participationSummary.label}
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2 overflow-x-auto border-t border-slate-100 py-2">
            {voterLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-[#002d72] text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
