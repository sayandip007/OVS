import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import AdminSidebar from '../components/admin/AdminSidebar';
import Modal from '../components/common/Modal';
import { useElection } from '../context/ElectionContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ADMIN_ROLE_LABELS } from '../utils/constants';
import { ChevronRight, ShieldCheck, LogOut, Zap } from 'lucide-react';

const ROUTE_TITLES = {
  dashboard: 'Dashboard Overview',
  elections: 'Election Management',
  create: 'Create Election',
  schedules: 'Election Schedules',
  states: 'States & Union Territories',
  districts: 'District Management',
  constituencies: 'Constituencies (PC & AC)',
  parties: 'Political Parties',
  candidates: 'Candidate Management',
  voters: 'Demo Voter Registry',
  monitoring: 'Election Monitoring',
  announcements: 'Public Announcements',
  results: 'Results Management',
  'admin-users': 'Administrators & Scopes',
  'audit-logs': 'Audit Logs',
  profile: 'My Profile & Sessions',
  settings: 'Admin Settings',
  simulation: 'Pan-India Simulation & Stress Console',
};

export default function AdminLayout() {
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const { resetDemoData, demoLifecycleMode, setDemoLifecycleMode, appendAuditLog } = useElection();
  const { currentAdmin, adminOfficers, switchActiveAdmin, logoutAdmin, isBackendApiMode } = useAuth();
  const { notify } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();

  const handleConfirmReset = () => {
    resetDemoData(currentAdmin);
    setConfirmResetOpen(false);
    notify({
      type: 'success',
      title: 'Demo Data Restored',
      message:
        'All elections, states, districts, constituencies, parties, candidates, and voter records have been restored to initial seed values.',
    });
  };

  const handleRoleSwitch = (e) => {
    const officerId = e.target.value;
    const res = switchActiveAdmin(officerId);
    if (res.ok) {
      appendAuditLog({
        adminUser: res.officer,
        actionType: 'SWITCH_ADMIN_ROLE',
        targetEntity: 'ADMIN_SESSION',
        targetId: res.officer.id,
        summary: `Switched active demo ECI role to ${res.officer.role} (${res.officer.fullName}).`,
      });
      notify({
        type: 'info',
        title: `Switched Role: ${ADMIN_ROLE_LABELS[res.officer.role] || res.officer.role}`,
        message: `Now acting as ${res.officer.fullName} (${res.officer.designation}).`,
      });
    }
  };

  const handleLogout = async () => {
    if (!isBackendApiMode) {
      appendAuditLog({
        adminUser: currentAdmin,
        actionType: 'ADMIN_LOGOUT',
        targetEntity: 'ADMIN_SESSION',
        targetId: currentAdmin?.id || 'ADMIN',
        summary: `ECI officer ${currentAdmin?.fullName || 'Admin'} signed out of console.`,
      });
    }
    await logoutAdmin();
    navigate('/eci/login');
  };

  const segments = location.pathname.split('/').filter(Boolean);
  const subSegments = segments.slice(1); // after 'eci'

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900 font-sans">
      <Navbar />
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
        <AdminSidebar onResetDemo={() => setConfirmResetOpen(true)} />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Admin Top Utility & Breadcrumb Bar */}
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
              <Link to="/eci/dashboard" className="font-semibold text-[#002868] hover:underline">
                ECI Portal
              </Link>
              {subSegments.map((seg, idx) => {
                const label = ROUTE_TITLES[seg] || seg;
                const isLast = idx === subSegments.length - 1;
                return (
                  <React.Fragment key={`${seg}-${idx}`}>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className={isLast ? 'font-bold text-slate-900' : 'text-slate-600'}>
                      {label}
                    </span>
                  </React.Fragment>
                );
              })}
            </nav>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Demo Lifecycle Mode Toggle */}
              <button
                type="button"
                onClick={() => setDemoLifecycleMode(!demoLifecycleMode)}
                title="Allows rapid status testing across election states"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                  demoLifecycleMode
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Demo Lifecycle: {demoLifecycleMode ? 'Flexible' : 'Strict'}
              </button>

              {/* Quick Demo Role Switcher (LOCAL_DEMO only) or Live Admin Badge (BACKEND_API) */}
              {currentAdmin && !isBackendApiMode && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#002868] shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
                    Role:
                  </span>
                  <select
                    aria-label="Switch Demo Admin Role"
                    value={currentAdmin.id}
                    onChange={handleRoleSwitch}
                    className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                  >
                    {adminOfficers.map((officer) => (
                      <option key={officer.id} value={officer.id}>
                        {ADMIN_ROLE_LABELS[officer.role]} ({officer.officerCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {currentAdmin && isBackendApiMode && (
                <Link
                  to="/eci/profile"
                  className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 text-xs font-bold text-[#002868] hover:bg-blue-100"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {ADMIN_ROLE_LABELS[currentAdmin.role] || currentAdmin.role} ({currentAdmin.officerCode})
                  </span>
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-red-700 hover:bg-red-50 border border-slate-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>

          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 focus:outline-none"
          >
            <Outlet />
          </main>
        </div>
      </div>
      <Footer />

      <Modal
        isOpen={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Reset Demonstration Data"
        subtitle="Restore all local datasets to original seed state"
      >
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            Are you sure you want to reset all local demonstration data? This will restore all 36 States/UTs, 72 sample districts, Parliamentary &amp; Assembly constituencies, elections, candidates, announcements, and voter participation statuses to their initial defaults.
          </p>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setConfirmResetOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReset}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 cursor-pointer"
            >
              Confirm Reset
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
