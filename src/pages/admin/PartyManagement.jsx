import React, { useState, useMemo } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import SearchBar from '../../components/common/SearchBar';
import BackendPartyManager from '../../components/admin/BackendPartyManager';
import { frontendEnv } from '../../config/env';
import { PARTY_SYMBOL_OPTIONS } from '../../assets';
import { Archive, Trash2, Edit3 } from 'lucide-react';

export default function PartyManagement() {
  if (frontendEnv.isBackendApi) {
    return <BackendPartyManager />;
  }

  return <LocalDemoPartyManagement />;
}

function LocalDemoPartyManagement() {
  const { parties, candidates, upsertParty, deleteParty } = useElection();
  const { currentAdmin, canPerformAdminAction } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [form, setForm] = useState({
    partyId: '',
    partyName: '',
    abbreviation: '',
    partyType: 'STATE',
    symbolName: PARTY_SYMBOL_OPTIONS[0].name,
    symbolUrl: PARTY_SYMBOL_OPTIONS[0].src,
    status: 'ACTIVE',
    description: '',
  });

  const filteredParties = useMemo(() => {
    return parties.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.partyName.toLowerCase().includes(q) ||
          p.abbreviation.toLowerCase().includes(q) ||
          p.partyId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [parties, statusFilter, search]);

  const handleSymbolChange = (symbolLabel) => {
    const found =
      PARTY_SYMBOL_OPTIONS.find((s) => s.label === symbolLabel) ||
      PARTY_SYMBOL_OPTIONS[0];
    setForm((prev) => ({
      ...prev,
      symbolName: found.name,
      symbolUrl: found.src,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const perm = canPerformAdminAction('MANAGE_PARTY');
    if (!perm.allowed) {
      notifyError(perm.reason);
      return;
    }

    if (!form.partyName.trim() || !form.abbreviation.trim()) {
      notifyError('Party Name and Abbreviation are required.');
      return;
    }

    const saved = upsertParty(
      {
        ...form,
        partyId:
          form.partyId ||
          `PARTY-${form.abbreviation.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
        isActive: form.status === 'ACTIVE',
      },
      currentAdmin
    );

    notifySuccess(
      `Saved political party: ${saved.partyName} (${saved.abbreviation})`
    );
    setForm({
      partyId: '',
      partyName: '',
      abbreviation: '',
      partyType: 'STATE',
      symbolName: PARTY_SYMBOL_OPTIONS[0].name,
      symbolUrl: PARTY_SYMBOL_OPTIONS[0].src,
      status: 'ACTIVE',
      description: '',
    });
  };

  const handleChangeStatus = (party, nextStatus) => {
    const perm = canPerformAdminAction('MANAGE_PARTY');
    if (!perm.allowed) {
      notifyError(perm.reason);
      return;
    }
    upsertParty(
      { ...party, status: nextStatus, isActive: nextStatus === 'ACTIVE' },
      currentAdmin
    );
    notifySuccess(`${party.partyName} status changed to ${nextStatus}`);
  };

  const handleDeleteParty = (party) => {
    const res = deleteParty(party.partyId, currentAdmin);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySuccess(`Deleted unreferenced political party: ${party.partyName}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Election Symbols &amp; Party Registry
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              Political Parties Management ({parties.length})
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Manage National, State, Unrecognised, and Independent political party records and official symbols. Parties referenced by candidates cannot be deleted and must be archived instead.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search party name or code..."
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-slate-200 items-end"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Party Name *
            </label>
            <input
              type="text"
              required
              value={form.partyName}
              onChange={(e) => setForm({ ...form, partyName: e.target.value })}
              placeholder="e.g. Bharatiya Pragati Dal"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Abbreviation *
            </label>
            <input
              type="text"
              required
              value={form.abbreviation}
              onChange={(e) =>
                setForm({ ...form, abbreviation: e.target.value.toUpperCase() })
              }
              placeholder="e.g. BPD"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Recognition Type
            </label>
            <select
              value={form.partyType}
              onChange={(e) => setForm({ ...form, partyType: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="NATIONAL">NATIONAL</option>
              <option value="STATE">STATE</option>
              <option value="UNRECOGNISED">UNRECOGNISED</option>
              <option value="INDEPENDENT">INDEPENDENT</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Allocated Symbol Asset
            </label>
            <select
              onChange={(e) => handleSymbolChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {PARTY_SYMBOL_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.label}>
                  {opt.label} — {opt.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            {form.partyId ? 'Update Party' : '+ Register Party'}
          </button>
        </form>
      </div>

      {/* Parties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredParties.map((party) => {
          const refCandidates = candidates.filter(
            (c) => c.partyId === party.partyId
          );

          return (
            <div
              key={party.partyId}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={party.symbolUrl}
                  alt={party.abbreviation}
                  className="w-14 h-14 rounded-xl object-contain border border-slate-200 p-1.5 bg-slate-50 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-[#002868] text-[10px] font-bold">
                      {party.partyType}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        party.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : party.status === 'ARCHIVED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {party.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1 truncate">
                    {party.partyName} ({party.abbreviation})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Symbol: {party.symbolName} •{' '}
                    <strong>{refCandidates.length}</strong> Candidate(s)
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setForm(party)}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleChangeStatus(
                      party,
                      party.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                    )
                  }
                  className="px-2.5 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-700 cursor-pointer"
                >
                  {party.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleChangeStatus(party, 'ARCHIVED')}
                    title="Archive Party"
                    className="flex-1 inline-flex items-center justify-center p-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteParty(party)}
                    title={
                      refCandidates.length > 0
                        ? 'Referenced by candidates (Delete blocked)'
                        : 'Delete Unreferenced Party'
                    }
                    className="flex-1 inline-flex items-center justify-center p-1 rounded bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
