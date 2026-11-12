import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../services/apiClient';
import {
  ADMIN_PERMISSION_KEYS,
  hasAdminPermission,
} from '../../services/adminPermissionService';
import Modal from '../common/Modal';
import BackendElectionConfigPanel from './BackendElectionConfigPanel';
import {
  PlusCircle,
  Search,
  Eye,
  Edit3,
  ArrowLeft,
  XCircle,
  Archive,
  Clock,
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';

const STATUS_BADGE_STYLES = {
  DRAFT: 'bg-slate-100 text-slate-800 border-slate-200',
  UPCOMING: 'bg-sky-50 text-sky-900 border-sky-200',
  NOMINATION_OPEN: 'bg-indigo-50 text-indigo-900 border-indigo-200',
  NOMINATION_CLOSED: 'bg-purple-50 text-purple-900 border-purple-200',
  READY: 'bg-teal-50 text-teal-900 border-teal-200',
  POLLING_ACTIVE: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  POLLING_COMPLETED: 'bg-blue-50 text-blue-900 border-blue-200',
  COUNTING: 'bg-amber-50 text-amber-900 border-amber-200',
  RESULTS_DECLARED: 'bg-green-50 text-green-900 border-green-200',
  CANCELLED: 'bg-red-50 text-red-900 border-red-200',
  ARCHIVED: 'bg-zinc-100 text-zinc-700 border-zinc-300',
};

const ALL_STATUSES = Object.keys(STATUS_BADGE_STYLES);

export default function BackendElectionManager() {
  const { id: routeElectionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentAdmin, csrfToken } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const isCreateRoute = location.pathname === '/eci/elections/create';
  const canCreate = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CREATE
  );
  const canUpdate = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.ELECTIONS_UPDATE
  );
  const canManageStatus = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.ELECTIONS_MANAGE_STATUS
  );
  const canCancel = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CANCEL
  );
  const canArchive = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.ELECTIONS_ARCHIVE
  );
  const canReadHistory = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.ELECTIONS_HISTORY_READ
  );

  const isStateAdmin = currentAdmin?.role === 'STATE_ADMIN';
  const defaultStateId =
    currentAdmin?.assignedStateIds?.[0] || currentAdmin?.assignedStateId || 'WB';

  const [summary, setSummary] = useState(null);
  const [states, setStates] = useState([]);
  const [elections, setElections] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Detail & history state
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create / Edit state
  const [showCreateForm, setShowCreateForm] = useState(isCreateRoute);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const buildDefaultForm = useCallback(
    () => ({
      id: '',
      name: '',
      type: isStateAdmin ? 'STATE_ASSEMBLY' : 'LOK_SABHA',
      year: 2029,
      stateId: isStateAdmin ? defaultStateId : '',
      country: 'India',
      targetJurisdiction: '',
      description: '',
      initialStatus: 'DRAFT',
      pollingStartDate: '2029-04-20',
      pollingEndDate: '2029-05-15',
      countingDate: '2029-05-20',
      resultDate: '2029-05-22',
      expectedVersion: 1,
    }),
    [isStateAdmin, defaultStateId]
  );

  const [form, setForm] = useState(buildDefaultForm);

  // Modals for Cancel & Archive
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveNote, setArchiveNote] = useState('');

  useEffect(() => {
    setShowCreateForm(isCreateRoute);
    if (isCreateRoute) {
      setEditingId(null);
      setForm(buildDefaultForm());
    }
  }, [isCreateRoute, buildDefaultForm]);

  useEffect(() => {
    apiClient.geography
      .listStates({ limit: 50 })
      .then((res) => setStates(res?.data || []))
      .catch(() => {});
  }, []);

  const loadListAndSummary = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.all([
        apiClient.admin.elections.summary(),
        apiClient.admin.elections.list({
          page,
          limit: 10,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(typeFilter ? { type: typeFilter } : {}),
          ...(stateFilter ? { stateId: stateFilter } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        }),
      ]);
      setSummary(sumRes?.data || null);
      setElections(listRes?.data || []);
      if (listRes?.meta?.pagination) {
        setPagination(listRes.meta.pagination);
      }
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to load elections.');
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, stateFilter, statusFilter, notifyError]);

  const loadDetail = useCallback(
    async (electionId) => {
      if (!electionId) {
        setDetail(null);
        setHistory([]);
        return;
      }
      setDetailLoading(true);
      try {
        const res = await apiClient.admin.elections.getById(electionId);
        setDetail(res?.data || null);
        if (canReadHistory) {
          const histRes = await apiClient.admin.elections.history(electionId, {
            page: 1,
            limit: 50,
          });
          setHistory(histRes?.data || []);
        }
      } catch (err) {
        notifyError(
          err?.detail || err?.message || 'Unable to inspect this election.'
        );
        navigate('/eci/elections');
      } finally {
        setDetailLoading(false);
      }
    },
    [canReadHistory, navigate, notifyError]
  );

  useEffect(() => {
    loadListAndSummary();
  }, [loadListAndSummary]);

  useEffect(() => {
    if (routeElectionId) {
      loadDetail(routeElectionId);
    } else {
      setDetail(null);
      setHistory([]);
    }
  }, [routeElectionId, loadDetail]);

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await apiClient.admin.elections.update(
          editingId,
          {
            name: form.name.trim(),
            year: Number(form.year),
            country: form.country.trim(),
            targetJurisdiction: form.targetJurisdiction.trim() || undefined,
            description: form.description.trim(),
            pollingStartDate: form.pollingStartDate,
            pollingEndDate: form.pollingEndDate,
            countingDate: form.countingDate,
            resultDate: form.resultDate,
            expectedVersion: Number(form.expectedVersion),
          },
          csrfToken
        );
        notifySuccess(`Updated election '${res.data.id}' (v${res.data.version}).`);
        setEditingId(null);
        setShowCreateForm(false);
        await loadListAndSummary();
        if (routeElectionId === res.data.id) {
          await loadDetail(res.data.id);
        }
      } else {
        const payload = {
          id: form.id.trim().toUpperCase(),
          name: form.name.trim(),
          type: form.type,
          year: Number(form.year),
          stateId: form.type === 'LOK_SABHA' ? null : form.stateId,
          country: form.country.trim(),
          targetJurisdiction: form.targetJurisdiction.trim() || undefined,
          description: form.description.trim(),
          initialStatus: form.initialStatus,
          pollingStartDate: form.pollingStartDate,
          pollingEndDate: form.pollingEndDate,
          countingDate: form.countingDate,
          resultDate: form.resultDate,
          metadataSource: 'DEMO_SAMPLE',
        };
        const res = await apiClient.admin.elections.create(payload, csrfToken);
        notifySuccess(`Created election '${res.data.id}' (${res.data.status}).`);
        setShowCreateForm(false);
        setForm(buildDefaultForm());
        await loadListAndSummary();
        navigate(`/eci/elections/${res.data.id}`);
      }
    } catch (err) {
      const msg = err?.detail || err?.message || 'Election operation failed.';
      setFormError(msg);
      notifyError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (el) => {
    setEditingId(el.id);
    setShowCreateForm(true);
    setFormError('');
    setForm({
      id: el.id,
      name: el.name,
      type: el.type,
      year: el.year,
      stateId: el.stateId || '',
      country: el.country || 'India',
      targetJurisdiction: el.targetJurisdiction || '',
      description: el.description || '',
      initialStatus: el.status,
      pollingStartDate: el.pollingStartDate,
      pollingEndDate: el.pollingEndDate,
      countingDate: el.countingDate,
      resultDate: el.resultDate,
      expectedVersion: el.version,
    });
  };

  const handleTransition = async (el, targetStatus) => {
    try {
      const res = await apiClient.admin.elections.transition(
        el.id,
        {
          targetStatus,
          note: `Lifecycle transition to ${targetStatus} via Admin Console.`,
          expectedVersion: el.version,
        },
        csrfToken
      );
      notifySuccess(`Election '${el.id}' moved to ${res.data.status}.`);
      await loadListAndSummary();
      if (routeElectionId === el.id) {
        await loadDetail(el.id);
      }
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Status transition failed.');
    }
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancelTarget) return;
    try {
      await apiClient.admin.elections.cancel(
        cancelTarget.id,
        {
          reason: cancelReason.trim(),
          expectedVersion: cancelTarget.version,
        },
        csrfToken
      );
      notifySuccess(`Election '${cancelTarget.id}' has been cancelled.`);
      setCancelTarget(null);
      setCancelReason('');
      await loadListAndSummary();
      if (routeElectionId === cancelTarget.id) {
        await loadDetail(cancelTarget.id);
      }
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Cancellation failed.');
    }
  };

  const handleConfirmArchive = async (e) => {
    e.preventDefault();
    if (!archiveTarget) return;
    try {
      await apiClient.admin.elections.archive(
        archiveTarget.id,
        {
          note:
            archiveNote.trim() ||
            'Archived for historical audit preservation.',
          expectedVersion: archiveTarget.version,
        },
        csrfToken
      );
      notifySuccess(`Election '${archiveTarget.id}' has been archived.`);
      setArchiveTarget(null);
      setArchiveNote('');
      await loadListAndSummary();
      if (routeElectionId === archiveTarget.id) {
        await loadDetail(archiveTarget.id);
      }
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Archival failed.');
    }
  };

  const allowedStatesForCreate = isStateAdmin
    ? states.filter((s) =>
        (
          currentAdmin?.assignedStateIds ||
          (currentAdmin?.assignedStateId ? [currentAdmin.assignedStateId] : [])
        ).includes(s.id)
      )
    : states;

  // Detail Screen
  if (routeElectionId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/eci/elections"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#002868] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Election Directory
          </Link>
          <button
            type="button"
            onClick={() => loadDetail(routeElectionId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {detailLoading || !detail ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs font-bold text-slate-600">
            Loading election details...
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800">
                      {detail.id}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        STATUS_BADGE_STYLES[detail.status] ||
                        'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {detail.status}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      v{detail.version} • {detail.metadataSource}
                    </span>
                  </div>
                  <h1 className="text-xl font-extrabold text-slate-900 mt-2">
                    {detail.name}
                  </h1>
                  <p className="text-xs text-slate-600 mt-1">
                    {detail.type === 'LOK_SABHA'
                      ? 'Lok Sabha Parliamentary Election'
                      : 'State Legislative Assembly Election'}{' '}
                    • {detail.targetJurisdiction} ({detail.country}) • Year{' '}
                    {detail.year}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canUpdate && detail.canEditMetadata && (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(detail)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-900"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Metadata
                    </button>
                  )}
                  {canCancel && detail.canCancel && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelTarget(detail);
                        setCancelReason('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-bold text-red-900"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel Election
                    </button>
                  )}
                  {canArchive && detail.canArchive && (
                    <button
                      type="button"
                      onClick={() => {
                        setArchiveTarget(detail);
                        setArchiveNote('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Archive Election
                    </button>
                  )}
                </div>
              </div>

              {detail.description && (
                <p className="text-xs text-slate-700 leading-relaxed">
                  {detail.description}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-semibold">Polling Window</p>
                  <p className="font-bold text-slate-900 mt-1">
                    {detail.pollingStartDate} to {detail.pollingEndDate}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-semibold">Counting & Result</p>
                  <p className="font-bold text-slate-900 mt-1">
                    {detail.countingDate} / {detail.resultDate}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-semibold">Created By</p>
                  <p className="font-bold text-slate-900 mt-1">
                    {detail.createdByAdmin
                      ? `${detail.createdByAdmin.fullName} (${detail.createdByAdmin.officerCode})`
                      : 'DEMO_SAMPLE Seed'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-slate-500 font-semibold">Last Modified By</p>
                  <p className="font-bold text-slate-900 mt-1">
                    {detail.updatedByAdmin
                      ? `${detail.updatedByAdmin.fullName} (${detail.updatedByAdmin.officerCode})`
                      : 'System'}
                  </p>
                </div>
              </div>

              {detail.status === 'CANCELLED' && detail.cancellationReason && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    Election Cancelled
                  </p>
                  <p>Reason: {detail.cancellationReason}</p>
                  <p className="text-[11px] text-red-800">
                    Cancelled at {detail.cancelledAt}
                    {detail.cancelledByAdmin
                      ? ` by ${detail.cancelledByAdmin.fullName} (${detail.cancelledByAdmin.officerCode})`
                      : ''}
                  </p>
                </div>
              )}

              {detail.status === 'ARCHIVED' && (
                <div className="p-4 rounded-xl bg-zinc-100 border border-zinc-300 text-xs text-zinc-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <Archive className="w-4 h-4" />
                    Election Archived (Read-Only Historical Record)
                  </p>
                  {detail.archiveNote && <p>Note: {detail.archiveNote}</p>}
                </div>
              )}

              {canManageStatus && detail.allowedNextStatuses?.length > 0 && (
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                    Lifecycle Transitions:
                  </span>
                  {detail.allowedNextStatuses.map((nextStatus) => (
                    <button
                      key={nextStatus}
                      type="button"
                      onClick={() => handleTransition(detail, nextStatus)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Move to {nextStatus}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {showCreateForm && editingId === detail.id && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <h2 className="text-base font-extrabold text-slate-900">
                  Update Election Metadata ({detail.id})
                </h2>
                {formError && (
                  <p className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900">
                    {formError}
                  </p>
                )}
                <form onSubmit={handleSubmitForm} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Election Name
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Target Jurisdiction
                    </label>
                    <input
                      type="text"
                      value={form.targetJurisdiction}
                      onChange={(e) =>
                        setForm({ ...form, targetJurisdiction: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 rounded-xl bg-[#002868] text-white font-bold"
                    >
                      {submitting ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setShowCreateForm(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Phase 8.7 Configuration Panel */}
            {detail?.id && (
              <BackendElectionConfigPanel
                electionId={detail.id}
                election={detail}
                onConfigUpdated={() => {
                  loadDetail(detail.id);
                  loadListAndSummary();
                }}
              />
            )}

            {/* Lifecycle History */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#002868]" />
                Immutable Lifecycle & Modification History ({history.length})
              </h2>
              {history.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No lifecycle events recorded yet for this election.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-900">
                          {item.action} • {item.fromStatus} → {item.toStatus}
                        </p>
                        {item.note && (
                          <p className="text-slate-700">{item.note}</p>
                        )}
                        <p className="text-[11px] text-slate-500">
                          Actor:{' '}
                          {item.changedByAdmin
                            ? `${item.changedByAdmin.fullName} (${item.changedByAdmin.officerCode})`
                            : 'System'}{' '}
                          {item.requestId ? `• Req: ${item.requestId}` : ''}
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500">
                        {new Date(item.changedAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Cancel & Archive Modals */}
        <Modal
          isOpen={Boolean(cancelTarget)}
          onClose={() => setCancelTarget(null)}
          title={`Cancel Election: ${cancelTarget?.id || ''}`}
        >
          <form onSubmit={handleConfirmCancel} className="space-y-4 text-xs">
            <p className="text-slate-700">
              Cancelling an election preserves the historical record and prevents
              any future reopening. Provide a formal administrative reason
              (minimum 5 characters).
            </p>
            <textarea
              required
              minLength={5}
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for election cancellation..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-800"
              >
                Keep Election
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-red-700 font-bold text-white"
              >
                Confirm Cancellation
              </button>
            </div>
          </form>
        </Modal>

        <Modal
          isOpen={Boolean(archiveTarget)}
          onClose={() => setArchiveTarget(null)}
          title={`Archive Election: ${archiveTarget?.id || ''}`}
        >
          <form onSubmit={handleConfirmArchive} className="space-y-4 text-xs">
            <p className="text-slate-700">
              Archiving marks this election as a read-only historical record.
              Audit trails, candidates, and constituency links remain preserved.
            </p>
            <textarea
              rows={2}
              value={archiveNote}
              onChange={(e) => setArchiveNote(e.target.value)}
              placeholder="Optional archive note..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-zinc-900 font-bold text-white"
              >
                Confirm Archive
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // Directory + Summary Dashboard + Create Screen
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Phase 8.5 • Backend Election Management
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Election Creation, Directory &amp; Lifecycle Control
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Jurisdiction-scoped management of independent Lok Sabha and State
            Legislative Assembly demo elections.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(buildDefaultForm());
              setShowCreateForm((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold"
          >
            <PlusCircle className="w-4 h-4" />
            {showCreateForm ? 'Close Form' : 'Create Election'}
          </button>
        )}
      </div>

      {/* Authorized Jurisdiction Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Total', value: summary.total },
            { label: 'Lok Sabha', value: summary.lokSabha },
            { label: 'Assembly', value: summary.stateAssembly },
            { label: 'Draft', value: summary.draft },
            { label: 'Active', value: summary.active },
            { label: 'Completed', value: summary.completed },
            { label: 'Cancelled', value: summary.cancelled },
            { label: 'Archived', value: summary.archived },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs"
            >
              <p className="text-[11px] font-bold uppercase text-slate-500">
                {card.label}
              </p>
              <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Creation Form */}
      {showCreateForm && canCreate && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-extrabold text-slate-900">
            Create Synthetic Demo Election
          </h2>
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900">
              {formError}
            </div>
          )}
          <form
            onSubmit={handleSubmitForm}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs"
          >
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Election Identifier *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. WB-ASSEMBLY-2030"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono uppercase"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Election Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. West Bengal Assembly Demo Election 2030"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Election Type *
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value,
                    stateId:
                      e.target.value === 'LOK_SABHA' ? '' : defaultStateId,
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              >
                {!isStateAdmin && (
                  <option value="LOK_SABHA">Lok Sabha (Parliamentary)</option>
                )}
                <option value="STATE_ASSEMBLY">
                  State Legislative Assembly
                </option>
              </select>
            </div>

            {form.type === 'STATE_ASSEMBLY' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Target State / UT *
                </label>
                <select
                  required
                  value={form.stateId}
                  onChange={(e) =>
                    setForm({ ...form, stateId: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="">Select state...</option>
                  {allowedStatesForCreate.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Year *
              </label>
              <input
                type="number"
                required
                min={2000}
                max={2100}
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Initial Status
              </label>
              <select
                value={form.initialStatus}
                onChange={(e) =>
                  setForm({ ...form, initialStatus: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="UPCOMING">UPCOMING</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block font-bold text-slate-700 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Educational demonstration election description..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div className="md:col-span-3 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-[#002868] text-white font-bold"
              >
                {submitting ? 'Creating...' : 'Create Election'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  if (isCreateRoute) navigate('/eci/elections');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 font-bold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search ID, name, jurisdiction..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-xl border border-slate-300"
        >
          <option value="">All Election Types</option>
          <option value="LOK_SABHA">Lok Sabha</option>
          <option value="STATE_ASSEMBLY">State Assembly</option>
        </select>
        <select
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-xl border border-slate-300"
        >
          <option value="">All States / National</option>
          {states.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name} ({st.id})
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-xl border border-slate-300"
        >
          <option value="">All Statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Elections Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">Identifier</th>
              <th className="px-4 py-3">Name &amp; Jurisdiction</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Polling</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Loading authorized elections...
                </td>
              </tr>
            ) : elections.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No elections found within your jurisdiction filters.
                </td>
              </tr>
            ) : (
              elections.map((el) => (
                <tr key={el.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">
                    {el.id}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{el.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {el.targetJurisdiction} • v{el.version}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">
                    {el.type}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        STATUS_BADGE_STYLES[el.status] ||
                        'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {el.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {el.pollingStartDate}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/eci/elections/${el.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-900"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Details
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total}{' '}
              total)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-slate-300 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded-lg border border-slate-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
