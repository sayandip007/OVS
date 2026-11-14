import React, { useState, useMemo } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import SearchBar from '../../components/common/SearchBar';
import BackendCandidateNominationManager from '../../components/admin/BackendCandidateNominationManager';
import { frontendEnv } from '../../config/env';
import {
  ELECTION_TYPES,
  CONSTITUENCY_TYPES,
  CANDIDATE_STATUS_LABELS,
} from '../../utils/constants';
import { CANDIDATE_PHOTO_OPTIONS, defaultAvatar, eciLogo } from '../../assets';
import { CheckCircle2, XCircle, PauseCircle, Archive, Edit3 } from 'lucide-react';

export default function CandidateManagement() {
  if (frontendEnv.isBackendApi) {
    return <BackendCandidateNominationManager />;
  }

  return <LocalDemoCandidateManagement />;
}

function LocalDemoCandidateManagement() {
  const {
    elections,
    states,
    districts,
    constituencies,
    parties,
    candidates,
    createCandidate,
    updateCandidate,
    transitionCandidateStatus,
    demoLifecycleMode,
  } = useElection();
  const { currentAdmin, canPerformAdminAction } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [search, setSearch] = useState('');
  const [electionFilter, setElectionFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [partyFilter, setPartyFilter] = useState('ALL');
  const [editingCandidateId, setEditingCandidateId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    age: 38,
    gender: 'Male',
    electionId: 'LS-2029',
    electionType: ELECTION_TYPES.LOK_SABHA,
    stateId: currentAdmin?.assignedStateId || 'WB',
    districtId: 'WB-DIST-NADIA',
    constituencyId: 'WB-PC-KRISHNANAGAR',
    partyId: 'PARTY-BJP',
    photoUrl: CANDIDATE_PHOTO_OPTIONS[0].src,
    education: 'Post Graduate',
    manifestoSummary: '',
    biography: '',
    publicDeclaration: 'No pending criminal cases • Assets & Liabilities declared',
    status: 'APPROVED',
  });

  const availableConstituencies = useMemo(() => {
    if (form.electionType === ELECTION_TYPES.LOK_SABHA) {
      return constituencies.filter(
        (c) =>
          c.stateId === form.stateId &&
          c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
      );
    }
    return constituencies.filter(
      (c) =>
        c.stateId === form.stateId &&
        c.constituencyType === CONSTITUENCY_TYPES.ASSEMBLY
    );
  }, [constituencies, form.electionType, form.stateId]);

  const handleElectionChange = (newElectionId) => {
    const el = elections.find((e) => e.electionId === newElectionId);
    if (!el) return;

    const targetStateId =
      el.electionType === ELECTION_TYPES.STATE_ASSEMBLY
        ? el.stateId
        : form.stateId;

    const targetConstituencyType =
      el.electionType === ELECTION_TYPES.LOK_SABHA
        ? CONSTITUENCY_TYPES.PARLIAMENTARY
        : CONSTITUENCY_TYPES.ASSEMBLY;

    const firstConst = constituencies.find(
      (c) =>
        c.stateId === targetStateId &&
        c.constituencyType === targetConstituencyType
    );
    const firstDist = districts.find((d) => d.stateId === targetStateId);

    setForm((prev) => ({
      ...prev,
      electionId: el.electionId,
      electionType: el.electionType,
      stateId: targetStateId,
      districtId: firstDist?.districtId || '',
      constituencyId: firstConst?.constituencyId || '',
    }));
  };

  const handleStateChange = (newStateId) => {
    const targetConstituencyType =
      form.electionType === ELECTION_TYPES.LOK_SABHA
        ? CONSTITUENCY_TYPES.PARLIAMENTARY
        : CONSTITUENCY_TYPES.ASSEMBLY;
    const firstConst = constituencies.find(
      (c) =>
        c.stateId === newStateId &&
        c.constituencyType === targetConstituencyType
    );
    const firstDist = districts.find((d) => d.stateId === newStateId);

    setForm((prev) => ({
      ...prev,
      stateId: newStateId,
      districtId: firstDist?.districtId || '',
      constituencyId: firstConst?.constituencyId || '',
    }));
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, photoUrl: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const perm = canPerformAdminAction('MANAGE_CANDIDATE', {
      stateId: form.stateId,
      electionId: form.electionId,
      electionType: form.electionType,
    });
    if (!perm.allowed) {
      notifyError(perm.reason);
      return;
    }

    const payload = {
      ...form,
      approvalStatus: form.status,
    };

    if (editingCandidateId) {
      const res = updateCandidate(editingCandidateId, payload, currentAdmin);
      if (!res.ok) {
        notifyError(res.errors?.[0] || 'Failed to update candidate.');
        return;
      }
      notifySuccess(`Updated candidate nomination: ${res.candidate.name}`);
      setEditingCandidateId(null);
    } else {
      const res = createCandidate(payload, currentAdmin);
      if (!res.ok) {
        notifyError(res.errors?.[0] || 'Failed to nominate candidate.');
        return;
      }
      notifySuccess(
        `Nominated ${res.candidate.name} (${res.candidate.status}) for ${res.candidate.constituencyId} in ${res.candidate.electionId}`
      );
    }

    setForm((prev) => ({ ...prev, name: '', manifestoSummary: '', biography: '' }));
  };

  const handleQuickStatusChange = (cand, targetStatus) => {
    const res = transitionCandidateStatus(cand.candidateId, targetStatus, {
      currentAdmin,
      demoLifecycleMode,
    });
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(
      `Candidate ${cand.name} status updated to ${targetStatus}. Ballot & Directory automatically synced.`
    );
  };

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const candStatus = c.status || c.approvalStatus || 'APPROVED';
      if (electionFilter !== 'ALL' && c.electionId !== electionFilter) return false;
      if (stateFilter !== 'ALL' && c.stateId !== stateFilter) return false;
      if (statusFilter !== 'ALL' && candStatus !== statusFilter) return false;
      if (partyFilter !== 'ALL' && c.partyId !== partyFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.constituencyId.toLowerCase().includes(q) ||
          (c.candidateId || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [candidates, electionFilter, stateFilter, statusFilter, partyFilter, search]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Form-2A / Form-2B Candidate Nomination &amp; Scrutiny
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Candidate Nomination &amp; Approval Lifecycle ({candidates.length})
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Assign candidates to a specific Election (Lok Sabha or State Assembly), State, Constituency, and Party. Only <strong>APPROVED</strong> candidates appear on the public Candidate Directory and Phase 4 Voter Ballot.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 pt-4 border-t border-slate-200"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                1. Target Election *
              </label>
              <select
                value={form.electionId}
                onChange={(e) => handleElectionChange(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
              >
                {elections.map((el) => (
                  <option key={el.electionId} value={el.electionId}>
                    {el.title} ({el.electionType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                2. State / UT *
              </label>
              <select
                disabled={form.electionType === ELECTION_TYPES.STATE_ASSEMBLY}
                value={form.stateId}
                onChange={(e) => handleStateChange(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
              >
                {states.map((st) => (
                  <option key={st.stateId} value={st.stateId}>
                    {st.stateName} ({st.stateId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                3.{' '}
                {form.electionType === ELECTION_TYPES.LOK_SABHA
                  ? 'Parliamentary Constituency (PC) *'
                  : 'Assembly Constituency (AC) *'}
              </label>
              <select
                value={form.constituencyId}
                onChange={(e) =>
                  setForm({ ...form, constituencyId: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {availableConstituencies.map((c) => (
                  <option key={c.constituencyId} value={c.constituencyId}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                4. Political Party *
              </label>
              <select
                value={form.partyId}
                onChange={(e) => setForm({ ...form, partyId: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {parties
                  .filter((p) => p.status === 'ACTIVE')
                  .map((p) => (
                    <option key={p.partyId} value={p.partyId}>
                      {p.partyName} ({p.abbreviation})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Candidate Full Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter candidate full name"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Age (Min 25) *
              </label>
              <input
                type="number"
                min={25}
                required
                value={form.age}
                onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Scrutiny Status *
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
              >
                {Object.entries(CANDIDATE_STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Photo URL (Web Link or Local Asset)
              </label>
              <input
                type="text"
                placeholder="https://... or /assets/candidates/..."
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Preset Photo
              </label>
              <select
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Select Preset...</option>
                {CANDIDATE_PHOTO_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.src}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Custom Photo Upload
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="w-full text-[11px] text-slate-600 file:py-1 file:px-2.5 file:rounded file:border-0 file:bg-blue-50 file:text-[#002868] file:font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            <div className="md:col-span-5">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Candidate Manifesto &amp; Affidavit Summary
              </label>
              <input
                type="text"
                value={form.manifestoSummary}
                onChange={(e) =>
                  setForm({ ...form, manifestoSummary: e.target.value })
                }
                placeholder="Key constituency priorities and public service record..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Public Declaration / Form-26 Summary
              </label>
              <input
                type="text"
                value={form.publicDeclaration}
                onChange={(e) =>
                  setForm({ ...form, publicDeclaration: e.target.value })
                }
                placeholder="e.g. Clean affidavit • Assets declared"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-3 flex justify-end gap-2">
              {editingCandidateId && (
                <button
                  type="button"
                  onClick={() => setEditingCandidateId(null)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
              >
                {editingCandidateId ? 'Save Candidate' : '+ Nominate Candidate'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Nominated Candidates Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">
            Nominated Candidates ({filteredCandidates.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search candidate or seat..."
            />
            <select
              value={electionFilter}
              onChange={(e) => setElectionFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Elections</option>
              {elections.map((el) => (
                <option key={el.electionId} value={el.electionId}>
                  {el.title}
                </option>
              ))}
            </select>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All States</option>
              {states.map((st) => (
                <option key={st.stateId} value={st.stateId}>
                  {st.stateName} ({st.stateId})
                </option>
              ))}
            </select>
            <select
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Parties</option>
              {parties.map((p) => (
                <option key={p.partyId} value={p.partyId}>
                  {p.abbreviation}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(CANDIDATE_STATUS_LABELS).map(([k, label]) => (
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
                <th className="py-3 px-3">Candidate</th>
                <th className="py-3 px-3">Party</th>
                <th className="py-3 px-3">Election</th>
                <th className="py-3 px-3">Constituency</th>
                <th className="py-3 px-3">Scrutiny Status</th>
                <th className="py-3 px-3 text-right">Quick Scrutiny &amp; Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCandidates.map((cand) => {
                const party = parties.find((p) => p.partyId === cand.partyId);
                const constObj = constituencies.find(
                  (c) => c.constituencyId === cand.constituencyId
                );
                const candStatus =
                  cand.status || cand.approvalStatus || 'APPROVED';

                return (
                  <tr key={cand.candidateId} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 flex items-center gap-2.5">
                      <img
                        src={cand.photoUrl || cand.photograph || defaultAvatar}
                        alt={cand.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = defaultAvatar;
                        }}
                        className="w-9 h-9 rounded-lg object-cover border border-slate-200"
                      />
                      <div>
                        <p className="font-bold text-slate-900">{cand.name}</p>
                        <span className="text-[11px] text-slate-500">
                          Age: {cand.age} • {cand.gender}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {party?.symbolUrl && (
                          <img
                            src={party.symbolUrl}
                            alt={party.abbreviation}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = eciLogo;
                            }}
                            className="w-5 h-5 object-contain"
                          />
                        )}
                        <span className="font-semibold">
                          {party?.abbreviation || 'IND'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-slate-800">
                        {cand.electionId}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        {cand.electionType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-slate-900">
                        {constObj?.name || cand.constituencyId}
                      </p>
                      <span className="text-[10px] text-slate-500">
                        State: {cand.stateId}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          candStatus === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : candStatus === 'REJECTED' || candStatus === 'SUSPENDED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {CANDIDATE_STATUS_LABELS[candStatus] || candStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {candStatus !== 'APPROVED' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(cand, 'APPROVED')}
                            title="Approve Nomination (Show on Ballot)"
                            className="p-1.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {candStatus !== 'REJECTED' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(cand, 'REJECTED')}
                            title="Reject Nomination"
                            className="p-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {candStatus !== 'SUSPENDED' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(cand, 'SUSPENDED')}
                            title="Suspend Candidate"
                            className="p-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 cursor-pointer"
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {candStatus !== 'ARCHIVED' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(cand, 'ARCHIVED')}
                            title="Archive Candidate"
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCandidateId(cand.candidateId);
                            setForm({
                              name: cand.name,
                              age: cand.age,
                              gender: cand.gender,
                              electionId: cand.electionId,
                              electionType: cand.electionType,
                              stateId: cand.stateId,
                              districtId: cand.districtId,
                              constituencyId: cand.constituencyId,
                              partyId: cand.partyId,
                              photoUrl: cand.photoUrl,
                              education: cand.education || 'Graduate',
                              manifestoSummary: cand.manifestoSummary || '',
                              biography: cand.biography || '',
                              publicDeclaration: cand.publicDeclaration || '',
                              status: candStatus,
                            });
                          }}
                          title="Edit Candidate Details"
                          className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
