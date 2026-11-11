import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../services/apiClient';
import { ADMIN_PERMISSION_KEYS } from '../../services/adminPermissionService';
import { ADMIN_ROLE_LABELS } from '../../utils/constants';
import Modal from '../../components/common/Modal';
import SearchBar from '../../components/common/SearchBar';
import { Users, UserPlus, Ban, CheckCircle2, MapPin, ShieldAlert } from 'lucide-react';

export default function AdminUserManagement() {
  const {
    currentAdmin,
    adminOfficers,
    hasAdminPermission,
    isBackendApiMode,
    csrfToken,
  } = useAuth();
  const { states, elections } = useElection();
  const { notifySuccess, notifyError } = useNotification();

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [scopeTarget, setScopeTarget] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);

  const [createForm, setCreateForm] = useState({
    officerCode: '',
    email: '',
    fullName: '',
    designation: '',
    role: 'ELECTION_OFFICER',
    password: '',
    stateIds: [],
    electionIds: [],
  });
  const [scopeForm, setScopeForm] = useState({ stateIds: [], electionIds: [] });
  const [suspendReason, setSuspendReason] = useState('');

  const canCreate = hasAdminPermission(ADMIN_PERMISSION_KEYS.ADMIN_USERS_CREATE);
  const canSuspend = hasAdminPermission(ADMIN_PERMISSION_KEYS.ADMIN_USERS_SUSPEND);
  const canAssignScopes = hasAdminPermission(ADMIN_PERMISSION_KEYS.ADMIN_SCOPES_ASSIGN);

  const fetchAdmins = useCallback(async () => {
    if (!isBackendApiMode) {
      setAdmins(adminOfficers);
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.admin.listUsers({
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      setAdmins(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Unable to load administrators.');
    } finally {
      setLoading(false);
    }
  }, [isBackendApiMode, adminOfficers, roleFilter, statusFilter, search, notifyError]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const assignableRoles = (() => {
    if (!currentAdmin) return [];
    if (currentAdmin.role === 'SUPER_ADMIN') {
      return [
        'SUPER_ADMIN',
        'NATIONAL_ADMIN',
        'STATE_ADMIN',
        'ELECTION_OFFICER',
        'READ_ONLY_AUDITOR',
      ];
    }
    if (currentAdmin.role === 'NATIONAL_ADMIN') {
      return ['STATE_ADMIN', 'ELECTION_OFFICER', 'READ_ONLY_AUDITOR'];
    }
    if (currentAdmin.role === 'STATE_ADMIN') {
      return ['ELECTION_OFFICER'];
    }
    return [];
  })();

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!isBackendApiMode) return;
    try {
      await apiClient.admin.createUser(createForm, csrfToken);
      setCreateOpen(false);
      setCreateForm({
        officerCode: '',
        email: '',
        fullName: '',
        designation: '',
        role: 'ELECTION_OFFICER',
        password: '',
        stateIds: [],
        electionIds: [],
      });
      notifySuccess('Administrator provisioned successfully.');
      fetchAdmins();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to provision administrator.');
    }
  };

  const handleSuspendSubmit = async (e) => {
    e.preventDefault();
    if (!suspendTarget) return;
    try {
      await apiClient.admin.suspendUser(
        suspendTarget.id,
        { reason: suspendReason.trim() || 'Administrative suspension', mode: 'SUSPEND' },
        csrfToken
      );
      setSuspendTarget(null);
      setSuspendReason('');
      notifySuccess('Administrator suspended and active sessions revoked.');
      fetchAdmins();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to suspend administrator.');
    }
  };

  const handleActivate = async (adminId) => {
    try {
      await apiClient.admin.activateUser(adminId, {}, csrfToken);
      notifySuccess('Administrator account reactivated.');
      fetchAdmins();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to activate administrator.');
    }
  };

  const handleSaveScopes = async (e) => {
    e.preventDefault();
    if (!scopeTarget) return;
    try {
      await apiClient.admin.updateUserScopes(
        scopeTarget.id,
        {
          assignedStateId: scopeForm.stateIds[0] || null,
          stateIds: scopeForm.stateIds,
          electionIds: scopeForm.electionIds,
        },
        csrfToken
      );
      setScopeTarget(null);
      notifySuccess('Jurisdiction scopes updated.');
      fetchAdmins();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to update jurisdiction scopes.');
    }
  };

  const filteredAdmins = isBackendApiMode
    ? admins
    : admins.filter((a) => {
        if (roleFilter && a.role !== roleFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            (a.fullName || '').toLowerCase().includes(q) ||
            (a.officerCode || '').toLowerCase().includes(q)
          );
        }
        return true;
      });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-[#002868]" />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
                Controlled RBAC Governance
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                Administrator Accounts &amp; Jurisdiction Scopes
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Manage ECI administrative roles, account lifecycles, and state/election scopes. Server enforces strict hierarchy and non-escalation controls.
              </p>
            </div>
          </div>

          {isBackendApiMode && canCreate && assignableRoles.length > 0 && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Provision Administrator
            </button>
          )}
        </div>

        {!isBackendApiMode && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>LOCAL_DEMO Mode:</strong> Displaying preset demo administrators. Switch{' '}
              <code>VITE_DATA_SOURCE_MODE=BACKEND_API</code> to provision, suspend, activate, and scope live PostgreSQL administrators.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search officer code, name, or email..."
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Roles</option>
            {Object.entries(ADMIN_ROLE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="DEACTIVATED">DEACTIVATED</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3 px-4">Officer Code &amp; Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Jurisdiction Scope</th>
                {isBackendApiMode && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Loading administrators...
                  </td>
                </tr>
              ) : filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No administrators found in your authorized scope.
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => {
                  const stIds =
                    admin.assignedStateIds?.length > 0
                      ? admin.assignedStateIds
                      : admin.assignedStateId
                      ? [admin.assignedStateId]
                      : [];
                  const status = admin.status || 'ACTIVE';
                  const isSelf = currentAdmin?.id === admin.id;

                  return (
                    <tr key={admin.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">
                          {admin.fullName || admin.name}
                          {isSelf && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-100 text-[#002868] text-[10px]">
                              You
                            </span>
                          )}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500">
                          {admin.officerCode}
                          {admin.email ? ` • ${admin.email}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-[#002868] font-bold text-[11px]">
                          {ADMIN_ROLE_LABELS[admin.role] || admin.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                            status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-red-100 text-red-900'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {stIds.length > 0 && (
                          <span className="block">States: {stIds.join(', ')}</span>
                        )}
                        {admin.assignedElectionIds?.length > 0 && (
                          <span className="block text-slate-500">
                            Elections: {admin.assignedElectionIds.join(', ')}
                          </span>
                        )}
                        {stIds.length === 0 && !admin.assignedElectionIds?.length && (
                          <span className="text-slate-400">Global / National</span>
                        )}
                      </td>
                      {isBackendApiMode && (
                        <td className="py-3 px-4 text-right space-x-2">
                          {canAssignScopes && !isSelf && (
                            <button
                              type="button"
                              onClick={() => {
                                setScopeTarget(admin);
                                setScopeForm({
                                  stateIds: stIds,
                                  electionIds: admin.assignedElectionIds || [],
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
                            >
                              <MapPin className="w-3 h-3" />
                              Scopes
                            </button>
                          )}
                          {canSuspend && !isSelf && status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => setSuspendTarget(admin)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 font-bold text-red-700 cursor-pointer"
                            >
                              <Ban className="w-3 h-3" />
                              Suspend
                            </button>
                          )}
                          {canSuspend && !isSelf && status !== 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => handleActivate(admin.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-700 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Activate
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision Administrator Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Provision New Administrator"
        subtitle="Creates User + AdminUser + Jurisdiction Scopes"
      >
        <form onSubmit={handleCreateAdmin} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Officer Code *</label>
              <input
                type="text"
                required
                value={createForm.officerCode}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, officerCode: e.target.value }))
                }
                placeholder="ECI-WB-001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="officer@ovs-demo.local"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={createForm.fullName}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, fullName: e.target.value }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Designation *</label>
              <input
                type="text"
                required
                value={createForm.designation}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, designation: e.target.value }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Role *</label>
              <select
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, role: e.target.value }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ADMIN_ROLE_LABELS[r] || r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Initial Password (Min 12 chars) *
              </label>
              <input
                type="password"
                required
                minLength={12}
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, password: e.target.value }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              State Scope(s) (Optional)
            </label>
            <select
              multiple
              value={createForm.stateIds}
              onChange={(e) =>
                setCreateForm((p) => ({
                  ...p,
                  stateIds: Array.from(e.target.selectedOptions, (o) => o.value),
                }))
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg h-24 bg-white"
            >
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#002868] text-white font-bold cursor-pointer"
            >
              Provision Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Suspend Administrator Modal */}
      <Modal
        isOpen={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        title="Suspend Administrator Account"
        subtitle={suspendTarget ? `${suspendTarget.fullName} (${suspendTarget.officerCode})` : ''}
      >
        <form onSubmit={handleSuspendSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Suspension Reason *
            </label>
            <textarea
              required
              minLength={3}
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Document audit reason for suspension..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setSuspendTarget(null)}
              className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold cursor-pointer"
            >
              Confirm Suspension
            </button>
          </div>
        </form>
      </Modal>

      {/* Scope Management Modal */}
      <Modal
        isOpen={Boolean(scopeTarget)}
        onClose={() => setScopeTarget(null)}
        title="Manage Jurisdiction Scopes"
        subtitle={scopeTarget ? `${scopeTarget.fullName} (${scopeTarget.officerCode})` : ''}
      >
        <form onSubmit={handleSaveScopes} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Assigned States</label>
            <select
              multiple
              value={scopeForm.stateIds}
              onChange={(e) =>
                setScopeForm((p) => ({
                  ...p,
                  stateIds: Array.from(e.target.selectedOptions, (o) => o.value),
                }))
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg h-24 bg-white"
            >
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Assigned Elections</label>
            <select
              multiple
              value={scopeForm.electionIds}
              onChange={(e) =>
                setScopeForm((p) => ({
                  ...p,
                  electionIds: Array.from(e.target.selectedOptions, (o) => o.value),
                }))
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg h-24 bg-white"
            >
              {elections.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.name} ({el.id})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setScopeTarget(null)}
              className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#002868] text-white font-bold cursor-pointer"
            >
              Save Scopes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
