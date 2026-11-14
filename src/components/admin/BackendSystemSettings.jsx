import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  ADMIN_PERMISSION_KEYS,
  hasAdminPermission,
} from '../../services/adminPermissionService';
import Modal from '../common/Modal';
import {
  Settings,
  Sliders,
  ShieldAlert,
  Activity,
  RotateCcw,
  History,
  AlertTriangle,
  CheckCircle2,
  Save,
  RefreshCw,
  Power,
  Lock,
  Layers,
  Database,
  Cpu,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';

const CATEGORY_TABS = [
  { id: 'ALL', label: 'All Settings' },
  { id: 'PLATFORM', label: 'Platform' },
  { id: 'ELECTION_OPERATIONS', label: 'Election Ops' },
  { id: 'VOTING', label: 'Voting' },
  { id: 'SECURITY', label: 'Security' },
  { id: 'NOTIFICATIONS', label: 'Notifications' },
  { id: 'DEMO_SIMULATION', label: 'Simulation' },
];

export default function BackendSystemSettings() {
  const { currentAdmin } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [activeTab, setActiveTab] = useState('settings'); // settings | features | maintenance | diagnostics
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const [settings, setSettings] = useState([]);
  const [featureFlags, setFeatureFlags] = useState([]);
  const [maintenance, setMaintenance] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshingDiagnostics, setRefreshingDiagnostics] = useState(false);

  // Edit Setting Modal State
  const [editSettingModalOpen, setEditSettingModalOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [savingSetting, setSavingSetting] = useState(false);

  // History Drawer State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyKey, setHistoryKey] = useState('');
  const [historyType, setHistoryType] = useState('setting'); // setting | feature

  // Rollback Modal State
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollingBack, setRollingBack] = useState(false);

  // Feature Flag Edit State
  const [editFlagModalOpen, setEditFlagModalOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState(null);
  const [flagEnabled, setFlagEnabled] = useState(false);
  const [flagRollout, setFlagRollout] = useState(0);
  const [flagRoles, setFlagRoles] = useState([]);
  const [flagReason, setFlagReason] = useState('');
  const [savingFlag, setSavingFlag] = useState(false);

  // Maintenance State
  const [mState, setMState] = useState('NORMAL');
  const [mMessage, setMMessage] = useState('');
  const [mStartAt, setMStartAt] = useState('');
  const [mEndAt, setMEndAt] = useState('');
  const [mEmergency, setMEmgency] = useState(false);
  const [mReason, setMReason] = useState('');
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  // Permissions
  const canManageSettings = useMemo(
    () => hasAdminPermission(currentAdmin, ADMIN_PERMISSION_KEYS.SETTINGS_MANAGE),
    [currentAdmin]
  );
  const canRollbackSettings = useMemo(
    () => hasAdminPermission(currentAdmin, ADMIN_PERMISSION_KEYS.SETTINGS_ROLLBACK),
    [currentAdmin]
  );
  const canManageFeatures = useMemo(
    () => hasAdminPermission(currentAdmin, ADMIN_PERMISSION_KEYS.FEATURES_MANAGE),
    [currentAdmin]
  );
  const canManageMaintenance = useMemo(
    () => hasAdminPermission(currentAdmin, ADMIN_PERMISSION_KEYS.MAINTENANCE_MANAGE),
    [currentAdmin]
  );
  const canReadDiagnostics = useMemo(
    () => hasAdminPermission(currentAdmin, ADMIN_PERMISSION_KEYS.DIAGNOSTICS_READ),
    [currentAdmin]
  );

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, featuresRes, maintRes] = await Promise.all([
        apiClient.admin.settings.list(),
        apiClient.admin.features.list(),
        apiClient.admin.maintenance.getStatus(),
      ]);

      if (settingsRes?.data?.settings) setSettings(settingsRes.data.settings);
      if (featuresRes?.data?.flags) setFeatureFlags(featuresRes.data.flags);
      if (maintRes?.data?.maintenance) {
        setMaintenance(maintRes.data.maintenance);
        setMState(maintRes.data.maintenance.state);
        setMMessage(maintRes.data.maintenance.message || '');
        setMStartAt(
          maintRes.data.maintenance.startAt
            ? new Date(maintRes.data.maintenance.startAt).toISOString().slice(0, 16)
            : ''
        );
        setMEndAt(
          maintRes.data.maintenance.endAt
            ? new Date(maintRes.data.maintenance.endAt).toISOString().slice(0, 16)
            : ''
        );
        setMEmgency(Boolean(maintRes.data.maintenance.isEmergency));
      }

      if (canReadDiagnostics) {
        const diagRes = await apiClient.admin.diagnostics.get().catch(() => null);
        if (diagRes?.data?.diagnostics) {
          setDiagnostics(diagRes.data.diagnostics);
        }
      }
    } catch (err) {
      notifyError(err.message || 'Failed to load system settings and configuration.');
    } finally {
      setLoading(false);
    }
  }, [canReadDiagnostics, notifyError]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRefreshDiagnostics = async () => {
    setRefreshingDiagnostics(true);
    try {
      const res = await apiClient.admin.diagnostics.get();
      if (res?.data?.diagnostics) {
        setDiagnostics(res.data.diagnostics);
        notifySuccess('Diagnostics data refreshed.');
      }
    } catch (err) {
      notifyError(err.message || 'Failed to refresh system diagnostics.');
    } finally {
      setRefreshingDiagnostics(false);
    }
  };

  // Open Edit Setting Modal
  const openEditSetting = (setting) => {
    setEditingSetting(setting);
    if (setting.valueType === 'JSON') {
      setEditValue(
        typeof setting.value === 'string'
          ? setting.value
          : JSON.stringify(setting.value, null, 2)
      );
    } else {
      setEditValue(String(setting.value));
    }
    setEditReason('');
    setEditSettingModalOpen(true);
  };

  // Save Setting
  const handleSaveSetting = async () => {
    if (!editingSetting) return;
    if (!editReason.trim() || editReason.trim().length < 3) {
      notifyError('A change reason of at least 3 characters is mandatory for audit trail.');
      return;
    }

    setSavingSetting(true);
    try {
      let parsedValue = editValue;
      if (editingSetting.valueType === 'BOOLEAN') {
        parsedValue = editValue === 'true' || editValue === true;
      } else if (editingSetting.valueType === 'NUMBER') {
        parsedValue = Number(editValue);
      } else if (editingSetting.valueType === 'JSON') {
        parsedValue = JSON.parse(editValue);
      }

      const res = await apiClient.admin.settings.update(editingSetting.key, {
        value: parsedValue,
        expectedVersion: editingSetting.version,
        changeReason: editReason.trim(),
      });

      if (res?.data?.setting) {
        notifySuccess(`Setting '${editingSetting.key}' updated to version ${res.data.setting.version}.`);
        setEditSettingModalOpen(false);
        fetchAllData();
      }
    } catch (err) {
      notifyError(err.message || 'Failed to update setting.');
    } finally {
      setSavingSetting(false);
    }
  };

  // View Setting History
  const handleViewSettingHistory = async (key) => {
    try {
      setHistoryKey(key);
      setHistoryType('setting');
      const res = await apiClient.admin.settings.getHistory(key);
      if (res?.data?.history) {
        setHistoryItems(res.data.history);
        setHistoryModalOpen(true);
      }
    } catch (err) {
      notifyError(err.message || 'Failed to load setting version history.');
    }
  };

  // Open Rollback Modal
  const openRollbackModal = (item) => {
    setRollbackTarget(item);
    setRollbackReason('');
    setRollbackModalOpen(true);
  };

  // Execute Rollback
  const handleExecuteRollback = async () => {
    if (!rollbackTarget) return;
    if (!rollbackReason.trim() || rollbackReason.trim().length < 3) {
      notifyError('A rollback reason of at least 3 characters is mandatory.');
      return;
    }

    setRollingBack(true);
    try {
      const res = await apiClient.admin.settings.rollback(rollbackTarget.settingKey, {
        targetVersion: rollbackTarget.version,
        changeReason: rollbackReason.trim(),
      });

      if (res?.data?.setting) {
        notifySuccess(
          `Setting '${rollbackTarget.settingKey}' rolled back to version ${rollbackTarget.version}.`
        );
        setRollbackModalOpen(false);
        setHistoryModalOpen(false);
        fetchAllData();
      }
    } catch (err) {
      notifyError(err.message || 'Failed to rollback setting version.');
    } finally {
      setRollingBack(false);
    }
  };

  // Feature Flag Edit
  const openEditFlag = (flag) => {
    setEditingFlag(flag);
    setFlagEnabled(Boolean(flag.isEnabled));
    setFlagRollout(flag.rolloutPercentage ?? 0);
    setFlagRoles(Array.isArray(flag.targetRoles) ? flag.targetRoles : []);
    setFlagReason('');
    setEditFlagModalOpen(true);
  };

  // Save Feature Flag
  const handleSaveFlag = async () => {
    if (!editingFlag) return;
    if (!flagReason.trim() || flagReason.trim().length < 3) {
      notifyError('A change reason of at least 3 characters is mandatory.');
      return;
    }

    setSavingFlag(true);
    try {
      const res = await apiClient.admin.features.update(editingFlag.key, {
        isEnabled: flagEnabled,
        rolloutPercentage: Number(flagRollout),
        targetRoles: flagRoles,
        changeReason: flagReason.trim(),
      });

      if (res?.data?.flag) {
        notifySuccess(`Feature flag '${editingFlag.key}' updated successfully.`);
        setEditFlagModalOpen(false);
        fetchAllData();
      }
    } catch (err) {
      notifyError(err.message || 'Failed to update feature flag.');
    } finally {
      setSavingFlag(false);
    }
  };

  // View Feature Flag History
  const handleViewFlagHistory = async (key) => {
    try {
      setHistoryKey(key);
      setHistoryType('feature');
      const res = await apiClient.admin.features.getHistory(key);
      if (res?.data?.history) {
        setHistoryItems(res.data.history);
        setHistoryModalOpen(true);
      }
    } catch (err) {
      notifyError(err.message || 'Failed to load feature flag history.');
    }
  };

  // Save Maintenance State
  const handleSaveMaintenance = async () => {
    if (!mReason.trim() || mReason.trim().length < 3) {
      notifyError('A maintenance transition reason of at least 3 characters is mandatory.');
      return;
    }

    setSavingMaintenance(true);
    try {
      const payload = {
        state: mState,
        message: mMessage.trim() || 'System maintenance in progress. Please check back later.',
        startAt: mStartAt ? new Date(mStartAt).toISOString() : null,
        endAt: mEndAt ? new Date(mEndAt).toISOString() : null,
        isEmergency: mEmergency,
        reason: mReason.trim(),
      };

      const res = await apiClient.admin.maintenance.update(payload);
      if (res?.data?.maintenance) {
        notifySuccess(`System maintenance state transitioned to ${res.data.maintenance.state}.`);
        setMaintenance(res.data.maintenance);
        setMReason('');
        fetchAllData();
      }
    } catch (err) {
      notifyError(err.message || 'Failed to update maintenance schedule.');
    } finally {
      setSavingMaintenance(false);
    }
  };

  const filteredSettings = useMemo(() => {
    if (selectedCategory === 'ALL') return settings;
    return settings.filter((s) => s.category === selectedCategory);
  }, [settings, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                System Settings & Platform Administration
              </h1>
              <p className="text-sm text-slate-500">
                Centralized operational defaults, feature flag rollout, maintenance mode engine, and diagnostic telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Global Status Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {maintenance && (
            <div
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
                maintenance.state === 'NORMAL'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : maintenance.state === 'SCHEDULED_MAINTENANCE'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : maintenance.state === 'READ_ONLY_MODE'
                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              Mode: {maintenance.state}
            </div>
          )}

          {diagnostics && (
            <div
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
                diagnostics.status === 'HEALTHY'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : diagnostics.status === 'DEGRADED'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Health: {diagnostics.status} ({diagnostics.database.latencyMs}ms)
            </div>
          )}

          <button
            onClick={fetchAllData}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            title="Reload Settings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-200 flex gap-2">
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'settings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Platform Settings ({settings.length})
        </button>
        <button
          onClick={() => setActiveTab('features')}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'features'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          Feature Flags ({featureFlags.length})
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'maintenance'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Maintenance Mode
        </button>
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'diagnostics'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          Operational Health & Diagnostics
        </button>
      </div>

      {/* TAB 1: Platform Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  selectedCategory === tab.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Settings Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-700 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Setting Key</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Current Value</th>
                    <th className="px-5 py-3.5">Version</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSettings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        No settings found in this category.
                      </td>
                    </tr>
                  ) : (
                    filteredSettings.map((s) => (
                      <tr key={s.key} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900 font-mono text-xs">
                            {s.key}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {s.description}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {s.isPublic && (
                              <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded text-[10px] font-medium border border-sky-100">
                                Public
                              </span>
                            )}
                            {s.isSensitive && (
                              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-medium border border-amber-100">
                                Sensitive
                              </span>
                            )}
                            {!s.isEditable && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200">
                                Read Only
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                            {s.category}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-mono text-slate-600">{s.valueType}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-mono text-xs max-w-xs truncate bg-slate-50 p-1.5 rounded border border-slate-200 text-slate-800">
                            {s.valueType === 'BOOLEAN' ? (
                              <span
                                className={`font-semibold ${
                                  s.value ? 'text-emerald-700' : 'text-slate-500'
                                }`}
                              >
                                {String(s.value)}
                              </span>
                            ) : s.valueType === 'JSON' ? (
                              typeof s.value === 'string'
                                ? s.value
                                : JSON.stringify(s.value)
                            ) : (
                              String(s.value)
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            v{s.version}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewSettingHistory(s.key)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                              title="Version History"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            {canManageSettings && s.isEditable && (
                              <button
                                onClick={() => openEditSetting(s)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Feature Flags */}
      {activeTab === 'features' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-700 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Feature Flag Key</th>
                    <th className="px-5 py-3.5">State</th>
                    <th className="px-5 py-3.5">Rollout</th>
                    <th className="px-5 py-3.5">Target Roles</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {featureFlags.map((flag) => (
                    <tr key={flag.key} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 font-mono text-xs">
                          {flag.key}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{flag.description}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            flag.isEnabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {flag.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${flag.rolloutPercentage}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-slate-700">
                            {flag.rolloutPercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {flag.targetRoles && flag.targetRoles.length > 0 ? (
                            flag.targetRoles.map((role) => (
                              <span
                                key={role}
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono"
                              >
                                {role}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">All Roles</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewFlagHistory(flag.key)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                            title="Flag History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {canManageFeatures && (
                            <button
                              onClick={() => openEditFlag(flag)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                            >
                              Configure
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Maintenance Mode */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          {/* Status Display Card */}
          <div
            className={`rounded-2xl border p-6 ${
              mState === 'NORMAL'
                ? 'bg-emerald-50/60 border-emerald-200'
                : mState === 'SCHEDULED_MAINTENANCE'
                ? 'bg-amber-50/60 border-amber-200'
                : mState === 'READ_ONLY_MODE'
                ? 'bg-sky-50/60 border-sky-200'
                : 'bg-rose-50/60 border-rose-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Current System Availability Mode
                </span>
                <h2 className="text-2xl font-black mt-1 text-slate-900">{mState}</h2>
                <p className="text-sm text-slate-600 mt-1 max-w-xl">
                  {maintenance?.message || 'System operational.'}
                </p>
                {maintenance?.startAt && (
                  <div className="mt-3 text-xs text-slate-600 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Window: {new Date(maintenance.startAt).toLocaleString()} —{' '}
                      {maintenance.endAt
                        ? new Date(maintenance.endAt).toLocaleString()
                        : 'Indefinite'}
                    </span>
                  </div>
                )}
              </div>

              {mEmergency && (
                <span className="px-3 py-1 bg-red-600 text-white font-bold text-xs rounded-full uppercase tracking-wider">
                  Emergency Mode Active
                </span>
              )}
            </div>
          </div>

          {/* Controller Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <h3 className="font-bold text-slate-900 text-base">Transition Maintenance Mode</h3>
            <p className="text-xs text-slate-500">
              Only Super Administrators can update or transition maintenance states. During Active Maintenance, all non-admin public requests return HTTP 503.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target State
                </label>
                <select
                  value={mState}
                  onChange={(e) => setMState(e.target.value)}
                  disabled={!canManageMaintenance}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="NORMAL">NORMAL (Full Availability)</option>
                  <option value="SCHEDULED_MAINTENANCE">SCHEDULED_MAINTENANCE (Warning Banner)</option>
                  <option value="MAINTENANCE_ACTIVE">MAINTENANCE_ACTIVE (HTTP 503 Interception)</option>
                  <option value="READ_ONLY_MODE">READ_ONLY_MODE (GET Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Emergency Maintenance
                </label>
                <div className="flex items-center h-10">
                  <input
                    type="checkbox"
                    id="emergency-check"
                    checked={mEmergency}
                    onChange={(e) => setMEmgency(e.target.checked)}
                    disabled={!canManageMaintenance}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="emergency-check" className="ml-2 text-sm text-slate-700">
                    Mark as unscheduled emergency maintenance
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={mStartAt}
                  onChange={(e) => setMStartAt(e.target.value)}
                  disabled={!canManageMaintenance}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={mEndAt}
                  onChange={(e) => setMEndAt(e.target.value)}
                  disabled={!canManageMaintenance}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Public Display Message
                </label>
                <input
                  type="text"
                  value={mMessage}
                  onChange={(e) => setMMessage(e.target.value)}
                  disabled={!canManageMaintenance}
                  placeholder="e.g. System undergoing routine maintenance. Expected restoration in 15 minutes."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transition Reason (Mandatory Audit Requirement)
                </label>
                <input
                  type="text"
                  value={mReason}
                  onChange={(e) => setMReason(e.target.value)}
                  disabled={!canManageMaintenance}
                  placeholder="State the technical or operational rationale for this change..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {canManageMaintenance ? (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveMaintenance}
                  disabled={savingMaintenance}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-xs flex items-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {savingMaintenance ? 'Applying State...' : 'Apply Maintenance Configuration'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                You do not possess the MAINTENANCE_MANAGE permission. Contact a Super Administrator to modify maintenance states.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Operational Diagnostics & Health */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg">System Telemetry & Live Diagnostics</h3>
            <button
              onClick={handleRefreshDiagnostics}
              disabled={refreshingDiagnostics}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingDiagnostics ? 'animate-spin' : ''}`} />
              Refresh Telemetry
            </button>
          </div>

          {diagnostics ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Core Service Info */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Backend Service
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      diagnostics.status === 'HEALTHY'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {diagnostics.status}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Service:</span>
                    <span className="font-mono text-slate-800">{diagnostics.service}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Version:</span>
                    <span className="font-mono text-slate-800">{diagnostics.version}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Environment:</span>
                    <span className="font-mono text-slate-800">{diagnostics.environment}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Process Uptime:</span>
                    <span className="font-mono text-slate-800 font-semibold">
                      {Math.floor(diagnostics.uptimeSeconds / 3600)}h{' '}
                      {Math.floor((diagnostics.uptimeSeconds % 3600) / 60)}m{' '}
                      {diagnostics.uptimeSeconds % 60}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Memory & Host */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Node.js Memory
                  </span>
                  <Cpu className="w-4 h-4 text-blue-600" />
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Heap Used:</span>
                    <span className="font-mono text-slate-800">
                      {diagnostics.memory.heapUsedMb} MB
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Heap Total:</span>
                    <span className="font-mono text-slate-800">
                      {diagnostics.memory.heapTotalMb} MB
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Resident Set Size (RSS):</span>
                    <span className="font-mono text-slate-800">
                      {diagnostics.memory.rssMb} MB
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Database & Queues */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    PostgreSQL Readiness
                  </span>
                  <Database className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Connection Status:</span>
                    <span
                      className={`font-semibold ${
                        diagnostics.database.status === 'UP'
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {diagnostics.database.status}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Roundtrip Latency:</span>
                    <span className="font-mono text-slate-800">
                      {diagnostics.database.latencyMs} ms
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Notification Outbox Pending:</span>
                    <span className="font-mono text-slate-800 font-semibold">
                      {diagnostics.database.pendingDeliveries}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Outbox Failures:</span>
                    <span className="font-mono text-rose-600 font-semibold">
                      {diagnostics.database.failedDeliveries}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Active Polling Elections:</span>
                    <span className="font-mono text-slate-800">
                      {diagnostics.database.activeElections} / {diagnostics.database.totalElections}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
              Loading operational diagnostics...
            </div>
          )}
        </div>
      )}

      {/* Edit Setting Modal */}
      <Modal
        isOpen={editSettingModalOpen}
        onClose={() => setEditSettingModalOpen(false)}
        title={editingSetting ? `Edit Setting: ${editingSetting.key}` : 'Edit Setting'}
      >
        {editingSetting && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">{editingSetting.description}</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Category:</span>
              <span className="font-semibold text-slate-700">{editingSetting.category}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">Current Version:</span>
              <span className="font-mono font-semibold text-blue-700">v{editingSetting.version}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Value ({editingSetting.valueType})
              </label>
              {editingSetting.valueType === 'BOOLEAN' ? (
                <select
                  value={String(editValue)}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : editingSetting.valueType === 'NUMBER' ? (
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                />
              ) : editingSetting.valueType === 'JSON' ? (
                <textarea
                  rows={5}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Change (Mandatory Audit Trail)
              </label>
              <input
                type="text"
                placeholder="Reason explaining why this setting is modified..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditSettingModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSetting}
                disabled={savingSetting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {savingSetting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* History Drawer Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Version History: ${historyKey}`}
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {historyItems.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              No previous version history recorded.
            </p>
          ) : (
            <div className="space-y-3">
              {historyItems.map((h) => (
                <div
                  key={h.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-blue-700">
                      Version {h.version}
                    </span>
                    <span className="text-slate-400">
                      {new Date(h.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-slate-600">
                    <span className="font-semibold text-slate-700">Reason:</span> {h.changeReason}
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200 font-mono text-[11px] truncate text-slate-700">
                    Value: {h.newValue}
                  </div>
                  {canRollbackSettings && historyType === 'setting' && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => openRollbackModal(h)}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-semibold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Rollback to v{h.version}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Rollback Confirmation Modal */}
      <Modal
        isOpen={rollbackModalOpen}
        onClose={() => setRollbackModalOpen(false)}
        title="Confirm Setting Rollback"
      >
        {rollbackTarget && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              You are about to roll back <span className="font-mono font-bold">{rollbackTarget.settingKey}</span> to historic value from <span className="font-semibold">version {rollbackTarget.version}</span>. This will create a new version in the audit trail.
            </p>
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 font-mono text-xs text-slate-800">
              Restoring Value: {rollbackTarget.newValue}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rollback Reason (Mandatory Audit Trail)
              </label>
              <input
                type="text"
                placeholder="Reason explaining this reversion..."
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRollbackModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRollback}
                disabled={rollingBack}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 disabled:opacity-50"
              >
                {rollingBack ? 'Reverting...' : 'Confirm Rollback'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Feature Flag Edit Modal */}
      <Modal
        isOpen={editFlagModalOpen}
        onClose={() => setEditFlagModalOpen(false)}
        title={editingFlag ? `Configure Feature Flag: ${editingFlag.key}` : 'Configure Flag'}
      >
        {editingFlag && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">{editingFlag.description}</p>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-800">Flag Status</span>
                <p className="text-[11px] text-slate-500">Globally enable or disable this feature</p>
              </div>
              <input
                type="checkbox"
                checked={flagEnabled}
                onChange={(e) => setFlagEnabled(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700">Rollout Percentage</label>
                <span className="font-mono text-xs font-bold text-blue-700">{flagRollout}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={flagRollout}
                onChange={(e) => setFlagRollout(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Change (Mandatory Audit Trail)
              </label>
              <input
                type="text"
                placeholder="Reason explaining feature rollout or state change..."
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditFlagModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFlag}
                disabled={savingFlag}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {savingFlag ? 'Saving...' : 'Save Flag'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
