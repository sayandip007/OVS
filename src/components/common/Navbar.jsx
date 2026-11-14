import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, ShieldCheck, UserCheck, LogOut, Users, Contrast } from 'lucide-react';
import { eciLogo } from '../../assets';
import { useAuth } from '../../context/AuthContext';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import { storageService } from '../../services/storageService';

const A11Y_PREFS_KEY = 'ovs_v3_0_a11y_prefs';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [a11yPrefs, setA11yPrefs] = useState(() =>
    storageService.getDurableItem(A11Y_PREFS_KEY, {
      fontScale: 'md',
      highContrast: false,
    })
  );
  const { isVoter, isAdmin, currentAdmin, logout, switchActiveVoter } = useAuth();
  const { currentVoter } = useVoter();
  const { voters } = useElection();
  const { notify } = useNotification();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute(
        'data-font-scale',
        a11yPrefs.fontScale || 'md'
      );
      document.documentElement.setAttribute(
        'data-contrast',
        a11yPrefs.highContrast ? 'high' : 'normal'
      );
    }
    storageService.setDurableItem(A11Y_PREFS_KEY, a11yPrefs);
  }, [a11yPrefs]);

  const setFontScale = (scale) => {
    setA11yPrefs((prev) => ({ ...prev, fontScale: scale }));
  };

  const toggleHighContrast = () => {
    setA11yPrefs((prev) => ({ ...prev, highContrast: !prev.highContrast }));
  };

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    notify({
      type: 'info',
      title: 'Signed Out',
      message: 'You have been signed out of the demonstration session.',
    });
    navigate('/');
  };

  const handleVoterSwitch = (e) => {
    const nextId = e.target.value;
    if (switchActiveVoter(nextId)) {
      const target = voters.find((v) => v.id === nextId);
      notify({
        type: 'success',
        title: 'Switched Demo Voter',
        message: `Active voter switched to ${target?.fullName} (${target?.epicRef}).`,
      });
    }
  };

  const navItems = [
    { to: '/', label: 'Home', end: true },
    { to: '/elections', label: 'Elections' },
    { to: '/candidates', label: 'Candidates' },
    { to: '/results', label: 'Results' },
    { to: '/about', label: 'About' },
    { to: '/feedback', label: 'Feedback' },
  ];

  return (
    <header className="sticky top-0 z-30 w-full bg-[#002d72] text-white border-b border-white/10 shadow-sm">
      {/* Skip to Main Content Keyboard Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-[#f4c542] focus:text-slate-950 focus:font-bold focus:text-xs"
      >
        Skip to main content
      </a>

      {/* Tricolour accent bar */}
      <div className="h-1 w-full flex">
        <div className="w-1/3 bg-[#FF9933]" />
        <div className="w-1/3 bg-white" />
        <div className="w-1/3 bg-[#138808]" />
      </div>

      {/* Accessibility & Educational Prototype Strip */}
      <div className="bg-[#001f52] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-200">
          <span className="truncate">
            Educational Election-System Prototype · Local Demonstration Data Only
          </span>
          <div
            role="group"
            aria-label="Accessibility Display Controls"
            className="flex items-center gap-1.5 shrink-0"
          >
            <span className="text-slate-300 hidden sm:inline mr-1">Text Size:</span>
            {[
              { id: 'sm', label: 'A-', title: 'Decrease Font Size' },
              { id: 'md', label: 'A', title: 'Default Font Size' },
              { id: 'lg', label: 'A+', title: 'Increase Font Size' },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setFontScale(btn.id)}
                aria-label={btn.title}
                aria-pressed={a11yPrefs.fontScale === btn.id}
                title={btn.title}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  a11yPrefs.fontScale === btn.id
                    ? 'bg-[#f4c542] text-slate-950'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {btn.label}
              </button>
            ))}
            <button
              type="button"
              onClick={toggleHighContrast}
              aria-label="Toggle High Contrast Mode"
              aria-pressed={a11yPrefs.highContrast}
              title="Toggle High Contrast Mode"
              className={`ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                a11yPrefs.highContrast
                  ? 'bg-[#f4c542] text-slate-950'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Contrast className="w-3 h-3" />
              <span>Contrast</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand + Institutional Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/"
            className="flex items-center gap-3 text-white no-underline group"
          >
            <img
              src={eciLogo}
              alt="Election Commission of India Logo"
              referrerPolicy="no-referrer"
              className="h-11 w-11 object-contain drop-shadow-md rounded-full bg-white/95 p-0.5 border border-white/20 transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight whitespace-nowrap leading-tight text-white group-hover:text-[#f4c542] transition-colors">
                National Voting Portal
              </span>
              <span className="text-[10px] text-slate-200 tracking-wide font-medium">
                Election Commission of India
              </span>
            </div>
          </Link>
        </div>

        {/* Zone 2: Primary Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap py-1 transition-colors border-b-2 ${
                  isActive
                    ? 'border-[#f4c542] text-[#f4c542] font-semibold'
                    : 'border-transparent text-slate-100 hover:text-[#f4c542]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Zone 3: Session / Role Action */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          {isVoter && currentVoter ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs">
                <Users className="w-3.5 h-3.5 text-[#f4c542] shrink-0" />
                <select
                  aria-label="Switch Demo Voter"
                  value={currentVoter.id}
                  onChange={handleVoterSwitch}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer text-xs"
                >
                  {voters.map((v) => (
                    <option key={v.id} value={v.id} className="text-slate-900">
                      {v.fullName} ({v.stateId})
                    </option>
                  ))}
                </select>
              </div>
              <Link
                to="/voter/dashboard"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#f4c542] text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Voter Hub
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : isAdmin && currentAdmin ? (
            <div className="flex items-center gap-2.5">
              <Link
                to="/eci/dashboard"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#f4c542] text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                ECI Admin Console
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link
                to="/voter/login"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white text-[#002d72] hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                Voter Portal
              </Link>
              <Link
                to="/eci/login"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0359b4] text-white border border-white/20 hover:bg-[#004d99] transition-colors whitespace-nowrap"
              >
                ECI Officer Login
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          id="mobile-menu"
          aria-label="Toggle Menu"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg text-white hover:bg-white/10 focus:outline-none cursor-pointer"
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className="lg:hidden bg-[#002d72] border-t border-white/15 px-4 pt-3 pb-5 space-y-3">
          <div className="flex flex-col space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'bg-white/15 text-[#f4c542]'
                      : 'text-white hover:bg-white/10'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="pt-3 border-t border-white/15 flex flex-col gap-2">
            {isVoter && currentVoter ? (
              <>
                <div className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2 text-xs">
                  <span className="text-white/80">Active Demo Voter:</span>
                  <select
                    value={currentVoter.id}
                    onChange={handleVoterSwitch}
                    className="bg-transparent text-white font-semibold focus:outline-none"
                  >
                    {voters.map((v) => (
                      <option key={v.id} value={v.id} className="text-slate-900">
                        {v.fullName} ({v.stateId})
                      </option>
                    ))}
                  </select>
                </div>
                <Link
                  to="/voter/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-lg text-sm font-semibold bg-[#f4c542] text-slate-950"
                >
                  Open Voter Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-center py-2 rounded-lg text-sm font-medium bg-white/10 text-white"
                >
                  Sign Out
                </button>
              </>
            ) : isAdmin ? (
              <>
                <Link
                  to="/eci/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-lg text-sm font-semibold bg-[#f4c542] text-slate-950"
                >
                  Open ECI Admin Console
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-center py-2 rounded-lg text-sm font-medium bg-white/10 text-white"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/voter/login"
                  onClick={() => setMenuOpen(false)}
                  className="text-center py-2.5 rounded-lg text-sm font-semibold bg-white text-[#002d72]"
                >
                  Voter Portal
                </Link>
                <Link
                  to="/eci/login"
                  onClick={() => setMenuOpen(false)}
                  className="text-center py-2.5 rounded-lg text-sm font-semibold bg-[#0359b4] text-white border border-white/20"
                >
                  ECI Officer
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
