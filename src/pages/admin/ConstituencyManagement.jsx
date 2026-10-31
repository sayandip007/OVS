import React, { useState, useMemo } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import SearchBar from '../../components/common/SearchBar';
import Modal from '../../components/common/Modal';
import { CONSTITUENCY_TYPES, RESERVATION_TYPES } from '../../utils/constants';
import { AlertTriangle, Eye, Archive, Edit3 } from 'lucide-react';

export default function ConstituencyManagement() {
  const {
    states,
    districts,
    constituencies,
    candidates,
    elections,
    createConstituency,
    updateConstituency,
    checkConstituencyImpact,
  } = useElection();
  const { currentAdmin, canPerformAdminAction } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [typeFilter, setTypeFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState(
    currentAdmin?.assignedStateId || 'ALL'
  );
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [impactModal, setImpactModal] = useState(null);
  const [inspectSeat, setInspectSeat] = useState(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    constituencyType: CONSTITUENCY_TYPES.ASSEMBLY,
    stateId: currentAdmin?.assignedStateId || 'WB',
    districtId: 'WB-DIST-NADIA',
    districtIds: ['WB-DIST-NADIA'],
    parentParliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    reservationType: RESERVATION_TYPES.GENERAL,
    isActive: true,
    description: '',
  });

  const stateDistricts = useMemo(
    () => districts.filter((d) => d.stateId === form.stateId),
    [districts, form.stateId]
  );

  const filterableDistricts = useMemo(() => {
    if (stateFilter === 'ALL') return districts;
    return districts.filter((d) => d.stateId === stateFilter);
  }, [districts, stateFilter]);

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
      if (districtFilter !== 'ALL') {
        const matchesSingle = c.districtId === districtFilter;
        const matchesMulti =
          Array.isArray(c.districtIds) && c.districtIds.includes(districtFilter);
        if (!matchesSingle && !matchesMulti) return false;
      }
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
  }, [constituencies, typeFilter, stateFilter, districtFilter, search]);

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
      districtIds: firstDist ? [firstDist.districtId] : [],
      parentParliamentaryConstituencyId: firstPC?.constituencyId || '',
    }));
  };

  const toggleMultiDistrict = (distId) => {
    setForm((prev) => {
      const current = Array.isArray(prev.districtIds) ? prev.districtIds : [];
      const exists = current.includes(distId);
      const next = exists
        ? current.filter((id) => id !== distId)
        : [...current, distId];
      return {
        ...prev,
        districtIds: next.length > 0 ? next : [distId],
      };
    });
  };

  const executeSave = (payload) => {
    if (editingId) {
      const res = updateConstituency(editingId, payload, currentAdmin);
      if (!res.ok) {
        notifyError(res.errors?.[0] || 'Failed to update constituency.');
        return;
      }
      notifySuccess(`Updated constituency: ${res.constituency.name}`);
      setEditingId(null);
    } else {
      const res = createConstituency(payload, currentAdmin);
      if (!res.ok) {
        notifyError(res.errors?.[0] || 'Failed to create constituency.');
        return;
      }
      notifySuccess(
        `Created ${res.constituency.constituencyType} constituency: ${res.constituency.name}`
      );
    }
    setForm((prev) => ({ ...prev, name: '', code: '', description: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const perm = canPerformAdminAction('MANAGE_CONSTITUENCY', {
      stateId: form.stateId,
    });
    if (!perm.allowed) {
      notifyError(perm.reason);
      return;
    }

    const payload = {
      ...form,
      districtIds:
        form.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
          ? form.districtIds?.length
            ? form.districtIds
            : stateDistricts.map((d) => d.districtId)
          : [],
    };

    if (editingId) {
      const impact = checkConstituencyImpact(editingId);
      if (impact.hasImpact) {
        setImpactModal({
          constituencyId: editingId,
          payload,
          impact,
        });
        return;
      }
    }

    executeSave(payload);
  };

  const handleArchiveToggle = (seat) => {
    const perm = canPerformAdminAction('MANAGE_CONSTITUENCY', {
      stateId: seat.stateId,
    });
    if (!perm.allowed) {
      notifyError(perm.reason);
      return;
    }
    const nextActive = seat.isActive === false;
    const nextStatus = nextActive ? 'ACTIVE' : 'ARCHIVED';
    const impact = checkConstituencyImpact(seat.constituencyId);
    const payload = {
      ...seat,
      isActive: nextActive,
      status: nextStatus,
    };

    if (!nextActive && impact.hasImpact) {
      setImpactModal({
        constituencyId: seat.constituencyId,
        payload,
        impact,
        isArchiveAction: true,
      });
      return;
    }

    const res = updateConstituency(seat.constituencyId, payload, currentAdmin);
    if (res.ok) {
      notifySuccess(
        `Constituency ${seat.name} marked as ${nextStatus}.`
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Dual Constituency Architecture (PC &amp; AC)
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Parliamentary (PC) &amp; Assembly (AC) Constituencies (
            {constituencies.length})
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Maintain strict separation between Parliamentary Constituencies (multi-district Lok Sabha seats) and Assembly Constituencies (Vidhan Sabha seats linked to a parent PC).
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 pt-4 border-t border-slate-200"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
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
                Official Code *
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

            <div className="flex gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                {editingId ? 'Save Changes' : '+ Add Seat'}
              </button>
            </div>
          </div>

          {/* District Mapping Row */}
          {form.constituencyType === CONSTITUENCY_TYPES.ASSEMBLY ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assigned District *
                </label>
                <select
                  value={form.districtId}
                  onChange={(e) =>
                    setForm({ ...form, districtId: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {stateDistricts.map((d) => (
                    <option key={d.districtId} value={d.districtId}>
                      {d.districtName} ({d.districtId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reservation Category
                </label>
                <select
                  value={form.reservationType}
                  onChange={(e) =>
                    setForm({ ...form, reservationType: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="GENERAL">GENERAL</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <p className="text-xs font-bold text-slate-700">
                Multi-District Parliamentary Coverage ({stateDistricts.length} Districts in {form.stateId}):
              </p>
              <div className="flex flex-wrap gap-2">
                {stateDistricts.map((dist) => {
                  const checked = (form.districtIds || []).includes(
                    dist.districtId
                  );
                  return (
                    <label
                      key={dist.districtId}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
                        checked
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMultiDistrict(dist.districtId)}
                        className="rounded text-[#002868]"
                      />
                      <span>{dist.districtName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Constituencies Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">
            Constituencies Directory ({filteredConstituencies.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2.5">
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
              onChange={(e) => {
                setStateFilter(e.target.value);
                setDistrictFilter('ALL');
              }}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All States &amp; UTs</option>
              {states.map((st) => (
                <option key={st.stateId} value={st.stateId}>
                  {st.stateName} ({st.stateId})
                </option>
              ))}
            </select>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Districts</option>
              {filterableDistricts.map((d) => (
                <option key={d.districtId} value={d.districtId}>
                  {d.districtName} ({d.stateId})
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
                <th className="py-3 px-3">State / Parent PC</th>
                <th className="py-3 px-3">Reservation</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
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
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-slate-900">{c.stateId}</span>
                    {c.parentParliamentaryConstituencyId && (
                      <span className="block text-[10px] text-slate-500 font-mono">
                        PC: {c.parentParliamentaryConstituencyId}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">{c.reservationType}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.isActive === false
                          ? 'bg-slate-200 text-slate-600'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {c.isActive === false ? 'ARCHIVED' : 'ACTIVE'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setInspectSeat(c)}
                        title="View Associated Candidates & Elections"
                        className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
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
                            districtIds: c.districtIds || [],
                            parentParliamentaryConstituencyId:
                              c.parentParliamentaryConstituencyId || '',
                            reservationType: c.reservationType || 'GENERAL',
                            isActive: c.isActive !== false,
                            description: c.description || '',
                          });
                        }}
                        title="Edit Constituency"
                        className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchiveToggle(c)}
                        title={
                          c.isActive === false
                            ? 'Restore Constituency'
                            : 'Archive Constituency'
                        }
                        className="p-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dependency Warning Confirmation Modal */}
      <Modal
        isOpen={Boolean(impactModal)}
        onClose={() => setImpactModal(null)}
        title="Electoral Dependency Warning"
        subtitle="Constituency is referenced by active records"
      >
        {impactModal && (
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-950">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  Modifying or archiving {impactModal.constituencyId} affects linked records:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {impactModal.impact.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p>
              Do you want to proceed with updating this constituency configuration?
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setImpactModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  executeSave(impactModal.payload);
                  setImpactModal(null);
                }}
                className="px-4 py-2 rounded-lg bg-[#002868] hover:bg-blue-900 font-bold text-white cursor-pointer"
              >
                Confirm &amp; Apply Update
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Inspect Associated Candidates & Elections Modal */}
      <Modal
        isOpen={Boolean(inspectSeat)}
        onClose={() => setInspectSeat(null)}
        title={inspectSeat ? `${inspectSeat.name} (${inspectSeat.code})` : ''}
        subtitle={
          inspectSeat
            ? `${inspectSeat.constituencyType} Constituency • State: ${inspectSeat.stateId}`
            : ''
        }
      >
        {inspectSeat && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <p className="font-bold text-slate-900">Associated Elections:</p>
              {elections
                .filter(
                  (e) =>
                    (e.constituencyIds || []).includes(inspectSeat.constituencyId) ||
                    (e.electionType === 'LOK_SABHA' &&
                      inspectSeat.constituencyType === 'PARLIAMENTARY') ||
                    (e.electionType === 'STATE_ASSEMBLY' &&
                      e.stateId === inspectSeat.stateId &&
                      inspectSeat.constituencyType === 'ASSEMBLY')
                )
                .map((e) => (
                  <p key={e.electionId} className="text-slate-700">
                    • <strong>{e.title}</strong> ({e.electionId}) — {e.status}
                  </p>
                ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <p className="font-bold text-slate-900">Contesting Candidates:</p>
              {candidates.filter(
                (c) => c.constituencyId === inspectSeat.constituencyId
              ).length === 0 ? (
                <p className="text-slate-500">No candidates nominated yet.</p>
              ) : (
                candidates
                  .filter((c) => c.constituencyId === inspectSeat.constituencyId)
                  .map((c) => (
                    <p key={c.candidateId} className="text-slate-700">
                      • <strong>{c.name}</strong> ({c.electionId}) — Status:{' '}
                      <span className="font-mono font-semibold">
                        {c.status || c.approvalStatus}
                      </span>
                    </p>
                  ))
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
