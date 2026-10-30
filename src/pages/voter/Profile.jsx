import React, { useState, useMemo } from 'react';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import { CONSTITUENCY_TYPES } from '../../utils/constants';
import { defaultAvatar } from '../../assets';

export default function VoterProfile() {
  const { currentVoter } = useVoter();
  const { states, districts, constituencies, updateVoterProfile } = useElection();
  const { notifySuccess } = useNotification();

  const [form, setForm] = useState({
    fullName: currentVoter?.fullName || '',
    email: currentVoter?.email || '',
    mobile: currentVoter?.mobile || '',
    address: currentVoter?.address || '',
    stateId: currentVoter?.stateId || 'WB',
    districtId: currentVoter?.districtId || 'WB-DIST-NADIA',
    parliamentaryConstituencyId:
      currentVoter?.parliamentaryConstituencyId || 'WB-PC-KRISHNANAGAR',
    assemblyConstituencyId:
      currentVoter?.assemblyConstituencyId || 'WB-AC-KRISHNANAGAR-UTTAR',
    avatar: currentVoter?.avatar || defaultAvatar,
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

  const stateACs = useMemo(
    () =>
      constituencies.filter(
        (c) =>
          c.stateId === form.stateId &&
          c.constituencyType === CONSTITUENCY_TYPES.ASSEMBLY
      ),
    [constituencies, form.stateId]
  );

  if (!currentVoter) return null;

  const handleStateChange = (newStateId) => {
    const firstDist = districts.find((d) => d.stateId === newStateId);
    const firstPC = constituencies.find(
      (c) =>
        c.stateId === newStateId &&
        c.constituencyType === CONSTITUENCY_TYPES.PARLIAMENTARY
    );
    const firstAC = constituencies.find(
      (c) =>
        c.stateId === newStateId &&
        c.constituencyType === CONSTITUENCY_TYPES.ASSEMBLY
    );
    setForm((prev) => ({
      ...prev,
      stateId: newStateId,
      districtId: firstDist?.districtId || '',
      parliamentaryConstituencyId: firstPC?.constituencyId || '',
      assemblyConstituencyId: firstAC?.constituencyId || '',
    }));
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, avatar: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e) => {
    e.preventDefault();
    updateVoterProfile(currentVoter.voterId, form);
    notifySuccess(
      'Voter profile and dual Parliamentary/Assembly constituency mappings updated!'
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Electoral Roll Record
          </span>
          <h1 className="text-2xl font-bold text-slate-900">
            Voter Profile &amp; Jurisdiction Settings
          </h1>
        </div>
        <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono font-bold">
          EPIC: {currentVoter.voterRef}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-4 border-b border-slate-100">
          <img
            src={form.avatar || defaultAvatar}
            alt={form.fullName}
            className="w-20 h-20 rounded-2xl object-cover border-2 border-[#002868]"
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Update Elector Photograph
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-[#002868] hover:file:bg-blue-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mobile Number
            </label>
            <input
              type="tel"
              required
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">
            Dual Constituency Mapping (Switch State/PC/AC to test any jurisdiction)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                State / Union Territory
              </label>
              <select
                value={form.stateId}
                onChange={(e) => handleStateChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
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
                District
              </label>
              <select
                value={form.districtId}
                onChange={(e) => setForm({ ...form, districtId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {stateDistricts.map((d) => (
                  <option key={d.districtId} value={d.districtId}>
                    {d.districtName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-indigo-900 mb-1">
                Parliamentary Constituency (Lok Sabha PC)
              </label>
              <select
                value={form.parliamentaryConstituencyId}
                onChange={(e) =>
                  setForm({ ...form, parliamentaryConstituencyId: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-lg bg-white"
              >
                {statePCs.map((pc) => (
                  <option key={pc.constituencyId} value={pc.constituencyId}>
                    {pc.name} ({pc.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-teal-900 mb-1">
                Assembly Constituency (State Assembly AC)
              </label>
              <select
                value={form.assemblyConstituencyId}
                onChange={(e) =>
                  setForm({ ...form, assemblyConstituencyId: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-teal-300 rounded-lg bg-white"
              >
                {stateACs.map((ac) => (
                  <option key={ac.constituencyId} value={ac.constituencyId}>
                    {ac.name} ({ac.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Residential Address
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>

        <button
          type="submit"
          className="px-6 py-2.5 bg-[#002868] hover:bg-blue-900 text-white text-sm font-bold rounded-xl shadow-xs cursor-pointer"
        >
          Save Profile &amp; Jurisdiction Changes
        </button>
      </form>
    </div>
  );
}
