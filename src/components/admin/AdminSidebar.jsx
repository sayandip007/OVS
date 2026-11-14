import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarRange,
  CalendarClock,
  Map,
  Building2,
  Landmark,
  Flag,
  Users,
  UserCheck,
  UserCog,
  Shield,
  Activity,
  Megaphone,
  BarChart3,
  FileText,
  Settings,
  Flame,
  RotateCcw,
  Menu,
  X,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_ROLE_LABELS } from '../../utils/constants';

export default function AdminSidebar({ onResetDemo }) {
  const { currentAdmin, canAccessAdminRoute, canPerformAdminAction } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navSections = [
    {
      title: 'Core Operations',
      items: [
        { to: '/eci/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/eci/elections', label: 'Elections', icon: CalendarRange },
        { to: '/eci/schedules', label: 'Election Schedules', icon: CalendarClock },
        { to: '/eci/monitoring', label: 'Election Monitoring', icon: Activity },
      ],
    },
    {
      title: 'Electoral Geography',
      items: [
        { to: '/eci/states', label: 'States & UTs (36)', icon: Map },
        { to: '/eci/districts', label: 'Districts', icon: Building2 },
        { to: '/eci/constituencies', label: 'Constituencies (PC & AC)', icon: Landmark },
      ],
    },
    {
      title: 'Ballot & Registry',
      items: [
        { to: '/eci/parties', label: 'Political Parties', icon: Flag },
        { to: '/eci/candidates', label: 'Candidates', icon: Users },
        { to: '/eci/voters', label: 'Demo Voters', icon: UserCheck },
      ],
    },
    {
      title: 'Governance & Results',
      items: [
        { to: '/eci/announcements', label: 'Announcements', icon: Megaphone },
        { to: '/eci/results', label: 'Results Management', icon: BarChart3 },
        { to: '/eci/admin-users', label: 'Administrators & Scopes', icon: UserCog },
        { to: '/eci/audit-logs', label: 'Audit Logs', icon: FileText },
        { to: '/eci/profile', label: 'My Profile & Sessions', icon: Shield },
        { to: '/eci/settings', label: 'Admin Settings', icon: Settings },
        { to: '/eci/simulation', label: 'Pan-India Simulation', icon: Flame },
      ],
    },
  ];

  const canReset = canPerformAdminAction('RESET_DEMO_DATA').allowed;

  return (
    <aside className="w-full lg:w-64 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between">
      <div className="p-4">
        <div className="flex items-center justify-between px-2 py-1.5 mb-3">
          <div>
            <p className="text-[11px] font-bold text-[#004d99] uppercase tracking-wider">
              ECI Administration
            </p>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">
              Election Control Panel
            </p>
            {currentAdmin && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-50 text-[#002868] border border-blue-200 text-[10px] font-bold">
                {ADMIN_ROLE_LABELS[currentAdmin.role] || currentAdmin.role}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Toggle ECI Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <div className={`${mobileMenuOpen ? 'block' : 'hidden'} lg:block space-y-4`}>
          {navSections.map((section) => {
            const visibleItems = section.items.filter((item) =>
              canAccessAdminRoute(item.to)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </p>
                <nav className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                            isActive
                              ? 'bg-[#002d72] text-white shadow-xs'
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
            );
          })}
        </div>
      </div>

      <div className={`${mobileMenuOpen ? 'block' : 'hidden'} lg:block p-4 border-t border-slate-200 space-y-2.5`}>
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>
            <strong>Demo Prototype:</strong> Local state only. Not an official ECI platform.
          </span>
        </div>

        {onResetDemo && canReset && (
          <button
            type="button"
            onClick={onResetDemo}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Seed Data
          </button>
        )}
      </div>
    </aside>
  );
}
