import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  MapPin,
  UserCheck,
  FileText,
  Edit3,
} from 'lucide-react';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import { calculateAgeFromDob } from '../../utils/validation';
import {
  getCascadingGeographyOptions,
  reconcileGeographySelection,
} from '../../utils/electionHelpers';
import { eciLogo } from '../../assets';
import { frontendEnv } from '../../config/env';
import { apiClient } from '../../services/apiClient';

const STEPS = [
  { id: 1, title: 'Personal Information', subtitle: 'Name, DOB, Contact' },
  { id: 2, title: 'Demo Identity & Address', subtitle: 'Fictional EPIC & PIN' },
  {
    id: 3,
    title: 'Geographical & Constituency',
    subtitle: 'State, District, PC & AC',
  },
  { id: 4, title: 'Review & Confirmation', subtitle: 'Demo Consent & Submit' },
];

export default function VoterRegister() {
  const navigate = useNavigate();
  const { states, districts, constituencies, registerVoter } = useElection();
  const { notifySuccess, notifyError } = useNotification();

  const [currentStep, setCurrentStep] = useState(1);
  const [stepErrors, setStepErrors] = useState({});
  const [consentChecked, setConsentChecked] = useState(false);
  const [registeredVoterResult, setRegisteredVoterResult] = useState(null);

  const [form, setForm] = useState({
    fullName: '',
    dateOfBirth: '1999-05-15',
    gender: '', // Optional per Phase 3 specification
    email: '',
    mobile: '',
    epicReference: '',
    address: '',
    pinCode: '',
    stateId: 'WB',
    districtId: 'NADIA',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
  });

  // Dynamic cascading options for Step 3
  const { availableDistricts, availablePCs, availableACs } = useMemo(
    () =>
      getCascadingGeographyOptions({
        stateId: form.stateId,
        districtId: form.districtId,
        parliamentaryConstituencyId: form.parliamentaryConstituencyId,
        districts,
        constituencies,
      }),
    [
      form.stateId,
      form.districtId,
      form.parliamentaryConstituencyId,
      districts,
      constituencies,
    ]
  );

  // Handlers that clear dependent selections when parent selection changes
  const handleStateChange = (newStateId) => {
    const reconciled = reconcileGeographySelection(
      {
        stateId: newStateId,
        districtId: '',
        parliamentaryConstituencyId: '',
        assemblyConstituencyId: '',
      },
      districts,
      constituencies
    );
    setForm((prev) => ({ ...prev, ...reconciled }));
    setStepErrors({});
  };

  const handleDistrictChange = (newDistrictId) => {
    const reconciled = reconcileGeographySelection(
      {
        stateId: form.stateId,
        districtId: newDistrictId,
        parliamentaryConstituencyId: form.parliamentaryConstituencyId,
        assemblyConstituencyId: '',
      },
      districts,
      constituencies
    );
    setForm((prev) => ({ ...prev, ...reconciled }));
    setStepErrors({});
  };

  const handlePCChange = (newPCId) => {
    const reconciled = reconcileGeographySelection(
      {
        stateId: form.stateId,
        districtId: form.districtId,
        parliamentaryConstituencyId: newPCId,
        assemblyConstituencyId: form.assemblyConstituencyId,
      },
      districts,
      constituencies
    );
    setForm((prev) => ({ ...prev, ...reconciled }));
    setStepErrors({});
  };

  // Step-by-step validation
  const validateStep1 = () => {
    const errs = {};
    if (!form.fullName.trim()) {
      errs.fullName = 'Full name is required.';
    }
    if (!form.dateOfBirth) {
      errs.dateOfBirth = 'Date of birth is required.';
    } else {
      const age = calculateAgeFromDob(form.dateOfBirth);
      if (age < 0) {
        errs.dateOfBirth = 'Please enter a valid date.';
      } else if (age < 18) {
        errs.dateOfBirth =
          'Minimum age of 18 is required for demo eligibility.';
      }
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!form.mobile.trim() || !/^[6-9]\d{9}$/.test(form.mobile.trim())) {
      errs.mobile =
        'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';
    }
    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (!form.epicReference.trim()) {
      errs.epicReference = 'Fictional Demo EPIC / Voter ID reference is required.';
    }
    if (!form.address.trim()) {
      errs.address = 'Residential address is required.';
    }
    if (!form.pinCode.trim() || !/^\d{6}$/.test(form.pinCode.trim())) {
      errs.pinCode = 'Please enter a valid 6-digit PIN code.';
    }
    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = () => {
    const errs = {};
    if (!form.stateId) {
      errs.stateId = 'Please select a State or Union Territory.';
    }
    if (!form.districtId) {
      errs.districtId = 'Please select a District in the chosen State.';
    }
    if (!form.parliamentaryConstituencyId) {
      errs.parliamentaryConstituencyId =
        'Please select your Parliamentary Constituency (Lok Sabha PC).';
    }
    if (!form.assemblyConstituencyId) {
      errs.assemblyConstituencyId =
        'Please select your Assembly Constituency (State Vidhan Sabha AC).';
    }
    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;
    setCurrentStep((prev) => Math.min(4, prev + 1));
  };

  const handlePrevStep = () => {
    setStepErrors({});
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmitRegistration = async (e) => {
    e.preventDefault();
    if (!consentChecked) {
      notifyError(
        'Please check the demonstration consent box before submitting.'
      );
      return;
    }

    if (frontendEnv.isBackendApi) {
      try {
        const payload = {
          fullName: form.fullName.trim(),
          dateOfBirth: form.dateOfBirth,
          gender: form.gender || 'OTHER',
          email: form.email.trim(),
          mobile: form.mobile.trim(),
          epicNumber:
            form.epicReference.trim() ||
            `DEMO-${Date.now().toString().slice(-6)}`,
          address: form.address.trim() || 'Demonstration Address, India',
          pinCode: form.pinCode.trim() || '741101',
          stateId: form.stateId,
          districtId: form.districtId,
          parliamentaryConstituencyId: form.parliamentaryConstituencyId,
          assemblyConstituencyId: form.assemblyConstituencyId,
        };

        const res = await apiClient.auth.register(payload);
        const registered = res.data;
        // Keep local election context synchronized for smooth UI transition
        registerVoter(form);
        setRegisteredVoterResult({
          ...form,
          id: registered.id || registered.userId,
          epicRef: registered.epicNumber,
          fullName: registered.fullName,
        });
        notifySuccess(
          `Voter registration successful! Assigned ID: ${registered.id}`
        );
        return;
      } catch (err) {
        const errorMsg =
          err?.detail ||
          err?.message ||
          'Failed to complete registration on backend.';
        notifyError(errorMsg);
        setStepErrors({ form: errorMsg });
        return;
      }
    }

    const res = registerVoter(form);
    if (!res.ok) {
      const firstErr = res.errors?.[0] || 'Failed to complete registration.';
      notifyError(firstErr);
      setStepErrors(res.fieldErrors || { form: firstErr });
      return;
    }

    setRegisteredVoterResult(res.voter);
    notifySuccess(
      `Demo voter registration successful! Assigned ID: ${res.voter.id}`
    );
  };

  const selectedStateObj = states.find((s) => s.id === form.stateId);
  const selectedDistrictObj = districts.find((d) => d.id === form.districtId);
  const selectedPCObj = constituencies.find(
    (c) => c.id === form.parliamentaryConstituencyId
  );
  const selectedACObj = constituencies.find(
    (c) => c.id === form.assemblyConstituencyId
  );

  // Success Screen after Step 4 Submission
  if (registeredVoterResult) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-sm p-6 sm:p-8 space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold uppercase tracking-wider">
              Local Demonstration Registration Complete
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Welcome, {registeredVoterResult.fullName}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
              Your demonstration voter profile has been created and saved in the
              local browser store with independent Parliamentary and Assembly
              constituency mappings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left bg-slate-50 p-5 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Generated Demo Voter ID</span>
              <strong className="font-mono text-sm text-[#002868]">
                {registeredVoterResult.id}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">
                Demo EPIC Reference (Login ID)
              </span>
              <strong className="font-mono text-sm text-emerald-800">
                {registeredVoterResult.epicReference}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Registered Mobile</span>
              <strong className="font-mono text-slate-900">
                {registeredVoterResult.mobile}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Account Status</span>
              <strong className="text-emerald-700">
                {registeredVoterResult.accountStatus} (LOCAL DEMO)
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">
                Parliamentary Constituency (PC)
              </span>
              <strong className="text-indigo-900">
                {selectedPCObj?.name ||
                  registeredVoterResult.parliamentaryConstituencyId}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">
                Assembly Constituency (AC)
              </span>
              <strong className="text-teal-900">
                {selectedACObj?.name ||
                  registeredVoterResult.assemblyConstituencyId}
              </strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/voter/login')}
              className="px-6 py-3 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-sm font-bold shadow-xs cursor-pointer"
            >
              Proceed to Voter Login &rarr;
            </button>
            <Link
              to="/"
              className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
            >
              Return to Portal Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <img src={eciLogo} alt="ECI" className="h-10 w-auto object-contain" />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
                Phase 3 • Multi-Step Citizen Demo Onboarding
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Demo Voter Registration
              </h1>
            </div>
          </div>
          <Link
            to="/voter/login"
            className="text-xs font-bold text-[#002868] hover:underline"
          >
            Already Registered? Sign In &rarr;
          </Link>
        </div>

        {/* 4-Step Progress Indicator */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {STEPS.map((step) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (step.id < currentStep) {
                    setCurrentStep(step.id);
                  }
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isActive
                    ? 'border-[#002868] bg-blue-50/70'
                    : isCompleted
                    ? 'border-emerald-300 bg-emerald-50/50 cursor-pointer'
                    : 'border-slate-200 bg-slate-50/60 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span
                    className={
                      isActive
                        ? 'text-[#002868]'
                        : isCompleted
                        ? 'text-emerald-800'
                        : 'text-slate-500'
                    }
                  >
                    Step {step.id}
                  </span>
                  {isCompleted && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                  {step.title}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {step.subtitle}
                </p>
              </button>
            );
          })}
        </div>

        {/* Step Content */}
        <form onSubmit={handleSubmitRegistration} className="space-y-6">
          {/* STEP 1: PERSONAL INFORMATION */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                <UserCheck className="w-4 h-4 text-[#002868]" />
                <span>Step 1: Personal Information</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) =>
                      setForm({ ...form, fullName: e.target.value })
                    }
                    placeholder="e.g. Debashis Banerjee"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002868]"
                  />
                  {stepErrors.fullName && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      {stepErrors.fullName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Date of Birth (Minimum Age 18) *
                  </label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) =>
                      setForm({ ...form, dateOfBirth: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002868]"
                  />
                  {stepErrors.dateOfBirth && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      {stepErrors.dateOfBirth}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Gender <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Prefer not to specify (Optional)</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Third Gender">Third Gender / Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="citizen.demo@example.com"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002868]"
                  />
                  {stepErrors.email && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      {stepErrors.email}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    10-Digit Indian Mobile Number *
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    placeholder="98XXXXXXXX"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002868]"
                  />
                  {stepErrors.mobile && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      {stepErrors.mobile}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DEMO IDENTITY & ADDRESS INFORMATION */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                <FileText className="w-4 h-4 text-[#002868]" />
                <span>Step 2: Demo Identity &amp; Residential Address</span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block">
                    Fictional Demo EPIC Reference Notice
                  </strong>
                  Enter any fictional EPIC/Voter ID reference (e.g.,{' '}
                  <code className="font-mono font-bold">DEMO-EPIC-777</code> or{' '}
                  <code className="font-mono font-bold">WBX5566778</code>). This ID is
                  not verified against the official ECI electoral roll, and Aadhaar is
                  never requested.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fictional Demo EPIC / Voter ID Reference *
                  </label>
                  <input
                    type="text"
                    value={form.epicReference}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        epicReference: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g. DEMO-EPIC-777 or WBX5566778"
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                  {stepErrors.epicReference && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      {stepErrors.epicReference}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    6-Digit PIN Code *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={form.pinCode}
                    onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
                    placeholder="e.g. 741101"
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                  {stepErrors.pinCode && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      {stepErrors.pinCode}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Residential Address *
                  </label>
                  <textarea
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="House No, Street, Locality, City/Town"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  {stepErrors.address && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      {stepErrors.address}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: GEOGRAPHICAL & DUAL CONSTITUENCY INFORMATION */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                <MapPin className="w-4 h-4 text-[#002868]" />
                <span>
                  Step 3: Cascading Geographical &amp; Dual Constituency Mapping
                </span>
              </div>

              <p className="text-xs text-slate-600">
                Select your State/UT and District to populate your independent{' '}
                <strong>Parliamentary Constituency (Lok Sabha PC)</strong> and{' '}
                <strong>Assembly Constituency (State Vidhan Sabha AC)</strong>. Changing
                a parent selection automatically clears invalid dependent selections.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    1. State / Union Territory *
                  </label>
                  <select
                    value={form.stateId}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Select State or Union Territory --</option>
                    {states.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.id})
                      </option>
                    ))}
                  </select>
                  {stepErrors.stateId && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      {stepErrors.stateId}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. District *
                  </label>
                  <select
                    disabled={!form.stateId}
                    value={form.districtId}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                  >
                    <option value="">-- Select District --</option>
                    {availableDistricts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.id})
                      </option>
                    ))}
                  </select>
                  {stepErrors.districtId && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      {stepErrors.districtId}
                    </p>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200">
                  <label className="block text-xs font-bold text-indigo-950 mb-1">
                    3. Parliamentary Constituency (Lok Sabha PC) *
                  </label>
                  <select
                    disabled={!form.stateId}
                    value={form.parliamentaryConstituencyId}
                    onChange={(e) => handlePCChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-lg bg-white disabled:bg-slate-100"
                  >
                    <option value="">-- Select Parliamentary Constituency --</option>
                    {availablePCs.map((pc) => (
                      <option key={pc.id} value={pc.id}>
                        {pc.name} ({pc.id})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-indigo-800 mt-1">
                    Used exclusively for nationwide Lok Sabha General Elections.
                  </p>
                  {stepErrors.parliamentaryConstituencyId && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      {stepErrors.parliamentaryConstituencyId}
                    </p>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200">
                  <label className="block text-xs font-bold text-teal-950 mb-1">
                    4. Assembly Constituency (Vidhan Sabha AC) *
                  </label>
                  <select
                    disabled={!form.districtId}
                    value={form.assemblyConstituencyId}
                    onChange={(e) =>
                      setForm({ ...form, assemblyConstituencyId: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-teal-300 rounded-lg bg-white disabled:bg-slate-100"
                  >
                    <option value="">-- Select Assembly Constituency --</option>
                    {availableACs.map((ac) => (
                      <option key={ac.id} value={ac.id}>
                        {ac.name} ({ac.id})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-teal-800 mt-1">
                    Used exclusively for State Legislative Assembly Elections.
                  </p>
                  {stepErrors.assemblyConstituencyId && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      {stepErrors.assemblyConstituencyId}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & CONFIRMATION */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-sm font-bold text-slate-900">
                  Step 4: Review &amp; Confirm Entered Details
                </span>
                <span className="text-xs text-slate-500">
                  Click any Edit button to modify a previous step
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Summary Box 1 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <strong className="text-slate-900">1. Personal Info</strong>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="inline-flex items-center gap-1 text-[#002868] font-bold hover:underline cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                  </div>
                  <p>
                    <span className="text-slate-500">Name:</span>{' '}
                    <strong>{form.fullName}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">DOB:</span>{' '}
                    <strong>{form.dateOfBirth}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Gender:</span>{' '}
                    <strong>{form.gender || 'Not specified'}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Email:</span>{' '}
                    <strong>{form.email}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Mobile:</span>{' '}
                    <strong>{form.mobile}</strong>
                  </p>
                </div>

                {/* Summary Box 2 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <strong className="text-slate-900">2. Demo Identity</strong>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="inline-flex items-center gap-1 text-[#002868] font-bold hover:underline cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                  </div>
                  <p>
                    <span className="text-slate-500">Demo EPIC Ref:</span>{' '}
                    <strong className="font-mono text-[#002868]">
                      {form.epicReference}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-500">PIN Code:</span>{' '}
                    <strong className="font-mono">{form.pinCode}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Address:</span>{' '}
                    <strong>{form.address}</strong>
                  </p>
                </div>

                {/* Summary Box 3 */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <strong className="text-slate-900">3. Geography &amp; Seats</strong>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="inline-flex items-center gap-1 text-[#002868] font-bold hover:underline cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                  </div>
                  <p>
                    <span className="text-slate-500">State / UT:</span>{' '}
                    <strong>{selectedStateObj?.name || form.stateId}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">District:</span>{' '}
                    <strong>{selectedDistrictObj?.name || form.districtId}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Lok Sabha PC:</span>{' '}
                    <strong className="text-indigo-900">
                      {selectedPCObj?.name || form.parliamentaryConstituencyId}
                    </strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Assembly AC:</span>{' '}
                    <strong className="text-teal-900">
                      {selectedACObj?.name || form.assemblyConstituencyId}
                    </strong>
                  </p>
                </div>
              </div>

              {/* Mandatory Demonstration Consent Checkbox */}
              <label className="flex items-start gap-3 p-4 rounded-xl bg-blue-50/70 border border-blue-200 cursor-pointer text-xs text-slate-800">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#002868]"
                />
                <span>
                  <strong className="block text-[#002868] mb-0.5">
                    Local Demonstration Consent (Required)
                  </strong>
                  I understand that this Online Voting System (OVS) registration is a
                  local frontend demonstration and does not establish official
                  electoral-roll enrolment with the Election Commission of India.
                </span>
              </label>

              {stepErrors.form && (
                <p className="text-xs text-red-600 font-semibold">
                  {stepErrors.form}
                </p>
              )}
            </div>
          )}

          {/* Step Navigation Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous Step
              </button>
            ) : (
              <Link
                to="/voter/login"
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </Link>
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <span>Continue to Step {currentStep + 1}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#138808] hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Demo Voter Registration</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
