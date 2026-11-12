import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../services/apiClient';
import {
  ADMIN_PERMISSION_KEYS,
  hasAdminPermission,
} from '../../services/adminPermissionService';
import Modal from '../common/Modal';
import {
  Users,
  FileCheck2,
  PlusCircle,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
} from 'lucide-react';

export default function BackendCandidateNominationManager() {
  const { currentAdmin, csrfToken } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const canCreateCand = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.CANDIDATES_CREATE
  );
  const canDeactivateCand = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.CANDIDATES_DEACTIVATE
  );
  const canCreateNom = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_CREATE
  );
  const canSubmitNom = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_SUBMIT
  );
  const canReviewNom = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_REVIEW
  );
  const canApproveNom = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_APPROVE
  );
  const canRejectNom = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_REJECT
  );
  const canWithdrawNom = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.NOMINATIONS_WITHDRAW
  );

  const [tab, setTab] = useState('nominations');
  const [candidates, setCandidates] = useState([]);
  const [parties, setParties] = useState([]);
  const [elections, setElections] = useState([]);
  const [constituencies, setConstituencies] = useState([]);
  const [nominations, setNominations] = useState([]);
  const [nomStatusFilter, setNomStatusFilter] = useState('');
  const [candSearch, setCandSearch] = useState('');

  // Candidate create form
  const [showCandForm, setShowCandForm] = useState(false);
  const [candForm, setCandForm] = useState({
    id: '',
    fullName: '',
    partyId: 'PARTY-IND',
    age: 35,
    gender: 'Female',
    education: 'Graduate',
    profession: 'Social Worker',
    bio: '',
  });

  // Nomination create form
  const [showNomForm, setShowNomForm] = useState(false);
  const [nomForm, setNomForm] = useState({
    electionId: '',
    constituencyId: '',
    candidateId: '',
    isIndependent: false,
    partyId: 'PARTY-AITC',
    scrutinyNote: '',
  });

  // Modals for Reject / Withdraw / History
  const [reasonModal, setReasonModal] = useState(null); // { mode: 'reject' | 'withdraw', nom }
  const [reasonText, setReasonText] = useState('');
  const [historyNom, setHistoryNom] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const [cRes, pRes, eRes, nRes] = await Promise.all([
        apiClient.admin.candidates.list({
          page: 1,
          limit: 50,
          ...(candSearch.trim() ? { search: candSearch.trim() } : {}),
        }),
        apiClient.admin.parties.list({ page: 1, limit: 50 }),
        apiClient.admin.elections.list({ page: 1, limit: 50 }),
        apiClient.admin.nominations.list({
          page: 1,
          limit: 50,
          ...(nomStatusFilter ? { status: nomStatusFilter } : {}),
        }),
      ]);
      setCandidates(cRes?.data || []);
      setParties(pRes?.data || []);
      setElections(eRes?.data || []);
      setNominations(nRes?.data || []);
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to load data.');
    }
  }, [candSearch, nomStatusFilter, notifyError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!nomForm.electionId) {
      setConstituencies([]);
      return;
    }
    apiClient.elections
      .listConstituencies(nomForm.electionId, { page: 1, limit: 100 })
      .then((res) => setConstituencies(res?.data || []))
      .catch(() => setConstituencies([]));
  }, [nomForm.electionId]);

  const handleCreateCandidate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.admin.candidates.create(
        {
          id: candForm.id.trim().toUpperCase(),
          fullName: candForm.fullName.trim(),
          partyId: candForm.partyId,
          age: Number(candForm.age),
          gender: candForm.gender,
          education: candForm.education,
          profession: candForm.profession,
          bio: candForm.bio.trim(),
        },
        csrfToken
      );
      notifySuccess(`Candidate '${candForm.id.toUpperCase()}' created.`);
      setShowCandForm(false);
      await loadData();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Candidate creation failed.');
    }
  };

  const handleDeactivateCandidate = async (candidateId) => {
    try {
      await apiClient.admin.candidates.deactivate(
        candidateId,
        { reason: 'Deactivated via Admin Console.' },
        csrfToken
      );
      notifySuccess(`Candidate '${candidateId}' deactivated.`);
      await loadData();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Deactivation failed.');
    }
  };

  const handleCreateNomination = async (e) => {
    e.preventDefault();
    const selectedEl = elections.find((el) => el.id === nomForm.electionId);
    if (!selectedEl) return;
    const isLokSabha = selectedEl.type === 'LOK_SABHA';
    try {
      await apiClient.admin.nominations.create(
        {
          electionId: nomForm.electionId,
          candidateId: nomForm.candidateId,
          constituencyType: isLokSabha ? 'PARLIAMENTARY' : 'ASSEMBLY',
          parliamentaryConstituencyId: isLokSabha
            ? nomForm.constituencyId
            : null,
          assemblyConstituencyId: isLokSabha ? null : nomForm.constituencyId,
          isIndependent: nomForm.isIndependent,
          partyId: nomForm.isIndependent ? null : nomForm.partyId,
          scrutinyNote: nomForm.scrutinyNote.trim(),
        },
        csrfToken
      );
      notifySuccess('Draft nomination created.');
      setShowNomForm(false);
      await loadData();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Nomination creation failed.');
    }
  };

  const runAction = async (actionFn, nomId, label) => {
    try {
      await actionFn(nomId, {}, csrfToken);
      notifySuccess(label);
      await loadData();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Action failed.');
    }
  };

  const handleReasonSubmit = async (e) => {
    e.preventDefault();
    if (!reasonModal) return;
    try {
      if (reasonModal.mode === 'reject') {
        await apiClient.admin.nominations.reject(
          reasonModal.nom.id,
          { reason: reasonText.trim(), expectedVersion: reasonModal.nom.version },
          csrfToken
        );
        notifySuccess('Nomination rejected.');
      } else {
        await apiClient.admin.nominations.withdraw(
          reasonModal.nom.id,
          { reason: reasonText.trim(), expectedVersion: reasonModal.nom.version },
          csrfToken
        );
        notifySuccess('Nomination withdrawn.');
      }
      setReasonModal(null);
      setReasonText('');
      await loadData();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Action failed.');
    }
  };

  const openHistory = async (nom) => {
    try {
      const res = await apiClient.admin.nominations.history(nom.id, {
        page: 1,
        limit: 50,
      });
      setHistoryNom(nom);
      setHistoryRows(res?.data || []);
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Unable to load history.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Phase 8.6 • Candidate &amp; Nomination Lifecycle (DEMO_SAMPLE)
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Candidates &amp; Nominations Console
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Independent Lok Sabha &amp; Assembly nominations with historical party
            snapshots, scrutiny workflow, and separation of duties.
          </p>
        </div>

        <div className="flex gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab('nominations')}
            className={`px-4 py-2 rounded-xl ${
              tab === 'nominations'
                ? 'bg-[#002868] text-white'
                : 'bg-slate-100 text-slate-800'
            }`}
          >
            <FileCheck2 className="w-4 h-4 inline mr-1" />
            Nominations ({nominations.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('candidates')}
            className={`px-4 py-2 rounded-xl ${
              tab === 'candidates'
                ? 'bg-[#002868] text-white'
                : 'bg-slate-100 text-slate-800'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1" />
            Candidates ({candidates.length})
          </button>
        </div>
      </div>

      {tab === 'nominations' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 p-4 text-xs">
            <select
              value={nomStatusFilter}
              onChange={(e) => setNomStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300"
            >
              <option value="">All Nomination Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="WITHDRAWN">WITHDRAWN</option>
            </select>
            {canCreateNom && (
              <button
                type="button"
                onClick={() => setShowNomForm((p) => !p)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#002868] text-white font-bold"
              >
                <PlusCircle className="w-4 h-4" />
                {showNomForm ? 'Close Form' : 'Create Draft Nomination'}
              </button>
            )}
          </div>

          {showNomForm && canCreateNom && (
            <form
              onSubmit={handleCreateNomination}
              className="bg-white rounded-2xl border border-slate-200 p-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Election *
                </label>
                <select
                  required
                  value={nomForm.electionId}
                  onChange={(e) =>
                    setNomForm({
                      ...nomForm,
                      electionId: e.target.value,
                      constituencyId: '',
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="">Select election...</option>
                  {elections.map((el) => (
                    <option key={el.id} value={el.id}>
                      {el.id} ({el.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Compatible Constituency *
                </label>
                <select
                  required
                  value={nomForm.constituencyId}
                  onChange={(e) =>
                    setNomForm({ ...nomForm, constituencyId: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="">Select mapped constituency...</option>
                  {constituencies.map((c) => {
                    const cid =
                      c.parliamentaryConstituencyId || c.assemblyConstituencyId;
                    return (
                      <option key={c.id} value={cid}>
                        {c.constituency?.name || cid} ({cid})
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Active Candidate *
                </label>
                <select
                  required
                  value={nomForm.candidateId}
                  onChange={(e) =>
                    setNomForm({ ...nomForm, candidateId: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="">Select candidate...</option>
                  {candidates
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.id})
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="nom-ind"
                  checked={nomForm.isIndependent}
                  onChange={(e) =>
                    setNomForm({ ...nomForm, isIndependent: e.target.checked })
                  }
                />
                <label htmlFor="nom-ind" className="font-bold text-slate-800">
                  Independent Candidate (No Party)
                </label>
              </div>
              {!nomForm.isIndependent && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Sponsoring Party *
                  </label>
                  <select
                    required
                    value={nomForm.partyId}
                    onChange={(e) =>
                      setNomForm({ ...nomForm, partyId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  >
                    {parties
                      .filter((p) => p.status === 'ACTIVE')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.abbreviation})
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="md:col-span-3">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#002868] text-white font-bold"
                >
                  Save Draft Nomination
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Candidate &amp; Party Snapshot</th>
                  <th className="px-4 py-3">Election &amp; Constituency</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nominations.map((n) => (
                  <tr key={n.id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">
                        {n.candidate?.fullName || n.candidateId}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {n.isIndependent
                          ? 'Independent'
                          : n.partySnapshot?.abbreviation || n.partyId}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{n.electionId}</p>
                      <p className="text-[11px] text-slate-500">
                        {n.constituency?.name ||
                          n.parliamentaryConstituencyId ||
                          n.assemblyConstituencyId}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-bold">{n.status}</td>
                    <td className="px-4 py-3 text-right space-x-1.5">
                      {n.status === 'DRAFT' && canSubmitNom && (
                        <button
                          type="button"
                          onClick={() =>
                            runAction(
                              apiClient.admin.nominations.submit,
                              n.id,
                              'Nomination submitted.'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-900 font-bold"
                        >
                          Submit
                        </button>
                      )}
                      {n.status === 'SUBMITTED' && canReviewNom && (
                        <button
                          type="button"
                          onClick={() =>
                            runAction(
                              apiClient.admin.nominations.review,
                              n.id,
                              'Scrutiny review started.'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-900 font-bold"
                        >
                          Review
                        </button>
                      )}
                      {n.status === 'UNDER_REVIEW' && canApproveNom && (
                        <button
                          type="button"
                          onClick={() =>
                            runAction(
                              apiClient.admin.nominations.approve,
                              n.id,
                              'Nomination approved.'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 font-bold inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                      )}
                      {n.status === 'UNDER_REVIEW' && canRejectNom && (
                        <button
                          type="button"
                          onClick={() => {
                            setReasonModal({ mode: 'reject', nom: n });
                            setReasonText('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-red-50 text-red-900 font-bold inline-flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      )}
                      {['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(
                        n.status
                      ) &&
                        canWithdrawNom && (
                          <button
                            type="button"
                            onClick={() => {
                              setReasonModal({ mode: 'withdraw', nom: n });
                              setReasonText('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 font-bold"
                          >
                            Withdraw
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={() => openHistory(n)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 font-bold inline-flex items-center gap-1"
                      >
                        <Clock className="w-3.5 h-3.5" /> History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200 p-4 text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                value={candSearch}
                onChange={(e) => setCandSearch(e.target.value)}
                placeholder="Search candidates by name or ID..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            {canCreateCand && (
              <button
                type="button"
                onClick={() => setShowCandForm((p) => !p)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#002868] text-white font-bold"
              >
                <PlusCircle className="w-4 h-4" />
                {showCandForm ? 'Close Form' : 'Create Candidate Profile'}
              </button>
            )}
          </div>

          {showCandForm && canCreateCand && (
            <form
              onSubmit={handleCreateCandidate}
              className="bg-white rounded-2xl border border-slate-200 p-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs"
            >
              <input
                required
                placeholder="CAND-DEMO-001"
                value={candForm.id}
                onChange={(e) => setCandForm({ ...candForm, id: e.target.value })}
                className="px-3 py-2 rounded-xl border border-slate-300 font-mono uppercase"
              />
              <input
                required
                placeholder="Full Name"
                value={candForm.fullName}
                onChange={(e) =>
                  setCandForm({ ...candForm, fullName: e.target.value })
                }
                className="px-3 py-2 rounded-xl border border-slate-300"
              />
              <select
                value={candForm.partyId}
                onChange={(e) =>
                  setCandForm({ ...candForm, partyId: e.target.value })
                }
                className="px-3 py-2 rounded-xl border border-slate-300"
              >
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.abbreviation})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#002868] text-white font-bold"
              >
                Save Candidate
              </button>
            </form>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Current Party</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{c.fullName}</p>
                      <p className="font-mono text-[11px] text-slate-500">{c.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      {c.party ? `${c.party.name} (${c.party.abbreviation})` : c.partyId}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {c.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.isActive && canDeactivateCand && (
                        <button
                          type="button"
                          onClick={() => handleDeactivateCandidate(c.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-900 font-bold"
                        >
                          <Ban className="w-3.5 h-3.5" /> Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={Boolean(reasonModal)}
        onClose={() => setReasonModal(null)}
        title={
          reasonModal?.mode === 'reject'
            ? 'Reject Nomination (Reason Required)'
            : 'Withdraw Nomination (Reason Required)'
        }
      >
        <form onSubmit={handleReasonSubmit} className="space-y-4 text-xs">
          <textarea
            required
            minLength={5}
            rows={3}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Enter formal administrative reason (min 5 characters)..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReasonModal(null)}
              className="px-4 py-2 rounded-xl bg-slate-100 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-red-700 text-white font-bold"
            >
              Confirm
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(historyNom)}
        onClose={() => setHistoryNom(null)}
        title={`Nomination History: ${historyNom?.candidate?.fullName || ''}`}
      >
        <div className="space-y-2 text-xs">
          {historyRows.length === 0 ? (
            <p className="text-slate-500">No lifecycle events recorded yet.</p>
          ) : (
            historyRows.map((h) => (
              <div
                key={h.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                <p className="font-bold text-slate-900">
                  {h.action} • {h.fromStatus} → {h.toStatus}
                </p>
                {h.note && <p className="text-slate-700">{h.note}</p>}
                <p className="text-[11px] text-slate-500">
                  {new Date(h.changedAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
