import React, { useState, useMemo } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import SearchBar from '../../components/common/SearchBar';

export default function DistrictManagement() {
  const { states, districts, constituencies, upsertDistrict } = useElection();
  const { currentAdmin, canPerformAdminAction } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [stateFilter, setStateFilter] = useState(
    currentAdmin?.assignedStateId || 'ALL'
  );
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    districtId: '',
    stateId: currentAdmin?.assignedStateId || 'WB',
    districtName: '',
    districtCode: '',
    headquarters: '',
    isActive: true,
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
    const perm = canPerformAdminAction('MANAGE_DISTRICT', {
      stateId: form.stateId,
    });
    if (!perm.allowed) {
      notifyError(perm.reason);
      return;
    }

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

    const saved = upsertDistrict(
      {
        districtId,
        stateId: form.stateId,
        districtName: form.districtName.trim(),
        districtCode: cleanCode,
        headquarters: form.headquarters.trim() || form.districtName.trim(),
        isActive: form.isActive !== false,
      },
      currentAdmin
    );

    notifySuccess(`Saved district ${saved.districtName} in ${saved.stateId}`);
    setForm({
      districtId: '',
      stateId: form.stateId,
      districtName: '',
      districtCode: '',
      headquarters: '',
      isActive: true,
    });
  };

  const handleToggleStatus = (dist) => {
    const perm = canPerformAdminAction('MANAGE_DISTRICT', {
      stateId: dist.stateId,
    });
    if (!perm.allowed) {
      notifyError(perm.reason);
      return;
    }
    const nextActive = dist.isActive === false;
    upsertDistrict({ ...dist, isActive: nextActive }, currentAdmin);
    notifySuccess(
      `District ${dist.districtName} marked as ${
        nextActive ? 'Active' : 'Inactive'
      }.`
    );
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
          <p className="text-xs text-slate-600 mt-1">
            Add, edit, or deactivate districts across Indian States and Union Territories. Districts linked to constituencies are protected from deletion.
          </p>
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
                <th className="py-3 px-4">Linked Constituencies</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDistricts.map((d) => {
                const acCount = constituencies.filter(
                  (c) => c.districtId === d.districtId
                ).length;
                const pcCount = constituencies.filter(
                  (c) =>
                    Array.isArray(c.districtIds) &&
                    c.districtIds.includes(d.districtId)
                ).length;
                return (
                  <tr key={d.districtId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {d.districtId}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {d.districtName}
                    </td>
                    <td className="py-3 px-4 font-semibold">{d.stateId}</td>
                    <td className="py-3 px-4">{d.headquarters}</td>
                    <td className="py-3 px-4">
                      {pcCount} PCs • {acCount} ACs
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.isActive === false
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {d.isActive === false ? 'INACTIVE' : 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setForm(d)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(d)}
                          className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                        >
                          {d.isActive === false ? 'Activate' : 'Deactivate'}
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
