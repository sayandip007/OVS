import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../services/apiClient';
import {
  ADMIN_PERMISSION_KEYS,
  hasAdminPermission,
} from '../../services/adminPermissionService';
import {
  MapPin,
  CalendarClock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Plus,
  Send,
  RotateCcw,
  Clock,
} from 'lucide-react';

const MILESTONE_TYPES = [
  'NOMINATION_OPEN',
  'NOMINATION_DEADLINE',
  'NOMINATION_SCRUTINY',
  'WITHDRAWAL_DEADLINE',
  'CAMPAIGN_START',
  'CAMPAIGN_END',
  'POLLING_START',
  'POLLING_END',
  'COUNTING_START',
  'RESULT_PUBLICATION',
];

const MILESTONE_LABELS = {
  NOMINATION_OPEN: 'Nomination Open',
  NOMINATION_DEADLINE: 'Nomination Deadline',
  NOMINATION_SCRUTINY: 'Nomination Scrutiny',
  WITHDRAWAL_DEADLINE: 'Withdrawal Deadline',
  CAMPAIGN_START: 'Campaign Start',
  CAMPAIGN_END: 'Campaign End (Silence)',
  POLLING_START: 'Polling Start',
  POLLING_END: 'Polling End',
  COUNTING_START: 'Counting Start',
  RESULT_PUBLICATION: 'Result Publication',
};

const REVIEW_BADGE_STYLES = {
  DRAFT: 'bg-slate-100 text-slate-800 border-slate-200',
  SUBMITTED_FOR_REVIEW: 'bg-amber-50 text-amber-900 border-amber-200',
  UNDER_REVIEW: 'bg-indigo-50 text-indigo-900 border-indigo-200',
  APPROVED: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  RETURNED_FOR_CORRECTION: 'bg-rose-50 text-rose-900 border-rose-200',
};

function toLocalDatetimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoOffsetString(localValue) {
  if (!localValue) return null;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function BackendElectionConfigPanel({
  electionId,
  election,
  initialTab = 'CONSTITUENCIES',
  onConfigUpdated,
}) {
  const { currentAdmin, adminCsrfToken } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Constituencies state
  const [assigned, setAssigned] = useState([]);
  const [available, setAvailable] = useState([]);
  const [constituencySearch, setConstituencySearch] = useState('');
  const [selectedAvailableIds, setSelectedAvailableIds] = useState([]);
  const [bulkNote, setBulkNote] = useState('');
  const [bulkPreview, setBulkPreview] = useState(null);
  const [constituencyHistory, setConstituencyHistory] = useState([]);

  // Schedule state
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [scheduleVersion, setScheduleVersion] = useState(1);
  const [milestonesMap, setMilestonesMap] = useState({});
  const [scheduleNote, setScheduleNote] = useState('');
  const [scheduleValidation, setScheduleValidation] = useState(null);
  const [scheduleHistory, setScheduleHistory] = useState([]);

  // Readiness & Review state
  const [readiness, setReadiness] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [returnReason, setReturnReason] = useState('');

  const canManageConstituencies = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONSTITUENCIES_MANAGE
  );
  const canBulkManageConstituencies = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONSTITUENCIES_BULK_MANAGE
  );
  const canManageSchedule = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.ELECTIONS_SCHEDULE_MANAGE
  );
  const canSubmitConfig = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONFIG_SUBMIT
  );
  const canReviewConfig = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONFIG_REVIEW
  );
  const canApproveConfig = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.ELECTIONS_CONFIG_APPROVE
  );

  const loadConstituencyData = useCallback(async () => {
    if (!electionId) return;
    setLoading(true);
    try {
      const [assignedRes, availableRes, historyRes] = await Promise.all([
        apiClient.admin.elections.listConstituencies(electionId, {
          limit: 100,
          search: constituencySearch || undefined,
        }),
        apiClient.admin.elections.listAvailableConstituencies(electionId, {
          limit: 100,
          search: constituencySearch || undefined,
        }),
        apiClient.admin.elections.constituencyHistory(electionId, { limit: 25 }),
      ]);
      setAssigned(assignedRes?.data || []);
      setAvailable(availableRes?.data || []);
      setConstituencyHistory(historyRes?.data || []);
    } catch (err) {
      notifyError(err?.message || 'Failed to load constituency configuration.');
    } finally {
      setLoading(false);
    }
  }, [electionId, constituencySearch, notifyError]);

  const loadScheduleData = useCallback(async () => {
    if (!electionId) return;
    setLoading(true);
    try {
      const [schedRes, histRes] = await Promise.all([
        apiClient.admin.elections.getSchedule(electionId),
        apiClient.admin.elections.scheduleHistory(electionId, { limit: 25 }),
      ]);
      const data = schedRes?.data;
      if (data) {
        setTimezone(data.timezone || 'Asia/Kolkata');
        setScheduleVersion(data.scheduleVersion || 1);
        setScheduleValidation(data.validation || null);
        const map = {};
        for (const type of MILESTONE_TYPES) {
          const found = (data.milestones || []).find((m) => m.milestoneType === type);
          map[type] = {
            milestoneType: type,
            startAtLocal: found?.startAt ? toLocalDatetimeInput(found.startAt) : '',
            endAtLocal: found?.endAt ? toLocalDatetimeInput(found.endAt) : '',
            status: found?.status || 'CONFIGURED',
            note: found?.note || '',
          };
        }
        setMilestonesMap(map);
      }
      setScheduleHistory(histRes?.data || []);
    } catch (err) {
      notifyError(err?.message || 'Failed to load election schedule.');
    } finally {
      setLoading(false);
    }
  }, [electionId, notifyError]);

  const loadReadinessData = useCallback(async () => {
    if (!electionId) return;
    setLoading(true);
    try {
      const res = await apiClient.admin.elections.validateConfig(electionId);
      setReadiness(res?.data || null);
    } catch (err) {
      notifyError(err?.message || 'Failed to validate election configuration.');
    } finally {
      setLoading(false);
    }
  }, [electionId, notifyError]);

  useEffect(() => {
    if (activeTab === 'CONSTITUENCIES') {
      loadConstituencyData();
    } else if (activeTab === 'SCHEDULE') {
      loadScheduleData();
    } else if (activeTab === 'REVIEW') {
      loadReadinessData();
    }
  }, [activeTab, loadConstituencyData, loadScheduleData, loadReadinessData]);

  const handleToggleAvailable = (id) => {
    setSelectedAvailableIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setBulkPreview(null);
  };

  const handleSingleAssign = async (constituencyId) => {
    setBusy(true);
    try {
      await apiClient.admin.elections.assignConstituency(
        electionId,
        { constituencyId, note: bulkNote || 'Assigned via admin console' },
        adminCsrfToken
      );
      notifySuccess(`Constituency ${constituencyId} assigned.`);
      await loadConstituencyData();
      onConfigUpdated?.();
    } catch (err) {
      notifyError(err?.message || 'Could not assign constituency.');
    } finally {
      setBusy(false);
    }
  };

  const handlePreviewBulk = async () => {
    if (selectedAvailableIds.length === 0) return;
    setBusy(true);
    try {
      const res = await apiClient.admin.elections.previewBulkConstituencies(
        electionId,
        { constituencyIds: selectedAvailableIds },
        adminCsrfToken
      );
      setBulkPreview(res?.data || null);
    } catch (err) {
      notifyError(err?.message || 'Bulk preview failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleBulkCommit = async () => {
    if (selectedAvailableIds.length === 0) return;
    setBusy(true);
    try {
      const res = await apiClient.admin.elections.bulkAssignConstituencies(
        electionId,
        {
          constituencyIds: selectedAvailableIds,
          note: bulkNote || 'Bulk assigned via admin console',
        },
        adminCsrfToken
      );
      notifySuccess(
        `Assigned ${res?.data?.assignedCount || selectedAvailableIds.length} constituencies.`
      );
      setSelectedAvailableIds([]);
      setBulkPreview(null);
      setBulkNote('');
      await loadConstituencyData();
      onConfigUpdated?.();
    } catch (err) {
      notifyError(err?.message || 'Bulk assignment failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveConstituency = async (constituencyId) => {
    setBusy(true);
    try {
      await apiClient.admin.elections.removeConstituency(
        electionId,
        constituencyId,
        adminCsrfToken
      );
      notifySuccess(`Removed constituency ${constituencyId}.`);
      await loadConstituencyData();
      onConfigUpdated?.();
    } catch (err) {
      notifyError(err?.message || 'Could not remove constituency.');
    } finally {
      setBusy(false);
    }
  };

  const handleMilestoneFieldChange = (type, field, value) => {
    setMilestonesMap((prev) => ({
      ...prev,
      [type]: {
        ...(prev[type] || { milestoneType: type, status: 'CONFIGURED', note: '' }),
        [field]: value,
      },
    }));
  };

  const handleSaveSchedule = async () => {
    const milestones = MILESTONE_TYPES.map((type) => {
      const row = milestonesMap[type] || {};
      const startIso = toIsoOffsetString(row.startAtLocal);
      const endIso = toIsoOffsetString(row.endAtLocal);
      if (!startIso && !endIso) return null;
      return {
        milestoneType: type,
        startAt: startIso,
        endAt: endIso,
        timezone,
        status: row.status || 'CONFIGURED',
        note: row.note || '',
      };
    }).filter(Boolean);

    if (milestones.length === 0) {
      notifyError('Configure at least one milestone timestamp before saving.');
      return;
    }

    setBusy(true);
    try {
      const res = await apiClient.admin.elections.putSchedule(
        electionId,
        {
          timezone,
          milestones,
          note: scheduleNote || 'Schedule updated via admin console',
          expectedScheduleVersion: scheduleVersion,
        },
        adminCsrfToken
      );
      notifySuccess('Election schedule saved (UTC normalized).');
      setScheduleVersion(res?.data?.scheduleVersion || scheduleVersion + 1);
      setScheduleValidation(res?.data?.validation || null);
      await loadScheduleData();
      onConfigUpdated?.();
    } catch (err) {
      notifyError(err?.message || 'Failed to save election schedule.');
    } finally {
      setBusy(false);
    }
  };

  const handleValidateSchedule = async () => {
    setBusy(true);
    try {
      const res = await apiClient.admin.elections.validateSchedule(
        electionId,
        adminCsrfToken
      );
      setScheduleValidation(res?.data || null);
      if (res?.data?.valid) {
        notifySuccess('Schedule passed all chronological and mandatory checks.');
      } else {
        notifyError('Schedule has validation issues. Review details below.');
      }
    } catch (err) {
      notifyError(err?.message || 'Failed to validate schedule.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfigReviewAction = async (action) => {
    setBusy(true);
    try {
      if (action === 'submit') {
        await apiClient.admin.elections.submitConfig(
          electionId,
          { note: reviewNote },
          adminCsrfToken
        );
        notifySuccess('Configuration submitted for review.');
      } else if (action === 'review') {
        await apiClient.admin.elections.reviewConfig(
          electionId,
          { note: reviewNote },
          adminCsrfToken
        );
        notifySuccess('Configuration marked as under review.');
      } else if (action === 'approve') {
        await apiClient.admin.elections.approveConfig(
          electionId,
          { note: reviewNote },
          adminCsrfToken
        );
        notifySuccess('Election configuration approved.');
      } else if (action === 'return') {
        if (!returnReason || returnReason.trim().length < 5) {
          notifyError('Provide a return reason (at least 5 characters).');
          setBusy(false);
          return;
        }
        await apiClient.admin.elections.returnConfig(
          electionId,
          { reason: returnReason.trim() },
          adminCsrfToken
        );
        notifySuccess('Configuration returned for correction.');
      }
      setReviewNote('');
      setReturnReason('');
      await loadReadinessData();
      onConfigUpdated?.();
    } catch (err) {
      notifyError(err?.message || 'Configuration review action failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!electionId) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            Phase 8.7 Configuration: Constituencies, Schedule & Review
          </h2>
          <p className="text-xs text-slate-500">
            Election {electionId}{' '}
            {election?.type ? `• ${election.type.replace('_', ' ')}` : ''} •{' '}
            Educational DEMO_SAMPLE Sandbox
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('CONSTITUENCIES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'CONSTITUENCIES'
                ? 'bg-[#002868] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Constituencies ({assigned.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SCHEDULE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'SCHEDULE'
                ? 'bg-[#002868] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Schedule (v{scheduleVersion})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('REVIEW')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'REVIEW'
                ? 'bg-[#002868] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Readiness & Review
          </button>
        </div>
      </div>

      {/* CONSTITUENCIES TAB */}
      {activeTab === 'CONSTITUENCIES' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              type="text"
              value={constituencySearch}
              onChange={(e) => setConstituencySearch(e.target.value)}
              placeholder="Search constituencies by ID or name..."
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs w-full sm:w-72"
            />
            <button
              type="button"
              onClick={loadConstituencyData}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Assigned List */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Assigned Constituencies ({assigned.length})
              </h3>
              {assigned.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  No constituencies assigned to this election yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {assigned.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {item.constituency?.name || item.constituencyId}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.constituencyId} • {item.constituencyType} • State:{' '}
                          {item.constituency?.stateId}
                          {item.hasNominations ? ' • Has Nominations' : ''}
                        </p>
                      </div>
                      {canManageConstituencies && (
                        <button
                          type="button"
                          disabled={busy || item.hasNominations}
                          title={
                            item.hasNominations
                              ? 'Cannot remove constituency with candidate nominations'
                              : 'Remove constituency'
                          }
                          onClick={() => handleRemoveConstituency(item.constituencyId)}
                          className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available List & Bulk Assign */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Available Eligible Constituencies ({available.length})
                </h3>
                {selectedAvailableIds.length > 0 && (
                  <span className="text-[11px] font-bold text-[#002868]">
                    {selectedAvailableIds.length} selected
                  </span>
                )}
              </div>

              {available.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  All eligible constituencies for this election scope are assigned.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {available.map((item) => {
                    const checked = selectedAvailableIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                      >
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleAvailable(item.id)}
                          />
                          <div>
                            <p className="font-bold text-slate-900">{item.name}</p>
                            <p className="text-[11px] text-slate-500">
                              {item.id} • {item.constituencyType} • State: {item.stateId}
                            </p>
                          </div>
                        </label>
                        {canManageConstituencies && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleSingleAssign(item.id)}
                            className="px-2 py-1 rounded-lg bg-[#002868] text-white text-[11px] font-bold flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Assign
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {canBulkManageConstituencies && selectedAvailableIds.length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <input
                    type="text"
                    value={bulkNote}
                    onChange={(e) => setBulkNote(e.target.value)}
                    placeholder="Optional audit note for bulk assignment..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handlePreviewBulk}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold"
                    >
                      Preview Bulk ({selectedAvailableIds.length})
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleBulkCommit}
                      className="px-3 py-1.5 rounded-lg bg-[#002868] text-white text-xs font-bold"
                    >
                      Commit Bulk Assignment
                    </button>
                  </div>
                </div>
              )}

              {bulkPreview && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <p className="font-bold text-slate-900">
                    Bulk Preview: {bulkPreview.validCount} valid, {bulkPreview.invalidCount} invalid
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {bulkPreview.rows.map((row, idx) => (
                      <div key={`${row.constituencyId}-${idx}`} className="flex justify-between">
                        <span className="font-mono">{row.constituencyId}</span>
                        <span className={row.valid ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                          {row.code}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Constituency Assignment History */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Constituency Assignment History ({constituencyHistory.length})
            </h3>
            {constituencyHistory.length === 0 ? (
              <p className="text-xs text-slate-500">No constituency changes recorded yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
                {constituencyHistory.map((h) => (
                  <div key={h.id} className="p-2 rounded-lg bg-slate-50 flex justify-between gap-2">
                    <span>
                      <strong>{h.action}</strong> • {h.constituencyId} ({h.constituencyType})
                      {h.note ? ` — ${h.note}` : ''}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(h.changedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCHEDULE TAB */}
      {activeTab === 'SCHEDULE' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700">Timezone (IANA):</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={!canManageSchedule}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
              </select>
              <span className="text-[11px] font-mono bg-slate-100 px-2 py-1 rounded">
                Version {scheduleVersion}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleValidateSchedule}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold"
              >
                Validate Schedule
              </button>
              {canManageSchedule && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveSchedule}
                  className="px-4 py-1.5 rounded-xl bg-[#002868] text-white text-xs font-bold"
                >
                  Save Schedule (UTC)
                </button>
              )}
            </div>
          </div>

          {scheduleValidation && (
            <div
              className={`p-3 rounded-xl border text-xs ${
                scheduleValidation.valid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <p className="font-bold flex items-center gap-1.5">
                {scheduleValidation.valid ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {scheduleValidation.valid
                  ? 'Schedule is valid and chronologically ordered.'
                  : `${scheduleValidation.issues?.length || 0} schedule issue(s) detected`}
              </p>
              {scheduleValidation.issues?.length > 0 && (
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                  {scheduleValidation.issues.map((iss, idx) => (
                    <li key={idx}>
                      [{iss.code}] {iss.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-2.5">
            {MILESTONE_TYPES.map((type) => {
              const row = milestonesMap[type] || {};
              return (
                <div
                  key={type}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="md:col-span-3 font-bold text-slate-800">
                    {MILESTONE_LABELS[type] || type}
                  </div>
                  <div className="md:col-span-4">
                    <input
                      type="datetime-local"
                      value={row.startAtLocal || ''}
                      disabled={!canManageSchedule}
                      onChange={(e) =>
                        handleMilestoneFieldChange(type, 'startAtLocal', e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <select
                      value={row.status || 'CONFIGURED'}
                      disabled={!canManageSchedule}
                      onChange={(e) =>
                        handleMilestoneFieldChange(type, 'status', e.target.value)
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="CONFIGURED">CONFIGURED</option>
                      <option value="COMPLETED">COMPLETED</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <input
                      type="text"
                      value={row.note || ''}
                      disabled={!canManageSchedule}
                      placeholder="Milestone note..."
                      onChange={(e) =>
                        handleMilestoneFieldChange(type, 'note', e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {canManageSchedule && (
            <input
              type="text"
              value={scheduleNote}
              onChange={(e) => setScheduleNote(e.target.value)}
              placeholder="Audit note for schedule revision..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          )}

          {/* Schedule History */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Schedule Revision History ({scheduleHistory.length})
            </h3>
            {scheduleHistory.length === 0 ? (
              <p className="text-xs text-slate-500">No schedule history recorded yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
                {scheduleHistory.map((h) => (
                  <div key={h.id} className="p-2 rounded-lg bg-slate-50 flex justify-between gap-2">
                    <span>
                      <strong>{h.action}</strong> (v{h.scheduleVersion})
                      {h.milestoneType ? ` • ${h.milestoneType}` : ''}
                      {h.note ? ` — ${h.note}` : ''}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(h.changedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REVIEW & READINESS TAB */}
      {activeTab === 'REVIEW' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                Configuration Review Status:
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                  REVIEW_BADGE_STYLES[
                    readiness?.configReviewStatus ||
                      election?.configReviewStatus ||
                      'DRAFT'
                  ] || REVIEW_BADGE_STYLES.DRAFT
                }`}
              >
                {readiness?.configReviewStatus ||
                  election?.configReviewStatus ||
                  'DRAFT'}
              </span>
            </div>
            <button
              type="button"
              onClick={loadReadinessData}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
            >
              Re-run Readiness Check
            </button>
          </div>

          {readiness && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                readiness.ready
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <p className="font-bold text-sm">
                {readiness.ready
                  ? 'Configuration is READY for review & approval.'
                  : 'Configuration is NOT YET READY (non-mutating check).'}
              </p>
              <p>
                Assigned Constituencies: <strong>{readiness.assignedConstituenciesCount}</strong> •
                Configured Milestones: <strong>{readiness.configuredMilestonesCount}</strong>
              </p>
              {readiness.issues?.length > 0 && (
                <ul className="list-disc ml-5 space-y-1">
                  {readiness.issues.map((iss, idx) => (
                    <li key={idx}>
                      [{iss.code}] {iss.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">
                Review / Submission Note
              </label>
              <input
                type="text"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Optional note for submit, review, or approve..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
              <div className="flex flex-wrap gap-2">
                {canSubmitConfig && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleConfigReviewAction('submit')}
                    className="px-3 py-2 rounded-xl bg-[#002868] text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit for Review
                  </button>
                )}
                {canReviewConfig && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleConfigReviewAction('review')}
                    className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                  >
                    Start Review
                  </button>
                )}
                {canApproveConfig && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleConfigReviewAction('approve')}
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                  >
                    Approve Configuration
                  </button>
                )}
              </div>
            </div>

            {canReviewConfig && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">
                  Return for Correction Reason (min 5 chars)
                </label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Describe why configuration must be corrected..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleConfigReviewAction('return')}
                  className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Return for Correction
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
