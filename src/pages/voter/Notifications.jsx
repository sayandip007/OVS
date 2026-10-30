import React, { useState, useMemo } from 'react';
import { useVoter } from '../../context/VoterContext';
import { useNotification } from '../../context/NotificationContext';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
} from '../../utils/constants';

export default function Notifications() {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications,
  } = useVoter();
  const { notifySuccess } = useNotification();

  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [readFilter, setReadFilter] = useState('ALL');
  const [clearModalOpen, setClearModalOpen] = useState(false);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (categoryFilter !== 'ALL' && item.type !== categoryFilter) return false;
      if (readFilter === 'UNREAD' && item.isRead) return false;
      if (readFilter === 'READ' && !item.isRead) return false;
      return true;
    });
  }, [notifications, categoryFilter, readFilter]);

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    notifySuccess('All election notifications marked as read.');
  };

  const handleConfirmClearAll = () => {
    clearAllNotifications();
    setClearModalOpen(false);
    notifySuccess('All notifications cleared from your voter inbox.');
  };

  return (
    <div className="space-y-6">
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
            candidate lists, and profile update confirmations.
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
      {filteredNotifications.length === 0 ? (
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
                    • {new Date(item.createdAt).toLocaleString('en-IN')}
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
                    onClick={() => markNotificationAsRead(item.notificationId)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Mark as Read
                  </button>
                ) : (
                  <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold">
                    ✓ Read
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
          Centre? You can restore default demo notifications anytime using the{' '}
          <strong>Reset Demo Data</strong> button.
        </p>
      </Modal>
    </div>
  );
}
