import React, { useState, useMemo } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import SearchBar from '../../components/common/SearchBar';

export default function DistrictManagement() {
  const { states, districts, constituencies, upsertDistrict } = useElection();
  const { notifySuccess, notifyError } = useNotification();

  const [stateFilter, setStateFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    districtId: '',
    stateId: 'WB',
    districtName: '',
    districtCode: '',
    headquarters: '',
  });

  const filteredDistricts = useMemo(() => {
    return districts.filter((d) => {
      if (stateFilter !== 'ALL' && d.stateId !== stateFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          d.districtName.toLowerCase().includes(q) ||
          d.districtId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [districts, stateFilter, search]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.districtName.trim() || !form.stateId) {
      notifyError('State and District Name are required.');
      return;
    }
    const cleanCode =
      form.districtCode.trim().toUpperCase() ||
      `${form.stateId}-D${districts.length + 1}`;
    const districtId =
      form.districtId ||
      `${form.stateId}-DIST-${form.districtName
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')}`;

    const saved = upsertDistrict({
      districtId,
      stateId: form.stateId,
      districtName: form.districtName.trim(),
      districtCode: cleanCode,
      headquarters: form.headquarters.trim() || form.districtName.trim(),
    });

    notifySuccess(`Saved district ${saved.districtName} in ${saved.stateId}`);
    setForm({
      districtId: '',
      stateId: form.stateId,
      districtName: '',
      districtCode: '',
      headquarters: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            District Electoral Administration
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Districts Management ({districts.length})
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-200 items-end"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              State / UT *
            </label>
            <select
              value={form.stateId}
              onChange={(e) => setForm({ ...form, stateId: e.target.value })}
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
              District Name *
            </label>
            <input
              type="text"
              required
              value={form.districtName}
              onChange={(e) => setForm({ ...form, districtName: e.target.value })}
              placeholder="e.g. Murshidabad"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              District Code
            </label>
            <input
              type="text"
              value={form.districtCode}
              onChange={(e) => setForm({ ...form, districtCode: e.target.value })}
              placeholder="e.g. WB-03"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Headquarters
            </label>
            <input
              type="text"
              value={form.headquarters}
              onChange={(e) => setForm({ ...form, headquarters: e.target.value })}
              placeholder="e.g. Baharampur"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            {form.districtId ? 'Update District' : '+ Add District'}
          </button>
        </form>
      </div>

      {/* Districts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">
            Configured Districts ({filteredDistricts.length})
          </h2>
          <div className="flex items-center gap-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search district..."
            />
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

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3 px-4">District ID</th>
                <th className="py-3 px-4">District Name</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4">Headquarters</th>
                <th className="py-3 px-4">Assembly Seats</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDistricts.map((d) => {
                const acCount = constituencies.filter(
                  (c) => c.districtId === d.districtId
                ).length;
                return (
                  <tr key={d.districtId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {d.districtId}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {d.districtName}
                    </td>
                    <td className="py-3 px-4">{d.stateId}</td>
                    <td className="py-3 px-4">{d.headquarters}</td>
                    <td className="py-3 px-4">{acCount} ACs</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setForm(d)}
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
