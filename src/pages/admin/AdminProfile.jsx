import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../services/apiClient';
import { ADMIN_ROLE_LABELS } from '../../utils/constants';
import {
  ShieldCheck,
  KeyRound,
  MapPin,
  MonitorSmartphone,
  LogOut,
  Trash2,
  Edit3,
} from 'lucide-react';

export default function AdminProfile() {
  const navigate = useNavigate();
  const {
    currentAdmin,
    adminPermissions,
    isBackendApiMode,
    csrfToken,
    refreshAdminSession,
    logoutAdmin,
    logoutAll,
  } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentAdmin) {
      setFullName(currentAdmin.fullName || currentAdmin.name || '');
      setDesignation(currentAdmin.designation || '');
    }
  }, [currentAdmin]);

  const loadSessions = useCallback(async () => {
    if (!isBackendApiMode) return;
    setLoadingSessions(true);
    try {
      const res = await apiClient.admin.listSessions();
      setSessions(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [isBackendApiMode]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  if (!currentAdmin) return null;

  const assignedStates =
    currentAdmin.assignedStateIds?.length > 0
      ? currentAdmin.assignedStateIds
      : currentAdmin.assignedStateId
      ? [currentAdmin.assignedStateId]
      : [];

  const assignedElections = currentAdmin.assignedElectionIds || [];
  const constituencyScopes = currentAdmin.assignedConstituencyScopes || [];

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!isBackendApiMode) {
      notifyError('Profile updates via API require BACKEND_API mode.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.admin.updateMe(
        {
          fullName: fullName.trim(),
          designation: designation.trim(),
        },
        csrfToken
      );
      await refreshAdminSession();
      setEditing(false);
      notifySuccess('Administrator profile updated.');
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      await apiClient.admin.revokeSession(sessionId, csrfToken);
      notifySuccess('Session revoked.');
      loadSessions();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to revoke session.');
    }
  };

  const handleLogoutAll = async () => {
    await logoutAll();
    notifySuccess('All active administrator sessions have been revoked.');
    navigate('/eci/login');
  };

  const handleLogout = async () => {
    await logoutAdmin();
    navigate('/eci/login');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-[#002868]" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Administrator Identity &amp; Security Profile
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {currentAdmin.fullName || currentAdmin.name}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {currentAdmin.designation} •{' '}
              <code className="font-mono font-bold text-[#002868]">
                {currentAdmin.officerCode}
              </code>
              {currentAdmin.email ? ` • ${currentAdmin.email}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
          <button
            type="button"
            onClick={handleLogoutAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out All Devices
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Details Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900">
              Account Details
            </h2>
            {isBackendApiMode && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Designation
                </label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-[#002868] text-white font-bold cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p>
                <span className="text-slate-500">Assigned Role:</span>{' '}
                <span className="px-2 py-0.5 rounded bg-blue-100 text-[#002868] font-bold">
                  {ADMIN_ROLE_LABELS[currentAdmin.role] || currentAdmin.role}
                </span>
              </p>
              <p>
                <span className="text-slate-500">Account Status:</span>{' '}
                <strong className="text-emerald-700">
                  {currentAdmin.status || 'ACTIVE'}
                </strong>
              </p>
              <p>
                <span className="text-slate-500">Officer Code:</span>{' '}
                <code className="font-mono font-bold">{currentAdmin.officerCode}</code>
              </p>
              {currentAdmin.email && (
                <p>
                  <span className="text-slate-500">Email:</span>{' '}
                  <strong>{currentAdmin.email}</strong>
                </p>
              )}
              <p>
                <span className="text-slate-500">Runtime Mode:</span>{' '}
                <span className="font-mono font-bold">
                  {isBackendApiMode ? 'BACKEND_API' : 'LOCAL_DEMO'}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Jurisdiction Scope Display */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#002868]" />
            <h2 className="text-base font-extrabold text-slate-900">
              Assigned Jurisdiction Scopes
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <p className="font-bold text-slate-700 mb-1">State Jurisdictions</p>
              {assignedStates.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {assignedStates.map((st) => (
                    <span
                      key={st}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[#002868] font-mono font-bold"
                    >
                      {st}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 italic">
                  {['SUPER_ADMIN', 'NATIONAL_ADMIN', 'READ_ONLY_AUDITOR'].includes(
                    currentAdmin.role
                  )
                    ? 'Global / National Visibility (Unrestricted by State)'
                    : 'No states assigned'}
                </p>
              )}
            </div>

            <div>
              <p className="font-bold text-slate-700 mb-1">Election Scopes</p>
              {assignedElections.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {assignedElections.map((el) => (
                    <span
                      key={el}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono font-bold"
                    >
                      {el}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 italic">
                  {['SUPER_ADMIN', 'NATIONAL_ADMIN'].includes(currentAdmin.role)
                    ? 'All Elections in Scope'
                    : 'No election-specific overrides'}
                </p>
              )}
            </div>

            {constituencyScopes.length > 0 && (
              <div>
                <p className="font-bold text-slate-700 mb-1">
                  Constituency Scopes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {constituencyScopes.map((cs) => (
                    <span
                      key={cs.id || cs.parliamentaryConstituencyId || cs.assemblyConstituencyId}
                      className="px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 font-mono font-bold"
                    >
                      {cs.constituencyType}:{' '}
                      {cs.parliamentaryConstituencyId || cs.assemblyConstituencyId}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Effective Permissions Matrix Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-[#002868]" />
          <h2 className="text-base font-extrabold text-slate-900">
            Effective RBAC Permissions ({adminPermissions.length})
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {adminPermissions.map((perm) => (
            <span
              key={perm}
              className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-mono text-[11px] font-semibold"
            >
              {perm}
            </span>
          ))}
        </div>
      </div>

      {/* Active Sessions List (Backend API Mode) */}
      {isBackendApiMode && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="w-5 h-5 text-[#002868]" />
              <h2 className="text-base font-extrabold text-slate-900">
                Active Administrator Sessions ({sessions.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={loadSessions}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Refresh
            </button>
          </div>

          {loadingSessions ? (
            <p className="text-xs text-slate-500">Loading active sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-slate-500">No active sessions returned.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-mono font-bold text-slate-900">
                      {s.id.slice(0, 12)}...{' '}
                      {s.isCurrent && (
                        <span className="ml-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px]">
                          Current Session
                        </span>
                      )}
                    </p>
                    <p className="text-slate-500">
                      IP: {s.ipAddress || 'unknown'} • Created:{' '}
                      {new Date(s.createdAt).toLocaleString()} • Expires:{' '}
                      {new Date(s.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  {!s.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(s.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
