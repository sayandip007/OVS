import React, { useState, useMemo } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import SearchBar from '../../components/common/SearchBar';
import { CONSTITUENCY_TYPES, RESERVATION_TYPES } from '../../utils/constants';

export default function ConstituencyManagement() {
  const {
    states,
    districts,
    constituencies,
    createConstituency,
    updateConstituency,
  } = useElection();
  const { notifySuccess, notifyError } = useNotification();

  const [typeFilter, setTypeFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    constituencyType: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: 'WB',
    districtId: 'WB-DIST-NADIA',
    parentParliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    reservationType: RESERVATION_TYPES.GENERAL,
  });

  const stateDistricts = useMemo(
    () => districts.filter((d) => d.stateId === form.stateId),
    [districts, form.stateId]
  );

  const statePCs = useMemo(
    () =>
      constituencies.filter(
        (c) =>
          c.stateId === form.stateId &&
          c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
      ),
    [constituencies, form.stateId]
  );

  const filteredConstituencies = useMemo(() => {
    return constituencies.filter((c) => {
      if (typeFilter !== 'ALL' && c.constituencyType !== typeFilter) return false;
      if (stateFilter !== 'ALL' && c.stateId !== stateFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.constituencyId.toLowerCase().includes(q) ||
          (c.code || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [constituencies, typeFilter, stateFilter, search]);

  const handleStateChange = (newStateId) => {
    const firstDist = districts.find((d) => d.stateId === newStateId);
    const firstPC = constituencies.find(
      (c) =>
        c.stateId === newStateId &&
        c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
    );
    setForm((prev) => ({
      ...prev,
      stateId: newStateId,
      districtId: firstDist?.districtId || '',
      parentParliamentaryConstituencyId: firstPC?.constituencyId || '',
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      districtIds:
        form.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
          ? stateDistricts.map((d) => d.districtId)
          : [],
    };

    if (editingId) {
      const res = updateConstituency(editingId, payload);
      if (!res.ok) {
        notifyError(res.errors?.[0] || 'Failed to update constituency.');
        return;
      }
      notifySuccess(`Updated constituency: ${res.constituency.name}`);
      setEditingId(null);
    } else {
      const res = createConstituency(payload);
      if (!res.ok) {
        notifyError(res.errors?.[0] || 'Failed to create constituency.');
        return;
      }
      notifySuccess(
        `Created ${res.constituency.constituencyType} constituency: ${res.constituency.name}`
      );
    }

    setForm((prev) => ({ ...prev, name: '', code: '' }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Dual Constituency Architecture
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Parliamentary (PC) &amp; Assembly (AC) Constituencies (
            {constituencies.length})
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Maintain strict separation between Parliamentary Constituencies (Lok Sabha)
            and Assembly Constituencies (Vidhan Sabha).
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-4 border-t border-slate-200 items-end"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Constituency Type *
            </label>
            <select
              value={form.constituencyType}
              onChange={(e) =>
                setForm({ ...form, constituencyType: e.target.value })
              }
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value={CONSTITUENCY_TYPES.PARLIAMENTARY}>
                PARLIAMENTARY (Lok Sabha PC)
              </option>
              <option value={CONSTITUENCY_TYPES.ASSEMBLY}>
                ASSEMBLY (State Assembly AC)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              State / UT *
            </label>
            <select
              value={form.stateId}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
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
              Constituency Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Ranaghat Dakshin"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Official Code
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. WB-AC-090"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          {form.constituencyType === CONSTITUENCY_TYPES.ASSEMBLY ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Parent Parliamentary Seat *
              </label>
              <select
                value={form.parentParliamentaryConstituencyId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    parentParliamentaryConstituencyId: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {statePCs.map((pc) => (
                  <option key={pc.constituencyId} value={pc.constituencyId}>
                    {pc.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reservation Category
              </label>
              <select
                value={form.reservationType}
                onChange={(e) =>
                  setForm({ ...form, reservationType: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="GENERAL">GENERAL</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            className="px-4 py-2 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            {editingId ? 'Save Changes' : '+ Add Constituency'}
          </button>
        </form>
      </div>

      {/* Constituencies Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">
            Constituencies Directory ({filteredConstituencies.length})
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search seat name or code..."
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Types</option>
              <option value={CONSTITUENCY_TYPES.PARLIAMENTARY}>
                PARLIAMENTARY (PC)
              </option>
              <option value={CONSTITUENCY_TYPES.ASSEMBLY}>ASSEMBLY (AC)</option>
            </select>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All States &amp; UTs</option>
              {states.map((st) => (
                <option key={st.stateId} value={st.stateId}>
                  {st.stateName} ({st.stateId})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[540px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3 px-3">Constituency ID</th>
                <th className="py-3 px-3">Name &amp; Code</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">State</th>
                <th className="py-3 px-3">Reservation</th>
                <th className="py-3 px-3">Source</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredConstituencies.map((c) => (
                <tr key={c.constituencyId} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                    {c.constituencyId}
                  </td>
                  <td className="py-2.5 px-3">
                    <p className="font-bold text-slate-900">{c.name}</p>
                    <span className="text-[11px] text-slate-500">{c.code}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'bg-teal-100 text-teal-900'
                      }`}
                    >
                      {c.constituencyType}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold">{c.stateId}</td>
                  <td className="py-2.5 px-3">{c.reservationType}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                      {c.metadataSource}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(c.constituencyId);
                        setForm({
                          name: c.name,
                          code: c.code,
                          constituencyType: c.constituencyType,
                          stateId: c.stateId,
                          districtId: c.districtId || '',
                          parentParliamentaryConstituencyId:
                            c.parentParliamentaryConstituencyId || '',
                          reservationType: c.reservationType || 'GENERAL',
                        });
                      }}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
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
