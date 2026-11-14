import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import Modal from '../../components/common/Modal';
import { ADMIN_ROLE_LABELS } from '../../utils/constants';
import {
  Settings,
  Download,
  Upload,
  RotateCcw,
  LogOut,
  Zap,
  Database,
} from 'lucide-react';
import BackendSystemSettings from '../../components/admin/BackendSystemSettings';
import { frontendEnv } from '../../config/env';

export default function AdminSettings() {
  if (frontendEnv.isBackendApi) {
    return <BackendSystemSettings />;
  }

  return <LocalDemoAdminSettings />;
}

function LocalDemoAdminSettings() {
  const navigate = useNavigate();
  const {
    states,
    districts,
    constituencies,
    elections,
    parties,
    candidates,
    voters,
    auditLogs,
    results = [],
    dataIntegrityReport,
    demoLifecycleMode,
    setDemoLifecycleMode,
    exportDemoDatasets,
    importDemoDatasets,
    resetDemoData,
  } = useElection();
  const { currentAdmin, canPerformAdminAction, logoutAdmin } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const handleExportJson = () => {
    const payload = exportDemoDatasets();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ovs-eci-demo-dataset-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notifySuccess('Exported complete OVS Demo Dataset JSON file.');
  };

  const handleImportJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const perm = canPerformAdminAction('RESET_DEMO_DATA');
    if (!perm.allowed) {
      notifyError(perm.reason);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const res = importDemoDatasets(parsed, currentAdmin);
        if (!res.ok) {
          notifyError(res.error);
          return;
        }
        notifySuccess('Successfully imported and persisted OVS Demo Datasets.');
      } catch {
        notifyError('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmReset = () => {
    const perm = canPerformAdminAction('RESET_DEMO_DATA');
    if (!perm.allowed) {
      notifyError(perm.reason);
      setConfirmResetOpen(false);
      return;
    }
    resetDemoData(currentAdmin);
    setConfirmResetOpen(false);
    notifySuccess(
      'All demo elections, constituencies, candidates, parties, and voter participation records have been restored to clean seed values.'
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-[#002868]" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              System Configuration &amp; Data Provenance
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              Admin Settings &amp; Dataset Portability
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Inspect active officer role permissions, toggle Demo Lifecycle Mode, verify relational data integrity, export/import JSON datasets, or reset local storage to factory seed data.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Admin Profile & RBAC Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-extrabold text-slate-900">
            Active Officer Profile &amp; RBAC Scope
          </h2>
          {currentAdmin && (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <p>
                  <span className="text-slate-500">Full Name:</span>{' '}
                  <strong className="text-slate-900">{currentAdmin.fullName}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Designation:</span>{' '}
                  <strong>{currentAdmin.designation}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Badge / Code:</span>{' '}
                  <code className="font-mono font-bold text-[#002868]">
                    {currentAdmin.officerCode}
                  </code>
                </p>
                <p>
                  <span className="text-slate-500">Assigned Role:</span>{' '}
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-[#002868] font-bold">
                    {ADMIN_ROLE_LABELS[currentAdmin.role] || currentAdmin.role}
                  </span>
                </p>
                {currentAdmin.assignedStateId && (
                  <p>
                    <span className="text-slate-500">Assigned State Scope:</span>{' '}
                    <strong>{currentAdmin.assignedStateId}</strong>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div>
                  <p className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-700" />
                    Demo Lifecycle Mode ({demoLifecycleMode ? 'Flexible' : 'Strict'})
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    When enabled, allows jumping directly between election statuses for rapid demonstration.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDemoLifecycleMode(!demoLifecycleMode)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-bold text-amber-900 cursor-pointer"
                >
                  {demoLifecycleMode ? 'Switch to Strict' : 'Enable Flexible'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dataset Provenance & Portability Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#002868]" />
            <h2 className="text-base font-extrabold text-slate-900">
              Local Storage Status &amp; Dataset Portability
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            {[
              { label: 'States & UTs', val: states.length },
              { label: 'Districts', val: districts.length },
              { label: 'Constituencies', val: constituencies.length },
              { label: 'Elections', val: elections.length },
              { label: 'Parties', val: parties.length },
              { label: 'Candidates', val: candidates.length },
              { label: 'Demo Voters', val: voters.length },
              { label: 'Result Sessions', val: results.length },
              { label: 'Audit Logs', val: auditLogs.length },
            ].map((item) => (
              <div
                key={item.label}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200"
              >
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  {item.label}
                </p>
                <p className="text-sm font-mono font-extrabold text-slate-900 mt-0.5">
                  {item.val}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Demo JSON
            </button>

            <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Import Demo JSON</span>
              <input
                type="file"
                accept="application/json"
                onChange={handleImportJson}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo Data
            </button>

            <button
              type="button"
              onClick={() => {
                logoutAdmin();
                navigate('/eci/login');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer ml-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Live 17-Rule Election Data Integrity & Provenance Audit Card */}
      {dataIntegrityReport && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Automated Election Data Integrity &amp; Provenance Audit (17 Rules)
              </h2>
              <p className="text-xs text-slate-600">
                Verifies foreign-key integrity, Parliamentary vs. Assembly constituency separation, schedule chronology, and counting session consistency.
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-lg text-xs font-extrabold border ${
                dataIntegrityReport.isHealthy
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-red-50 text-red-900 border-red-200'
              }`}
            >
              {dataIntegrityReport.rulesPassed} / {dataIntegrityReport.totalRulesChecked} Rules Passing
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {dataIntegrityReport.ruleResults.map((rule) => (
              <div
                key={rule.ruleNumber}
                className={`p-3 rounded-xl border flex items-start justify-between gap-2 ${
                  rule.passed
                    ? 'bg-slate-50/70 border-slate-200 text-slate-800'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="min-w-0">
                  <span className="font-mono text-[10px] font-bold text-slate-500 block">
                    RULE #{rule.ruleNumber}
                  </span>
                  <span className="font-bold block truncate" title={rule.ruleName}>
                    {rule.ruleName}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 ${
                    rule.passed
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-red-200 text-red-950'
                  }`}
                >
                  {rule.passed ? 'PASS' : `${rule.issueCount} ERR`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Confirm Demo Dataset Reset"
        subtitle="Restore all local datasets to original seed state"
      >
        <div className="space-y-4 text-xs text-slate-600">
          <p>
            Are you sure you want to reset all local demonstration datasets? This will restore all 36 States/UTs, districts, constituencies, elections, candidates, announcements, counting sessions, and participation records to their default seed state.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setConfirmResetOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReset}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 font-bold text-white cursor-pointer"
            >
              Confirm Reset
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

