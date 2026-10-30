import React, { useState, useMemo } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import SearchBar from '../../components/common/SearchBar';
import {
  ELECTION_TYPES,
  ELECTION_STATUS_LABELS,
  CONSTITUENCY_TYPES,
} from '../../utils/constants';

export default function ElectionManagement() {
  const {
    elections,
    states,
    constituencies,
    createElection,
    updateElection,
    setElectionStatus,
  } = useElection();
  const { notifySuccess, notifyError } = useNotification();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [editingElectionId, setEditingElectionId] = useState(null);

  const [form, setForm] = useState({
    title: '',
    electionType: ELECTION_TYPES.STATE_ASSEMBLY,
    stateId: 'WB',
    announcementDate: '2029-03-01',
    nominationStartDate: '2029-03-10',
    nominationEndDate: '2029-03-25',
    pollingDate: '2029-04-20',
    countingDate: '2029-05-20',
    resultDate: '2029-05-22',
    status: 'POLLING_ACTIVE',
    description: '',
  });

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
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          el.title.toLowerCase().includes(q) ||
          el.electionId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [elections, typeFilter, search]);

  const resetForm = () => {
    setEditingElectionId(null);
    setForm({
      title: '',
      electionType: ELECTION_TYPES.STATE_ASSEMBLY,
      stateId: 'WB',
      announcementDate: '2029-03-01',
      nominationStartDate: '2029-03-10',
      nominationEndDate: '2029-03-25',
      pollingDate: '2029-04-20',
      countingDate: '2029-05-20',
      resultDate: '2029-05-22',
      status: 'POLLING_ACTIVE',
      description: '',
    });
  };

  const handleEdit = (el) => {
    setEditingElectionId(el.electionId);
    setForm({
      title: el.title,
      electionType: el.electionType,
      stateId: el.stateId || 'WB',
      announcementDate: el.announcementDate || '2029-03-01',
      nominationStartDate: el.nominationStartDate || '2029-03-10',
      nominationEndDate: el.nominationEndDate || '2029-03-25',
      pollingDate: el.pollingDate || '2029-04-20',
      countingDate: el.countingDate || '2029-05-20',
      resultDate: el.resultDate || '2029-05-22',
      status: el.status,
      description: el.description || '',
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      stateId:
        form.electionType === ELECTION_TYPES.LOK_SABHA ? null : form.stateId,
      constituencyType:
        form.electionType === ELECTION_TYPES.LOK_SABHA
          ? CONSTITUENCY_TYPES.PARLIAMENTARY
          : CONSTITUENCY_TYPES.ASSEMBLY,
      constituencyIds: applicableConstituencies.map((c) => c.constituencyId),
    };

    if (editingElectionId) {
      const res = updateElection(editingElectionId, payload);
      if (!res.ok) {
        notifyError(res.errors?.[0] || 'Failed to update election.');
        return;
      }
      notifySuccess(`Updated election: ${res.election.title}`);
      resetForm();
    } else {
      const res = createElection(payload);
      if (!res.ok) {
        notifyError(res.errors?.[0] || 'Failed to create election.');
        return;
      }
      notifySuccess(`Created new election: ${res.election.title} (${res.election.electionId})`);
      resetForm();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
          Phase 2 Election Architecture
        </span>
        <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
          Election Configuration &amp; Lifecycle Management
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Create or update Lok Sabha General Elections (nationwide across Parliamentary
          Constituencies) and State Legislative Assembly Elections (state-specific across
          Assembly Constituencies).
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 pt-4 border-t border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                Target State / UT (Required for State Assembly)
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Announcement
              </label>
              <input
                type="date"
                value={form.announcementDate}
                onChange={(e) =>
                  setForm({ ...form, announcementDate: e.target.value })
                }
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
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
                Lifecycle Status
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
          <div className="flex items-center gap-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search election..."
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
              {filteredElections.map((el) => (
                <tr key={el.electionId} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                    {el.electionId}
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
                      ? 'All India'
                      : `State: ${el.stateId}`}
                  </td>
                  <td className="py-3 px-3 text-slate-700">{el.pollingDate}</td>
                  <td className="py-3 px-3">
                    <select
                      value={el.status}
                      onChange={(e) => {
                        setElectionStatus(el.electionId, e.target.value);
                        notifySuccess(
                          `Status for ${el.electionId} updated to ${e.target.value}`
                        );
                      }}
                      className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold text-xs"
                    >
                      {Object.entries(ELECTION_STATUS_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleEdit(el)}
                      className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
