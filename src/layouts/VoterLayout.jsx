import React, { useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  User,
  Landmark,
  Vote,
  CalendarRange,
  Users,
  Bell,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import { useVoter } from '../context/VoterContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { defaultAvatar } from '../assets';

const ROUTE_TITLES = {
  '/voter/dashboard': 'Voter Dashboard',
  '/voter/profile': 'My Electoral Profile',
  '/voter/constituencies': 'My Constituencies (PC & AC)',
  '/voter/elections': 'My Elections Hub',
  '/voter/election-info': 'Election Information Directory',
  '/voter/candidates': 'Contesting Candidate Directory',
  '/voter/notifications': 'Voter Notification Centre',
  '/voter/history': 'Voting & Participation History',
  '/voter/settings': 'Voter Portal Settings & Demo Controls',
};

export default function VoterLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const {
    currentVoter,
    voterGeography,
    participationSummary,
    unreadNotificationCount,
    profileCompletion,
  } = useVoter();
  const { logout } = useAuth();
  const { notifyInfo } = useNotification();

  const navItems = [
    { to: '/voter/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/voter/profile', label: 'My Profile', icon: User },
    { to: '/voter/constituencies', label: 'My Constituencies', icon: Landmark },
    { to: '/voter/elections', label: 'My Elections', icon: Vote },
    {
      to: '/voter/election-info',
      label: 'Election Information',
      icon: CalendarRange,
    },
    {
      to: '/voter/candidates',
      label: 'Candidate Directory',
      icon: Users,
    },
    {
      to: '/voter/notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationCount,
    },
    { to: '/voter/history', label: 'Voting History', icon: History },
    { to: '/voter/settings', label: 'Settings', icon: Settings },
  ];

  const currentPageTitle =
    ROUTE_TITLES[location.pathname] || 'Voter Portal';

  const handleLogout = () => {
    logout();
    notifyInfo('Signed out of simulated Voter Portal session.');
    navigate('/voter/login');
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      {/* Top Voter Context & Mobile Menu Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Mobile Sidebar Toggle + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((prev) => !prev)}
              aria-label="Toggle Voter Navigation Menu"
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {mobileSidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>

            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 text-xs text-slate-500 truncate"
            >
              <Link
                to="/voter/dashboard"
                className="font-semibold text-[#002868] hover:underline"
              >
                Voter Portal
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-bold text-slate-900 truncate">
                {currentPageTitle}
              </span>
            </nav>
          </div>

          {/* Right: Quick Jurisdiction Summary, Notification Bell & Demo Badge */}
          {currentVoter && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <span>
                  PC:{' '}
                  <strong className="text-indigo-900">
                    {voterGeography.parliamentaryConstituency?.name ||
                      currentVoter.parliamentaryConstituencyId}
                  </strong>
                </span>
                <span className="text-slate-300">|</span>
                <span>
                  AC:{' '}
                  <strong className="text-teal-900">
                    {voterGeography.assemblyConstituency?.name ||
                      currentVoter.assemblyConstituencyId}
                  </strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="font-mono font-bold text-slate-900">
                  {participationSummary.label}
                </span>
              </div>

              <Link
                to="/voter/notifications"
                className="relative p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                title="Voter Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationCount > 0 && (
                  <span
                    data-testid="navbar-unread-count"
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center"
                  >
                    {unreadNotificationCount}
                  </span>
                )}
              </Link>

              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                DEMO SESSION
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Container with Responsive Sidebar */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col lg:flex-row">
        {/* Desktop & Collapsible Mobile Sidebar */}
        <aside
          className={`${
            mobileSidebarOpen ? 'block' : 'hidden'
          } lg:block w-full lg:w-64 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-4 space-y-5`}
        >
          {/* Authenticated Demo Voter Profile Card in Sidebar */}
          {currentVoter && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={currentVoter.avatar || defaultAvatar}
                  alt={currentVoter.fullName}
                  className="w-11 h-11 rounded-xl object-cover border border-[#002868] shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {currentVoter.fullName}
                  </p>
                  <p className="text-[11px] font-mono text-slate-600 truncate">
                    {currentVoter.epicReference || currentVoter.epicRef}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/80 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Account Status:</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                    {currentVoter.accountStatus || 'ACTIVE'} (DEMO)
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Profile Completion:</span>
                  <span className="font-bold text-slate-900">
                    {profileCompletion.percentage}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#138808]"
                    style={{ width: `${profileCompletion.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sidebar Navigation Links */}
          <nav aria-label="Voter Portal Sidebar" className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={({ isActive }) =>
                    `w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-[#002868] text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                    }`
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-600 text-white">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}

            <div className="pt-3 mt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </nav>

          {/* Demonstration Disclaimer Box */}
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-[11px] text-amber-950 leading-relaxed">
            <strong className="block font-bold mb-0.5">
              Frontend Demonstration Mode
            </strong>
            All voter records, OTP codes, and participation statuses are stored locally
            in your browser for demonstration only.
          </div>
        </aside>

        {/* Main Voter Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          <Outlet />
        </main>
      </div>

      <Footer />
    </div>
  );
}
