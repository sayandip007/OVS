import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import { CONSTITUENCY_TYPES } from '../../utils/constants';
import { eciLogo } from '../../assets';

export default function VoterRegister() {
  const navigate = useNavigate();
  const { states, districts, constituencies, registerVoter } = useElection();
  const { notifySuccess, notifyError } = useNotification();

  const [form, setForm] = useState({
    fullName: '',
    dob: '1999-05-15',
    gender: 'Male',
    voterRef: '',
    stateId: 'WB',
    districtId: 'WB-DIST-NADIA',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
    email: '',
    mobile: '',
    address: '',
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const res = registerVoter(form);
    if (!res.ok) {
      notifyError(res.errors?.[0] || 'Failed to register voter.');
      return;
    }

    notifySuccess(
      `Electoral registration complete! EPIC Ref: ${res.voter.voterRef}. You can now log in with your mobile number.`
    );
    navigate('/voter/login');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <img src={eciLogo} alt="ECI" className="h-10 w-auto object-contain" />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
                Form-6 Digital Electoral Roll
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900">
                New Voter Registration
              </h1>
            </div>
          </div>
          <Link
            to="/voter/login"
            className="text-xs font-bold text-[#002868] hover:underline"
          >
            Already Registered? Login &rarr;
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Personal Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Full Name (as per official ID) *
              </label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Enter full name"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Date of Birth (Must be 18+) *
              </label>
              <input
                type="date"
                required
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Gender *
              </label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Third Gender">Third Gender</option>
              </select>
            </div>
          </div>

          {/* EPIC, Mobile, Email */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                EPIC / Voter Reference Number *
              </label>
              <input
                type="text"
                required
                value={form.voterRef}
                onChange={(e) =>
                  setForm({ ...form, voterRef: e.target.value.toUpperCase() })
                }
                placeholder="e.g. WBX5566778"
                className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                10-Digit Mobile Number *
              </label>
              <input
                type="tel"
                required
                maxLength={10}
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                placeholder="98XXXXXXXX"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="voter@india.in"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Geographical & Dual Constituency Mapping */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Dual Electoral Jurisdiction Mapping (State, PC &amp; AC)
              </h2>
              <p className="text-xs text-slate-600">
                Every voter is mapped to both a Parliamentary Constituency (for Lok Sabha
                elections) and an Assembly Constituency (for State Assembly elections).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  1. State / Union Territory (All 36) *
                </label>
                <select
                  value={form.stateId}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {states.map((st) => (
                    <option key={st.stateId} value={st.stateId}>
                      {st.stateName} ({st.stateId}) — {st.type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. District *
                </label>
                <select
                  value={form.districtId}
                  onChange={(e) => setForm({ ...form, districtId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {stateDistricts.map((d) => (
                    <option key={d.districtId} value={d.districtId}>
                      {d.districtName} ({d.districtCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">
                  3. Parliamentary Constituency (Lok Sabha PC) *
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
                      {pc.name} ({pc.code}) — {pc.reservationType}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-teal-900 mb-1">
                  4. Assembly Constituency (Vidhan Sabha AC) *
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
                      {ac.name} ({ac.code}) — {ac.reservationType}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Residential Address *
            </label>
            <input
              type="text"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="House No, Street, Locality, PIN Code"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              to="/voter/login"
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-sm font-bold shadow-xs cursor-pointer"
            >
              Complete Electoral Registration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
