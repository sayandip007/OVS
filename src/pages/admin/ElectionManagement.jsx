import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import SearchBar from '../../components/common/SearchBar';
import Modal from '../../components/common/Modal';
import {
  ELECTION_TYPES,
  ELECTION_STATUS_LABELS,
  CONSTITUENCY_TYPES,
} from '../../utils/constants';
import { VALID_ELECTION_TRANSITIONS } from '../../services/adminPermissionService';
import {
  Copy,
  Archive,
  XCircle,
  Eye,
  Edit3,
  ArrowLeft,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export default function ElectionManagement() {
  const { id: routeElectionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    elections = [],
    states = [],
    constituencies = [],
    candidates = [],
    participationRecords = [],
    createElection,
    updateElection,
    transitionElectionStatus,
    duplicateElectionAsDraft,
    demoLifecycleMode,
  } = useElection();
  const { currentAdmin, canPerformAdminAction } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editingElectionId, setEditingElectionId] = useState(null);
  const [cancelModalElection, setCancelModalElection] = useState(null);

  const initialFormState = {
    id: '',
    title: '',
    electionType: ELECTION_TYPES.STATE_ASSEMBLY,
    stateId: currentAdmin?.assignedStateId || 'WB',
    announcementDate: '2029-03-01',
    nominationStartDate: '2029-03-10',
    nominationEndDate: '2029-03-25',
    scrutinyDate: '2029-03-27',
    withdrawalDeadline: '2029-03-30',
    pollingDate: '2029-04-20',
    countingDate: '2029-05-20',
    resultDate: '2029-05-22',
    status: 'DRAFT',
    description: '',
  };

  const [form, setForm] = useState(initialFormState);

  const inspectedElection = useMemo(() => {
    if (!routeElectionId) return null;
    return elections.find((e) => e.electionId === routeElectionId) || null;
  }, [elections, routeElectionId]);

  useEffect(() => {
    if (location.pathname === '/eci/elections/create') {
      setEditingElectionId(null);
      setForm({
        ...initialFormState,
        stateId: currentAdmin?.assignedStateId || 'WB',
      });
    }
  }, [location.pathname, currentAdmin]);

  const applicableConstituencies = useMemo(() => {
    if (form.electionType === ELECTION_TYPES.LOK_SABHA) {
      return constituencies.filter(
        (c) => c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
      );
    }
    return constituencies.filter(
      (c) =>
        c.constituencyType === CONSTITUENCY_TYPES.ASSEMBLY &&
        c.stateId === form.stateId
    );
  }, [constituencies, form.electionType, form.stateId]);

  const filteredElections = useMemo(() => {
    return elections.filter((el) => {
      if (typeFilter !== 'ALL' && el.electionType !== typeFilter) return false;
      if (statusFilter !== 'ALL' && el.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          el.title.toLowerCase().includes(q) ||
          el.electionId.toLowerCase().includes(q) ||
          (el.stateId || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [elections, typeFilter, statusFilter, search]);

  const resetForm = () => {
    setEditingElectionId(null);
    setForm({
      ...initialFormState,
      stateId: currentAdmin?.assignedStateId || 'WB',
    });
    if (location.pathname === '/eci/elections/create') {
      navigate('/eci/elections');
    }
  };

  const handleEdit = (el) => {
    const check = canPerformAdminAction('EDIT_ELECTION', {
      stateId: el.stateId,
      electionType: el.electionType,
      electionId: el.electionId,
    });
    if (!check.allowed) {
      notifyError(check.reason);
      return;
    }
    setEditingElectionId(el.electionId);
    setForm({
      id: el.electionId,
      title: el.title,
      electionType: el.electionType,
      stateId: el.stateId || 'WB',
      announcementDate: el.announcementDate || '2029-03-01',
      nominationStartDate: el.nominationStartDate || '2029-03-10',
      nominationEndDate: el.nominationEndDate || '2029-03-25',
      scrutinyDate: el.scrutinyDate || '2029-03-27',
      withdrawalDeadline: el.withdrawalDeadline || '2029-03-30',
      pollingDate: el.pollingDate || '2029-04-20',
      countingDate: el.countingDate || '2029-05-20',
      resultDate: el.resultDate || '2029-05-22',
      status: el.status,
      description: el.description || '',
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const targetScope = {
      stateId: form.electionType === ELECTION_TYPES.LOK_SABHA ? null : form.stateId,
      electionType: form.electionType,
      electionId: editingElectionId || form.id,
    };

    const perm = canPerformAdminAction(
      editingElectionId ? 'EDIT_ELECTION' : 'CREATE_ELECTION',
      targetScope
    );
    if (!perm.allowed) {
      notifyError(perm.reason);
      return;
    }

    const payload = {
      ...form,
      id: form.id.trim() || undefined,
      stateId:
        form.electionType === ELECTION_TYPES.LOK_SABHA ? null : form.stateId,
      constituencyType:
        form.electionType === ELECTION_TYPES.LOK_SABHA
          ? CONSTITUENCY_TYPES.PARLIAMENTARY
          : CONSTITUENCY_TYPES.ASSEMBLY,
      constituencyIds: applicableConstituencies.map((c) => c.constituencyId),
    };

    if (editingElectionId) {
      const res = updateElection(editingElectionId, payload, currentAdmin);
      if (!res.ok) {
        notifyError(res.errors?.[0] || 'Failed to update election.');
        return;
      }
      notifySuccess(`Updated election: ${res.election.title}`);
      resetForm();
    } else {
      const res = createElection(payload, currentAdmin);
      if (!res.ok) {
        notifyError(res.errors?.[0] || 'Failed to create election.');
        return;
      }
      notifySuccess(
        `Created new election: ${res.election.title} (${res.election.electionId})`
      );
      resetForm();
    }
  };

  const handleStatusTransition = (el, targetStatus) => {
    if (targetStatus === 'CANCELLED') {
      setCancelModalElection(el);
      return;
    }
    const res = transitionElectionStatus(el.electionId, targetStatus, {
      currentAdmin,
      demoLifecycleMode,
    });
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(
      `Election ${el.electionId} transitioned from ${el.status} to ${targetStatus}.`
    );
  };

  const handleConfirmCancel = () => {
    if (!cancelModalElection) return;
    const res = transitionElectionStatus(
      cancelModalElection.electionId,
      'CANCELLED',
      {
        currentAdmin,
        demoLifecycleMode,
        confirmCancellation: true,
      }
    );
    setCancelModalElection(null);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(`Election ${cancelModalElection.electionId} has been cancelled.`);
  };

  const handleDuplicate = (el) => {
    const res = duplicateElectionAsDraft(el.electionId, currentAdmin);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(
      `Duplicated as draft: ${res.election.title} (${res.election.electionId})`
    );
  };

  // Single Election Detail View (/eci/elections/:id)
  if (routeElectionId && inspectedElection) {
    const elCandidates = candidates.filter(
      (c) => c.electionId === inspectedElection.electionId
    );
    const elVotes = participationRecords.filter(
      (r) => r.electionId === inspectedElection.electionId && r.status === 'VOTED'
    );
    const allowedTransitions = demoLifecycleMode
      ? Object.keys(ELECTION_STATUS_LABELS).filter(
          (s) => s !== inspectedElection.status
        )
      : VALID_ELECTION_TRANSITIONS[inspectedElection.status] || [];

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/eci/elections"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#002868] hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to All Elections
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDuplicate(inspectedElection)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicate as Draft
              </button>
              <Link
                to="/eci/schedules"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#002868] text-white text-xs font-bold"
              >
                <Clock className="w-3.5 h-3.5" />
                Manage Schedule
              </Link>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800">
                  {inspectedElection.electionId}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                    inspectedElection.electionType === ELECTION_TYPES.LOK_SABHA
                      ? 'bg-indigo-100 text-indigo-900'
                      : 'bg-teal-100 text-teal-900'
                  }`}
                >
                  {inspectedElection.electionType}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  {ELECTION_STATUS_LABELS[inspectedElection.status] ||
                    inspectedElection.status}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-2">
                {inspectedElection.title}
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                {inspectedElection.description}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span className="text-[11px] font-bold uppercase text-slate-500">
                Available Lifecycle Transitions ({demoLifecycleMode ? 'Flexible Demo' : 'Strict ECI'}):
              </span>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {allowedTransitions.map((nextStatus) => (
                  <button
                    key={nextStatus}
                    type="button"
                    onClick={() => handleStatusTransition(inspectedElection, nextStatus)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                      nextStatus === 'CANCELLED'
                        ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                        : 'bg-blue-50 text-[#002868] border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    &rarr; {ELECTION_STATUS_LABELS[nextStatus] || nextStatus}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 8 Schedule Milestones */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-4 border-t border-slate-100">
            {[
              { label: 'Announcement', val: inspectedElection.announcementDate },
              { label: 'Nomination Start', val: inspectedElection.nominationStartDate },
              { label: 'Nomination End', val: inspectedElection.nominationEndDate },
              { label: 'Scrutiny Date', val: inspectedElection.scrutinyDate || '—' },
              { label: 'Withdrawal', val: inspectedElection.withdrawalDeadline || '—' },
              { label: 'Polling Date', val: inspectedElection.pollingDate },
              { label: 'Counting Date', val: inspectedElection.countingDate || '—' },
              { label: 'Result Date', val: inspectedElection.resultDate },
            ].map((m) => (
              <div
                key={m.label}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200"
              >
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  {m.label}
                </p>
                <p className="text-xs font-mono font-bold text-slate-900 mt-1">
                  {m.val || '—'}
                </p>
              </div>
            ))}
          </div>

          {/* Summary Metrics & Lifecycle History */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="text-xs font-extrabold uppercase text-slate-700">
                Scope &amp; Participation Summary
              </h3>
              <p className="text-xs text-slate-700">
                Assigned Constituencies ({inspectedElection.constituencyType}):{' '}
                <strong>{inspectedElection.constituencyIds?.length || 0}</strong>
              </p>
              <p className="text-xs text-slate-700">
                Contesting Candidates: <strong>{elCandidates.length}</strong> (
                {elCandidates.filter((c) => c.status === 'APPROVED').length} Approved)
              </p>
              <p className="text-xs text-slate-700">
                Aggregate Demo Votes Cast: <strong>{elVotes.length}</strong>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="text-xs font-extrabold uppercase text-slate-700">
                Lifecycle Audit History
              </h3>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {(inspectedElection.lifecycleHistory || []).map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded border border-slate-200"
                  >
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {entry.status}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {entry.changedBy} • {new Date(entry.changedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              ECI Election Lifecycle &amp; Configuration
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              {editingElectionId
                ? `Edit Election (${editingElectionId})`
                : 'Election Configuration & Lifecycle Management'}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Create, duplicate, archive, or transition Lok Sabha General Elections and State Legislative Assembly Elections across all 11 lifecycle states.
            </p>
          </div>
          <div className="text-xs bg-blue-50 text-[#002868] px-3 py-1.5 rounded-lg border border-blue-200 font-semibold">
            Assigned Constituencies Preview: <strong>{applicableConstituencies.length}</strong>{' '}
            ({form.electionType === ELECTION_TYPES.LOK_SABHA ? 'PCs' : 'ACs'})
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 pt-4 border-t border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Custom Election ID (Optional)
              </label>
              <input
                type="text"
                disabled={Boolean(editingElectionId)}
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value.toUpperCase() })}
                placeholder="Auto-generated if blank"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg disabled:bg-slate-100"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Election Title *
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Tamil Nadu Legislative Assembly Election 2029"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Election Type *
              </label>
              <select
                value={form.electionType}
                onChange={(e) => setForm({ ...form, electionType: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value={ELECTION_TYPES.LOK_SABHA}>
                  LOK_SABHA (Nationwide Parliamentary PC)
                </option>
                <option value={ELECTION_TYPES.STATE_ASSEMBLY}>
                  STATE_ASSEMBLY (State Assembly AC)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target State / UT (For State Assembly)
              </label>
              <select
                disabled={form.electionType === ELECTION_TYPES.LOK_SABHA}
                value={
                  form.electionType === ELECTION_TYPES.LOK_SABHA
                    ? 'ALL_INDIA'
                    : form.stateId
                }
                onChange={(e) => setForm({ ...form, stateId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
              >
                {form.electionType === ELECTION_TYPES.LOK_SABHA ? (
                  <option value="ALL_INDIA">
                    All India (28 States &amp; 8 Union Territories)
                  </option>
                ) : (
                  states.map((st) => (
                    <option key={st.stateId} value={st.stateId}>
                      {st.stateName} ({st.stateId})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Dates & Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Nomination Start
              </label>
              <input
                type="date"
                value={form.nominationStartDate}
                onChange={(e) =>
                  setForm({ ...form, nominationStartDate: e.target.value })
                }
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Nomination End
              </label>
              <input
                type="date"
                value={form.nominationEndDate}
                onChange={(e) =>
                  setForm({ ...form, nominationEndDate: e.target.value })
                }
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Scrutiny Date
              </label>
              <input
                type="date"
                value={form.scrutinyDate}
                onChange={(e) => setForm({ ...form, scrutinyDate: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Polling Date *
              </label>
              <input
                type="date"
                required
                value={form.pollingDate}
                onChange={(e) => setForm({ ...form, pollingDate: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Counting Date
              </label>
              <input
                type="date"
                value={form.countingDate}
                onChange={(e) => setForm({ ...form, countingDate: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Result Date
              </label>
              <input
                type="date"
                value={form.resultDate}
                onChange={(e) => setForm({ ...form, resultDate: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Initial Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {Object.entries(ELECTION_STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-8">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Notification Summary
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief summary of the election notification and phases..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-4 flex items-center justify-end gap-2">
              {editingElectionId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
              >
                {editingElectionId ? 'Save Election Updates' : '+ Create Election'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Elections Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">
            Configured Elections ({filteredElections.length})
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search ID, title, state..."
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Types</option>
              <option value={ELECTION_TYPES.LOK_SABHA}>LOK_SABHA</option>
              <option value={ELECTION_TYPES.STATE_ASSEMBLY}>STATE_ASSEMBLY</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(ELECTION_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3 px-3">ID</th>
                <th className="py-3 px-3">Title &amp; Type</th>
                <th className="py-3 px-3">Scope</th>
                <th className="py-3 px-3">Polling Date</th>
                <th className="py-3 px-3">Lifecycle Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredElections.map((el) => {
                const allowedNext = demoLifecycleMode
                  ? Object.keys(ELECTION_STATUS_LABELS)
                  : [
                      el.status,
                      ...(VALID_ELECTION_TRANSITIONS[el.status] || []),
                    ];

                return (
                  <tr key={el.electionId} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      <Link
                        to={`/eci/elections/${el.electionId}`}
                        className="text-[#002868] hover:underline"
                      >
                        {el.electionId}
                      </Link>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{el.title}</p>
                      <span
                        className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                          el.electionType === ELECTION_TYPES.LOK_SABHA
                            ? 'bg-indigo-100 text-indigo-900'
                            : 'bg-teal-100 text-teal-900'
                        }`}
                      >
                        {el.electionType} ({el.constituencyType})
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {el.electionType === ELECTION_TYPES.LOK_SABHA
                        ? 'All India (PCs)'
                        : `State: ${el.stateId} (ACs)`}
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-mono">
                      {el.pollingDate}
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={el.status}
                        onChange={(e) => handleStatusTransition(el, e.target.value)}
                        className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold text-xs"
                      >
                        {Object.entries(ELECTION_STATUS_LABELS).map(([k, label]) => (
                          <option
                            key={k}
                            value={k}
                            disabled={!allowedNext.includes(k)}
                          >
                            {label} {!allowedNext.includes(k) ? '(Locked)' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          to={`/eci/elections/${el.electionId}`}
                          title="Inspect Details & History"
                          className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleEdit(el)}
                          title="Edit Election"
                          className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(el)}
                          title="Duplicate as Draft"
                          className="p-1.5 rounded bg-blue-50 hover:bg-blue-100 text-[#002868] cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {el.status === 'RESULTS_DECLARED' && (
                          <button
                            type="button"
                            onClick={() => handleStatusTransition(el, 'ARCHIVED')}
                            title="Archive Historical Election"
                            className="p-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {el.status !== 'CANCELLED' && el.status !== 'ARCHIVED' && (
                          <button
                            type="button"
                            onClick={() => setCancelModalElection(el)}
                            title="Cancel Election"
                            className="p-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Election Confirmation Modal */}
      <Modal
        isOpen={Boolean(cancelModalElection)}
        onClose={() => setCancelModalElection(null)}
        title="Confirm Election Cancellation"
        subtitle="Critical electoral lifecycle action"
      >
        <div className="space-y-4 text-xs text-slate-600">
          <p>
            Are you sure you want to cancel{' '}
            <strong className="text-slate-900">
              {cancelModalElection?.title} ({cancelModalElection?.electionId})
            </strong>
            ? Once cancelled, voters will no longer be able to access the ballot for this election.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setCancelModalElection(null)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
            >
              Keep Election Active
            </button>
            <button
              type="button"
              onClick={handleConfirmCancel}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 font-bold text-white cursor-pointer"
            >
              Confirm Cancel Election
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
