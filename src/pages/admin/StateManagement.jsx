import React, { useState, useMemo } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import SearchBar from '../../components/common/SearchBar';
import { CONSTITUENCY_TYPES } from '../../utils/constants';

export default function StateManagement() {
  const { states, districts, constituencies, upsertState } = useElection();
  const { notifySuccess } = useNotification();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [editingState, setEditingState] = useState(null);

  const filteredStates = useMemo(() => {
    return states.filter((st) => {
      if (typeFilter !== 'ALL' && st.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          st.stateName.toLowerCase().includes(q) ||
          st.stateId.toLowerCase().includes(q) ||
          st.capital.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [states, typeFilter, search]);

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingState) return;
    upsertState(editingState);
    notifySuccess(`Updated State/UT record for ${editingState.stateName}`);
    setEditingState(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Pan-India Constitutional Hierarchy
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            States &amp; Union Territories Directory ({states.length})
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            All 28 States and 8 Union Territories with official Lok Sabha (PC) and
            Legislative Assembly (AC) seat allocations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search state, code, or capital..."
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">All ({states.length})</option>
            <option value="STATE">States (28)</option>
            <option value="UT">Union Territories (8)</option>
          </select>
        </div>
      </div>

      {editingState && (
        <form
          onSubmit={handleSaveEdit}
          className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#002868]">
              Edit State / UT Metadata: {editingState.stateName} ({editingState.stateId})
            </h2>
            <button
              type="button"
              onClick={() => setEditingState(null)}
              className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Name
              </label>
              <input
                type="text"
                required
                value={editingState.stateName}
                onChange={(e) =>
                  setEditingState({ ...editingState, stateName: e.target.value })
                }
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Capital
              </label>
              <input
                type="text"
                required
                value={editingState.capital}
                onChange={(e) =>
                  setEditingState({ ...editingState, capital: e.target.value })
                }
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Lok Sabha Seats
              </label>
              <input
                type="number"
                required
                value={editingState.totalLokSabhaSeats}
                onChange={(e) =>
                  setEditingState({
                    ...editingState,
                    totalLokSabhaSeats: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Assembly Seats
              </label>
              <input
                type="number"
                required
                value={editingState.totalAssemblySeats}
                onChange={(e) =>
                  setEditingState({
                    ...editingState,
                    totalAssemblySeats: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-[#002868] text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Save State Changes
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">State / Union Territory</th>
                <th className="py-3 px-4">Type &amp; Region</th>
                <th className="py-3 px-4">Official Seats (PC / AC)</th>
                <th className="py-3 px-4">Loaded Demo Hierarchy</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStates.map((st) => {
                const dCount = districts.filter((d) => d.stateId === st.stateId).length;
                const pcCount = constituencies.filter(
                  (c) =>
                    c.stateId === st.stateId &&
                    c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
                ).length;
                const acCount = constituencies.filter(
                  (c) =>
                    c.stateId === st.stateId &&
                    c.constituencyType === CONSTITUENCY_TYPES.ASSEMBLY
                ).length;

                return (
                  <tr key={st.stateId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-[#002868]">
                      {st.stateId}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{st.stateName}</p>
                      <span className="text-[11px] text-slate-500">
                        Capital: {st.capital}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          st.type === 'UT'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-blue-100 text-blue-900'
                        }`}
                      >
                        {st.type}
                      </span>{' '}
                      <span className="text-slate-500">• {st.region}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-indigo-900">
                        {st.totalLokSabhaSeats} PC
                      </span>{' '}
                      /{' '}
                      <span className="font-bold text-teal-900">
                        {st.totalAssemblySeats} AC
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {dCount} Districts • {pcCount} PCs • {acCount} ACs
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingState(st)}
                        className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                      >
                        Edit
                      </button>
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
