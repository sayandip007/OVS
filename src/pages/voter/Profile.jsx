import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVoter } from '../../context/VoterContext';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import { frontendEnv } from '../../config/env';
import { apiClient } from '../../services/apiClient';
import Modal from '../../components/common/Modal';
import { GENDER_OPTIONS } from '../../utils/constants';
import {
  getCascadingGeographyOptions,
  reconcileGeographySelection,
} from '../../utils/electionHelpers';
import { defaultAvatar } from '../../assets';

export default function VoterProfile() {
  const { csrfToken } = useAuth();
  const {
    currentVoter,
    voterState,
    voterDistrict,
    voterParliamentaryConstituency,
    voterAssemblyConstituency,
    profileCompletion,
    updateCurrentVoterProfile,
  } = useVoter();
  const { states, districts, constituencies } = useElection();
  const { notifySuccess, notifyError } = useNotification();

  const [isEditing, setIsEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [adminCorrectionModalOpen, setAdminCorrectionModalOpen] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    dob: '',
    gender: '',
    email: '',
    mobile: '',
    address: '',
    pinCode: '',
    avatar: defaultAvatar,
  });

  const [geoCorrectionForm, setGeoCorrectionForm] = useState({
    stateId: '',
    districtId: '',
    parliamentaryConstituencyId: '',
    assemblyConstituencyId: '',
    correctionReason: 'Electoral Roll Jurisdiction Transfer (Simulated Form 8)',
  });

  useEffect(() => {
    if (currentVoter) {
      setForm({
        fullName: currentVoter.fullName || '',
        dob: currentVoter.dob || '1996-05-15',
        gender: currentVoter.gender || '',
        email: currentVoter.email || '',
        mobile: currentVoter.mobile || '',
        address: currentVoter.address || '',
        pinCode: currentVoter.pinCode || '700001',
        avatar: currentVoter.avatar || defaultAvatar,
      });
      setGeoCorrectionForm({
        stateId: currentVoter.stateId || 'WB',
        districtId: currentVoter.districtId || '',
        parliamentaryConstituencyId: currentVoter.parliamentaryConstituencyId || '',
        assemblyConstituencyId: currentVoter.assemblyConstituencyId || '',
        correctionReason: 'Electoral Roll Jurisdiction Transfer (Simulated Form 8)',
      });
    }
  }, [currentVoter]);

  const geoOptions = useMemo(
    () =>
      getCascadingGeographyOptions({
        stateId: geoCorrectionForm.stateId,
        districtId: geoCorrectionForm.districtId,
        parliamentaryConstituencyId: geoCorrectionForm.parliamentaryConstituencyId,
        states,
        districts,
        constituencies,
      }),
    [
      geoCorrectionForm.stateId,
      geoCorrectionForm.districtId,
      geoCorrectionForm.parliamentaryConstituencyId,
      states,
      districts,
      constituencies,
    ]
  );

  if (!currentVoter) return null;

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

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFieldErrors({});
    setForm({
      fullName: currentVoter.fullName || '',
      dob: currentVoter.dob || '1996-05-15',
      gender: currentVoter.gender || '',
      email: currentVoter.email || '',
      mobile: currentVoter.mobile || '',
      address: currentVoter.address || '',
      pinCode: currentVoter.pinCode || '700001',
      avatar: currentVoter.avatar || defaultAvatar,
    });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    if (frontendEnv.isBackendApi && csrfToken) {
      try {
        await apiClient.voters.updateMe(
          {
            fullName: form.fullName.trim() || undefined,
            gender: form.gender || undefined,
            email: form.email.trim() || undefined,
            mobile: form.mobile.trim() || undefined,
            address: form.address.trim() || undefined,
            pinCode: form.pinCode.trim() || undefined,
          },
          csrfToken
        );
      } catch (err) {
        notifyError(
          err?.detail || err?.message || 'Failed to update profile on backend.'
        );
        return;
      }
    }

    const res = updateCurrentVoterProfile(form, {
      allowAdminConstituencyCorrection: false,
    });

    if (!res.ok) {
      setFieldErrors(res.fieldErrors || {});
      notifyError(res.error || 'Please fix the highlighted profile fields.');
      return;
    }

    setFieldErrors({});
    setIsEditing(false);
    notifySuccess('Your voter profile details have been validated and updated!');
  };

  const handleGeoCorrectionChange = (changedField, newValue) => {
    const nextRaw = { ...geoCorrectionForm, [changedField]: newValue };
    const reconciled = reconcileGeographySelection({
      nextSelection: nextRaw,
      changedField,
      districts,
      constituencies,
    });
    setGeoCorrectionForm((prev) => ({
      ...prev,
      ...reconciled,
    }));
  };

  const handleApplyAdminGeoCorrection = (e) => {
    e.preventDefault();
    const res = updateCurrentVoterProfile(
      {
        ...form,
        stateId: geoCorrectionForm.stateId,
        districtId: geoCorrectionForm.districtId,
        parliamentaryConstituencyId: geoCorrectionForm.parliamentaryConstituencyId,
        assemblyConstituencyId: geoCorrectionForm.assemblyConstituencyId,
        correctionReason: geoCorrectionForm.correctionReason,
      },
      { allowAdminConstituencyCorrection: true }
    );

    if (!res.ok) {
      notifyError(res.error || 'Invalid constituency association selected.');
      return;
    }

    setAdminCorrectionModalOpen(false);
    notifySuccess(
      'Demo Administrative Constituency Correction applied! Original association archived in history.'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Electoral Roll Record • {currentVoter.voterId}
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            My Voter Profile &amp; Electoral Geography
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            View and manage your personal details, residential address, and registered
            Parliamentary &amp; Assembly constituencies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] font-bold uppercase text-slate-500 block">
              Profile Completion
            </span>
            <span className="text-sm font-extrabold text-emerald-700">
              {profileCompletion.percentage}% Complete
            </span>
          </div>
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-4 py-2.5 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              Edit Profile Details
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Cancel Editing
            </button>
          )}
        </div>
      </div>

      {/* Main Profile Form / View */}
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Section 1 & 2: Personal Information + Identity Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Identity Information Card (Locked Statutory Fields) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <img
                src={form.avatar || defaultAvatar}
                alt={form.fullName}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-[#002868]"
              />
              <div>
                <span className="px-2.5 py-0.5 rounded bg-blue-100 text-[#002868] text-xs font-mono font-bold">
                  {currentVoter.voterRef}
                </span>
                <h2 className="text-base font-extrabold text-slate-900 mt-1">
                  {currentVoter.fullName}
                </h2>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  {currentVoter.accountStatus || 'VERIFIED_DEMO'}
                </span>
              </div>
            </div>

            {isEditing && (
              <div className="pb-3 border-b border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Update Profile Photograph
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-[#002868]"
                />
              </div>
            )}

            <div className="space-y-2.5 text-xs">
              <h3 className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
                Identity Information (Demo)
              </h3>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">System Voter ID</span>
                <strong className="font-mono text-slate-900">{currentVoter.voterId}</strong>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Demo EPIC Reference</span>
                <strong className="font-mono text-[#002868]">{currentVoter.voterRef}</strong>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Verification Status</span>
                <strong className="text-emerald-700">Simulated E-Roll Verified</strong>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Registration Date</span>
                <strong className="text-slate-800">
                  {currentVoter.registeredAt
                    ? new Date(currentVoter.registeredAt).toLocaleDateString('en-IN')
                    : '15 Jan 2025'}
                </strong>
              </div>
            </div>
          </div>

          {/* Personal & Address Information */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900">
                1. Personal &amp; Contact Information
              </h2>
              <span className="text-xs text-slate-500">
                {isEditing ? 'Editing Mode Active' : 'Read-Only View'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50 disabled:text-slate-700"
                />
                {fieldErrors.fullName && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.fullName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Date of Birth (18+ Required) *
                </label>
                <input
                  type="date"
                  disabled={!isEditing}
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50 disabled:text-slate-700"
                />
                {fieldErrors.dob && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.dob}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Gender (Optional)
                </label>
                <select
                  disabled={!isEditing}
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-700"
                >
                  <option value="">Prefer not to disclose</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  10-Digit Mobile Number *
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  disabled={!isEditing}
                  value={form.mobile}
                  onChange={(e) =>
                    setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })
                  }
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50 disabled:text-slate-700"
                />
                {fieldErrors.mobile && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.mobile}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  disabled={!isEditing}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50 disabled:text-slate-700"
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-4">
              <h2 className="text-base font-extrabold text-slate-900">
                2. Residential Address Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Residential Address *
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50 disabled:text-slate-700"
                  />
                  {fieldErrors.address && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.address}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    6-Digit PIN Code *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    disabled={!isEditing}
                    value={form.pinCode}
                    onChange={(e) =>
                      setForm({ ...form, pinCode: e.target.value.replace(/\D/g, '') })
                    }
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-mono disabled:bg-slate-50 disabled:text-slate-700"
                  />
                  {fieldErrors.pinCode && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.pinCode}</p>
                  )}
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancel Changes
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#138808] hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Section 3: Election Geography (Locked Post-Registration with Demo Admin Correction) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                Locked Electoral Roll Mapping
              </span>
              <span className="text-xs text-slate-500">
                Protected against arbitrary self-modification during active polls
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 mt-1">
              3. Registered Election Geography (PC &amp; AC)
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setAdminCorrectionModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-bold cursor-pointer"
          >
            Demo Administrative Constituency Correction (Form 8)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-semibold block">
              State / Union Territory
            </span>
            <strong className="text-sm text-slate-900 mt-0.5 block">
              {voterState?.stateName || currentVoter.stateId} ({currentVoter.stateId})
            </strong>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-semibold block">Administrative District</span>
            <strong className="text-sm text-slate-900 mt-0.5 block">
              {voterDistrict?.districtName || currentVoter.districtId}
            </strong>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200">
            <span className="text-indigo-800 font-bold uppercase text-[10px] block">
              Parliamentary Constituency (Lok Sabha)
            </span>
            <strong className="text-sm text-slate-900 mt-0.5 block">
              {voterParliamentaryConstituency?.name ||
                currentVoter.parliamentaryConstituencyId}{' '}
              PC
            </strong>
            <span className="text-[11px] text-slate-600">
              Code: {voterParliamentaryConstituency?.code || 'N/A'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200">
            <span className="text-teal-800 font-bold uppercase text-[10px] block">
              Assembly Constituency (State Assembly)
            </span>
            <strong className="text-sm text-slate-900 mt-0.5 block">
              {voterAssemblyConstituency?.name || currentVoter.assemblyConstituencyId} AC
            </strong>
            <span className="text-[11px] text-slate-600">
              Code: {voterAssemblyConstituency?.code || 'N/A'}
            </span>
          </div>
        </div>

        {/* Constituency History Log (if any administrative corrections occurred) */}
        {Array.isArray(currentVoter.constituencyHistory) &&
          currentVoter.constituencyHistory.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Original &amp; Historical Constituency Associations (Preserved Audit Trail)
              </span>
              <div className="space-y-1.5">
                {currentVoter.constituencyHistory.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      Previous Mapping: <strong>{entry.stateId}</strong> •{' '}
                      <strong>{entry.parliamentaryConstituencyId}</strong> •{' '}
                      <strong>{entry.assemblyConstituencyId}</strong>
                    </span>
                    <span className="text-slate-500">
                      {entry.reason} ({new Date(entry.changedAt).toLocaleString('en-IN')})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Demo Administrative Constituency Correction Modal */}
      <Modal
        isOpen={adminCorrectionModalOpen}
        onClose={() => setAdminCorrectionModalOpen(false)}
        title="Demo Administrative Constituency Correction (Simulated Form 8)"
      >
        <form onSubmit={handleApplyAdminGeoCorrection} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
            <strong>Demonstration Notice:</strong> In production ECI workflows, constituency
            mappings are locked after registration and can only be modified via an approved
            Electoral Registration Officer (ERO) Form 8 order. This simulator lets you test
            switching jurisdictions while preserving your original association in{' '}
            <code className="font-mono">constituencyHistory</code>.
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              1. State / Union Territory
            </label>
            <select
              value={geoCorrectionForm.stateId}
              onChange={(e) => handleGeoCorrectionChange('stateId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              {states.map((st) => (
                <option key={st.stateId} value={st.stateId}>
                  {st.stateName} ({st.stateId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              2. Administrative District
            </label>
            <select
              value={geoCorrectionForm.districtId}
              onChange={(e) => handleGeoCorrectionChange('districtId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="">-- Select District --</option>
              {geoOptions.districts.map((d) => (
                <option key={d.districtId} value={d.districtId}>
                  {d.districtName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-indigo-900 mb-1">
              3. Parliamentary Constituency (Lok Sabha PC)
            </label>
            <select
              value={geoCorrectionForm.parliamentaryConstituencyId}
              onChange={(e) =>
                handleGeoCorrectionChange('parliamentaryConstituencyId', e.target.value)
              }
              className="w-full px-3 py-2 border border-indigo-300 rounded-lg bg-white"
            >
              <option value="">-- Select Parliamentary Constituency --</option>
              {geoOptions.parliamentaryConstituencies.map((pc) => (
                <option key={pc.constituencyId} value={pc.constituencyId}>
                  {pc.name} ({pc.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-teal-900 mb-1">
              4. Assembly Constituency (State Assembly AC)
            </label>
            <select
              value={geoCorrectionForm.assemblyConstituencyId}
              onChange={(e) =>
                handleGeoCorrectionChange('assemblyConstituencyId', e.target.value)
              }
              className="w-full px-3 py-2 border border-teal-300 rounded-lg bg-white"
            >
              <option value="">-- Select Assembly Constituency --</option>
              {geoOptions.assemblyConstituencies.map((ac) => (
                <option key={ac.constituencyId} value={ac.constituencyId}>
                  {ac.name} ({ac.code})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdminCorrectionModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#002868] text-white font-bold"
            >
              Apply Administrative Correction
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
