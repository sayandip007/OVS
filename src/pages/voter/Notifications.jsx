import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useVoter } from '../../context/VoterContext';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../services/apiClient';
import { frontendEnv } from '../../config/env';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
} from '../../utils/constants';
import { Bell, Sliders, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Notifications() {
  const isBackend = frontendEnv.isBackendApi;

  // Local demo fallback context
  const {
    notifications: demoNotifications,
    unreadNotificationCount: demoUnreadCount,
    markNotificationAsRead: demoMarkRead,
    markAllNotificationsAsRead: demoMarkAllRead,
    clearAllNotifications: demoClearAll,
  } = useVoter();

  const { notifySuccess, notifyError } = useNotification();

  // Backend state
  const [backendItems, setBackendItems] = useState([]);
  const [backendUnreadCount, setBackendUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [readFilter, setReadFilter] = useState('ALL');
  const [clearModalOpen, setClearModalOpen] = useState(false);

  // Preference modal state
  const [prefModalOpen, setPrefModalOpen] = useState(false);
  const [preferences, setPreferences] = useState({
    inAppEnabled: true,
    emailEnabled: false,
    electionReminders: true,
    generalAnnouncements: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  const fetchBackendNotifications = useCallback(async () => {
    if (!isBackend) return;
    try {
      setLoading(true);
      const res = await apiClient.notifications.list({ limit: 100 });
      setBackendItems(res.data || []);
      setBackendUnreadCount(res.unreadCount || 0);
    } catch (err) {
      notifyError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [isBackend, notifyError]);

  const fetchPreferences = useCallback(async () => {
    if (!isBackend) return;
    try {
      const res = await apiClient.notifications.getPreferences();
      setPreferences({
        inAppEnabled: res.inAppEnabled,
        emailEnabled: res.emailEnabled,
        electionReminders: res.electionReminders,
        generalAnnouncements: res.generalAnnouncements,
      });
    } catch (err) {
      // Non-blocking fallback
    }
  }, [isBackend]);

  useEffect(() => {
    if (isBackend) {
      fetchBackendNotifications();
      fetchPreferences();
    }
  }, [isBackend, fetchBackendNotifications, fetchPreferences]);

  const notifications = isBackend
    ? backendItems.map((n) => ({
        ...n,
        notificationId: n.id,
        createdAt: n.timestamp,
      }))
    : demoNotifications;

  const unreadNotificationCount = isBackend
    ? backendUnreadCount
    : demoUnreadCount;

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (categoryFilter !== 'ALL' && item.type !== categoryFilter) return false;
      if (readFilter === 'UNREAD' && item.isRead) return false;
      if (readFilter === 'READ' && !item.isRead) return false;
      return true;
    });
  }, [notifications, categoryFilter, readFilter]);

  const handleMarkRead = async (notificationId) => {
    if (isBackend) {
      try {
        await apiClient.notifications.markRead(notificationId);
        notifySuccess('Notification marked as read.');
        fetchBackendNotifications();
      } catch (err) {
        notifyError(err.message || 'Failed to mark notification read');
      }
    } else {
      demoMarkRead(notificationId);
      notifySuccess('Notification marked as read.');
    }
  };

  const handleMarkAllRead = async () => {
    if (isBackend) {
      try {
        await apiClient.notifications.markAllRead();
        notifySuccess('All election notifications marked as read.');
        fetchBackendNotifications();
      } catch (err) {
        notifyError(err.message || 'Failed to mark all as read');
      }
    } else {
      demoMarkAllRead();
      notifySuccess('All election notifications marked as read.');
    }
  };

  const handleConfirmClearAll = () => {
    if (isBackend) {
      notifySuccess('All notifications cleared from view.');
      setBackendItems([]);
      setBackendUnreadCount(0);
    } else {
      demoClearAll();
      notifySuccess('All notifications cleared from your voter inbox.');
    }
    setClearModalOpen(false);
  };

  const handleSavePreferences = async () => {
    if (!isBackend) {
      setPrefModalOpen(false);
      notifySuccess('Notification preferences updated.');
      return;
    }
    try {
      setSavingPrefs(true);
      await apiClient.notifications.updatePreferences(preferences);
      notifySuccess('Notification preferences updated successfully.');
      setPrefModalOpen(false);
    } catch (err) {
      notifyError(err.message || 'Failed to update preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Simulation Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Educational Notification Simulation:</strong> All notifications describe mock demo election events. They do not constitute official election alerts.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPrefModalOpen(true)}
          className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold transition flex items-center gap-1.5 cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5" />
          Preferences
        </button>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Electoral Advisories &amp; Gazette Alerts
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Voter Notification Centre
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Stay updated with election announcements, nomination schedules, polling dates,
            candidate lists, and profile confirmations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-[#002868]">
            Unread: {unreadNotificationCount} / {notifications.length}
          </span>
          <button
            type="button"
            disabled={unreadNotificationCount === 0}
            onClick={handleMarkAllRead}
            className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-xs font-bold text-slate-800 cursor-pointer"
          >
            Mark All as Read
          </button>
          <button
            type="button"
            disabled={notifications.length === 0}
            onClick={() => setClearModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 disabled:opacity-40 border border-red-200 text-xs font-bold text-red-700 cursor-pointer"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Category & Status Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReadFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              readFilter === 'ALL'
                ? 'bg-[#002868] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setReadFilter('UNREAD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              readFilter === 'UNREAD'
                ? 'bg-[#002868] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Unread ({unreadNotificationCount})
          </button>
          <button
            type="button"
            onClick={() => setReadFilter('READ')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              readFilter === 'READ'
                ? 'bg-[#002868] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Read ({notifications.length - unreadNotificationCount})
          </button>
        </div>

        <div className="w-full sm:w-72">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">All Notification Categories (8 Types)</option>
            {Object.values(NOTIFICATION_TYPES).map((typeKey) => (
              <option key={typeKey} value={typeKey}>
                {NOTIFICATION_TYPE_LABELS[typeKey] || typeKey}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Loading voter notifications...</div>
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          title="No Notifications Found"
          description={
            notifications.length === 0
              ? 'Your voter notification inbox is currently empty.'
              : 'No notifications match your selected category or read-status filter.'
          }
          actionLabel={categoryFilter !== 'ALL' || readFilter !== 'ALL' ? 'Reset Filters' : undefined}
          onAction={
            categoryFilter !== 'ALL' || readFilter !== 'ALL'
              ? () => {
                  setCategoryFilter('ALL');
                  setReadFilter('ALL');
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((item) => (
            <div
              key={item.notificationId}
              className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                item.isRead
                  ? 'bg-white border-slate-200'
                  : 'bg-blue-50/50 border-blue-300 shadow-xs'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  {!item.isRead && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#002868]" />
                  )}
                  <span className="px-2.5 py-0.5 rounded bg-slate-100 text-[#002868] text-[11px] font-bold uppercase tracking-wider">
                    {NOTIFICATION_TYPE_LABELS[item.type] || item.type}
                  </span>
                  {item.electionId && (
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[11px] font-mono font-bold">
                      {item.electionId}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    &bull; {new Date(item.createdAt).toLocaleString('en-IN')}
                  </span>
                </div>

                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  {item.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {item.message}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!item.isRead ? (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(item.notificationId)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Mark as Read
                  </button>
                ) : (
                  <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold">
                    &check; Read
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      <Modal
        isOpen={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        title="Clear All Voter Notifications"
        footer={
          <>
            <button
              type="button"
              onClick={() => setClearModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClearAll}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
            >
              Confirm Clear All
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          Are you sure you want to remove all notifications from your Voter Notification
          Centre?
        </p>
      </Modal>

      {/* Notification Preferences Modal */}
      <Modal
        isOpen={prefModalOpen}
        onClose={() => setPrefModalOpen(false)}
        title="Notification Preferences"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Customize which simulated electoral notifications you receive across in-app and email channels.
          </p>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <label className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 block">In-App Notifications</span>
                <span className="text-[11px] text-slate-500">Receive alerts in your voter portal inbox</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.inAppEnabled}
                onChange={(e) =>
                  setPreferences({ ...preferences, inAppEnabled: e.target.checked })
                }
                className="w-4 h-4 text-[#002868] rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 block">Simulated Email Advisories</span>
                <span className="text-[11px] text-slate-500">
                  Deliver notices to your verified registered email (development mode uses safe outbox)
                </span>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailEnabled}
                onChange={(e) =>
                  setPreferences({ ...preferences, emailEnabled: e.target.checked })
                }
                className="w-4 h-4 text-[#002868] rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 block">Election Schedule Reminders</span>
                <span className="text-[11px] text-slate-500">Upcoming demo polling opening and closing hours</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.electionReminders}
                onChange={(e) =>
                  setPreferences({ ...preferences, electionReminders: e.target.checked })
                }
                className="w-4 h-4 text-[#002868] rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <div>
                <span className="font-bold text-slate-800 block">General Gazette Announcements</span>
                <span className="text-[11px] text-slate-500">Pan-India and state-level electoral notices</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.generalAnnouncements}
                onChange={(e) =>
                  setPreferences({ ...preferences, generalAnnouncements: e.target.checked })
                }
                className="w-4 h-4 text-[#002868] rounded"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPrefModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg font-bold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingPrefs}
              onClick={handleSavePreferences}
              className="px-4 py-2 bg-[#002868] text-white rounded-lg font-bold disabled:opacity-50"
            >
              {savingPrefs ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
