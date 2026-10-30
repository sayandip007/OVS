import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarRange,
  Map,
  Building2,
  Landmark,
  Flag,
  Users,
  RotateCcw,
} from 'lucide-react';

export default function AdminSidebar({ onResetDemo }) {
  const navLinks = [
    { to: '/eci/dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
    { to: '/eci/elections', label: 'Election Management', icon: CalendarRange },
    { to: '/eci/states', label: 'States & UTs (36)', icon: Map },
    { to: '/eci/districts', label: 'Districts', icon: Building2 },
    { to: '/eci/constituencies', label: 'Constituencies (PC & AC)', icon: Landmark },
    { to: '/eci/parties', label: 'Political Parties', icon: Flag },
    { to: '/eci/candidates', label: 'Candidate Management', icon: Users },
  ];

  return (
    <aside className="w-full lg:w-64 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-4 flex flex-col justify-between">
      <div>
        <div className="px-3 py-2 mb-3">
          <p className="text-xs font-semibold text-[#004d99] uppercase tracking-wider">
            ECI Administration
          </p>
          <p className="text-sm font-bold text-slate-900 mt-0.5">
            Election Control Panel
          </p>
        </div>

        <nav className="space-y-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#002d72] text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {onResetDemo && (
        <div className="mt-6 pt-4 border-t border-slate-200 px-2">
          <button
            type="button"
            onClick={onResetDemo}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Seed Data
          </button>
        </div>
      )}
    </aside>
  );
}
