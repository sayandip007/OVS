import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import SearchBar from '../common/SearchBar';
import Modal from '../common/Modal';
import {
  Megaphone,
  CheckCircle2,
  Archive,
  Edit3,
  Clock,
  Send,
  RefreshCw,
  Eye,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

const CATEGORIES = [
  'GENERAL_INFO',
  'ELECTION_SCHEDULE',
  'CANDIDATE_INFO',
  'POLLING_INSTRUCTIONS',
  'RESULTS',
  'IMPORTANT_NOTICE',
];

const AUDIENCES = [
  { value: 'ALL_VOTERS', label: 'All Voters (Pan-India)' },
  { value: 'SPECIFIC_STATE', label: 'Specific State' },
  { value: 'SPECIFIC_ELECTION', label: 'Specific Election' },
  { value: 'SPECIFIC_CONSTITUENCY', label: 'Specific Constituency' },
];

export default function BackendAnnouncementManager() {
  const { currentAdmin } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    summary: '',
    message: '',
    category: 'GENERAL_INFO',
    targetAudience: 'ALL_VOTERS',
    targetStateId: currentAdmin?.assignedStateId || '',
    targetElectionId: '',
    publicationDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTargetId, setReviewTargetId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Schedule modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleTargetId, setScheduleTargetId] = useState(null);
  const [scheduledAt, setScheduledAt] = useState('');

  // Delivery Monitoring state
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryStats, setDeliveryStats] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const query = { limit: 100 };
      if (statusFilter !== 'ALL') query.status = statusFilter;
      if (search.trim()) query.search = search.trim();

      const res = await apiClient.admin.announcements.list(query);
      setAnnouncements(res.data || []);
    } catch (err) {
      notifyError(err.message || 'Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, notifyError]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const fetchDeliveries = async () => {
    try {
      setLoadingDeliveries(true);
      const [statsRes, listRes] = await Promise.all([
        apiClient.admin.notifications.getStats(),
        apiClient.admin.notifications.listDeliveries({ limit: 50 }),
      ]);
      setDeliveryStats(statsRes);
      setDeliveries(listRes.data || []);
    } catch (err) {
      notifyError(err.message || 'Failed to load delivery telemetry');
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const handleOpenDeliveryModal = () => {
    setDeliveryModalOpen(true);
    fetchDeliveries();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiClient.admin.announcements.update(editingId, form);
        notifySuccess('Announcement updated successfully.');
      } else {
        await apiClient.admin.announcements.create(form);
        notifySuccess('Draft announcement created.');
      }
      setIsFormOpen(false);
      setEditingId(null);
      fetchAnnouncements();
    } catch (err) {
      notifyError(err.message || 'Failed to save announcement');
    }
  };

  const handleEdit = (ann) => {
    setEditingId(ann.id);
    setForm({
      title: ann.title,
      summary: ann.summary,
      message: ann.message,
      category: ann.category,
      targetAudience: ann.targetAudience,
      targetStateId: ann.targetStateId || '',
      targetElectionId: ann.targetElectionId || '',
      publicationDate: ann.publicationDate,
      expiryDate: ann.expiryDate,
    });
    setIsFormOpen(true);
  };

  const handleSubmitReview = async (id) => {
    try {
      await apiClient.admin.announcements.submitReview(id, 'Submitted for administrative approval');
      notifySuccess('Announcement submitted for review.');
      fetchAnnouncements();
    } catch (err) {
      notifyError(err.message || 'Failed to submit for review');
    }
  };

  const handleApprove = async () => {
    if (!reviewTargetId) return;
    try {
      await apiClient.admin.announcements.approve(reviewTargetId, reviewNotes);
      notifySuccess('Announcement approved.');
      setReviewModalOpen(false);
      setReviewTargetId(null);
      setReviewNotes('');
      fetchAnnouncements();
    } catch (err) {
      notifyError(err.message || 'Failed to approve announcement');
    }
  };

  const handlePublish = async (id) => {
    try {
      await apiClient.admin.announcements.publish(id);
      notifySuccess('Announcement published and notifications dispatched.');
      fetchAnnouncements();
    } catch (err) {
      notifyError(err.message || 'Failed to publish announcement');
    }
  };

  const handleSchedule = async () => {
    if (!scheduleTargetId || !scheduledAt) return;
    try {
      await apiClient.admin.announcements.schedule(scheduleTargetId, new Date(scheduledAt).toISOString());
      notifySuccess('Announcement scheduled successfully.');
      setScheduleModalOpen(false);
      setScheduleTargetId(null);
      setScheduledAt('');
      fetchAnnouncements();
    } catch (err) {
      notifyError(err.message || 'Failed to schedule announcement');
    }
  };

  const handleArchive = async (id) => {
    try {
      await apiClient.admin.announcements.archive(id, 'Archived by administrative officer');
      notifySuccess('Announcement moved to archive.');
      fetchAnnouncements();
    } catch (err) {
      notifyError(err.message || 'Failed to archive announcement');
    }
  };

  const handleRetryDelivery = async (deliveryId) => {
    try {
      await apiClient.admin.notifications.retryDelivery(deliveryId);
      notifySuccess('Notification delivery requeued.');
      fetchDeliveries();
    } catch (err) {
      notifyError(err.message || 'Failed to retry delivery');
    }
  };

  const statusBadge = (status) => {
    const map = {
      DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
      UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
      APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
      SCHEDULED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      ARCHIVED: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${
          map[status] || 'bg-slate-100 text-slate-700'
        }`}
      >
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Simulation Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Educational Election Simulation:</strong> Announcements published here simulate official Election Commission gazette updates. Zero legal claims or binding notices.
          </span>
        </div>
        <button
          type="button"
          onClick={handleOpenDeliveryModal}
          className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold transition flex items-center gap-1.5 cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5" />
          Delivery Outbox &amp; Retries
        </button>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 rounded-xl text-[#002868]">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Backend Electoral Communications
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              Gazette &amp; Announcements Hub
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Draft, review, schedule, and publish official simulated election advisories.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setForm({
              title: '',
              summary: '',
              message: '',
              category: 'GENERAL_INFO',
              targetAudience: 'ALL_VOTERS',
              targetStateId: currentAdmin?.assignedStateId || '',
              targetElectionId: '',
              publicationDate: new Date().toISOString().slice(0, 10),
              expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
            });
            setIsFormOpen(true);
          }}
          className="px-4 py-2.5 bg-[#002868] hover:bg-blue-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
        >
          + Create Announcement
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'DRAFT', 'UNDER_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#002868] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <SearchBar
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search announcements..."
          />
        </div>
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">No Announcements Found</p>
          <p className="text-xs text-slate-500">Create a new announcement or adjust filter criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 transition hover:border-slate-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  {statusBadge(ann.status)}
                  <span className="text-xs font-mono font-bold text-slate-500">{ann.id}</span>
                  <span className="text-xs text-slate-400">&bull;</span>
                  <span className="text-xs font-semibold text-slate-600">{ann.category}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Published: <strong>{ann.publicationDate}</strong> | Expires:{' '}
                  <strong>{ann.expiryDate}</strong>
                </div>
              </div>

              <div>
                <h2 className="text-base font-extrabold text-slate-900">{ann.title}</h2>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{ann.summary}</p>
                <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                  {ann.message}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2 text-slate-500">
                  <span>
                    Audience: <strong>{ann.targetAudience}</strong>
                  </span>
                  {ann.targetStateId && (
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px]">
                      State: {ann.targetStateId}
                    </span>
                  )}
                  {ann.scheduledAt && (
                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[11px]">
                      Scheduled: {new Date(ann.scheduledAt).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(ann.status === 'DRAFT' || ann.status === 'UNDER_REVIEW') && (
                    <button
                      type="button"
                      onClick={() => handleEdit(ann)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                  )}

                  {ann.status === 'DRAFT' && (
                    <button
                      type="button"
                      onClick={() => handleSubmitReview(ann.id)}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <FileCheck className="w-3 h-3" /> Submit Review
                    </button>
                  )}

                  {ann.status === 'UNDER_REVIEW' && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewTargetId(ann.id);
                        setReviewModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Approve
                    </button>
                  )}

                  {ann.status === 'APPROVED' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleTargetId(ann.id);
                          setScheduleModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Clock className="w-3 h-3" /> Schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePublish(ann.id)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3 h-3" /> Publish Now
                      </button>
                    </>
                  )}

                  {ann.status === 'SCHEDULED' && (
                    <button
                      type="button"
                      onClick={() => handlePublish(ann.id)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3 h-3" /> Publish Now
                    </button>
                  )}

                  {ann.status === 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() => handleArchive(ann.id)}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Archive className="w-3 h-3" /> Archive
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? 'Edit Announcement' : 'Create New Announcement'}
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="e.g. Schedule for Phase 1 Demo Voting"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Target Audience *</label>
              <select
                value={form.targetAudience}
                onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.targetAudience === 'SPECIFIC_STATE' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Target State Code *</label>
              <input
                type="text"
                required
                value={form.targetStateId}
                onChange={(e) => setForm({ ...form, targetStateId: e.target.value })}
                placeholder="e.g. WB, DL, MH"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Publication Date *</label>
              <input
                type="date"
                required
                value={form.publicationDate}
                onChange={(e) => setForm({ ...form, publicationDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Expiry Date *</label>
              <input
                type="date"
                required
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Summary (1-2 sentences) *</label>
            <input
              type="text"
              required
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="Brief summary displayed on notification cards"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Full Message *</label>
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="Official announcement text..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#002868] text-white rounded-lg font-bold"
            >
              {editingId ? 'Save Changes' : 'Create Draft'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Review Approval Modal */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title="Approve Announcement"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            You are certifying and approving this announcement for subsequent scheduling or publication.
          </p>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Review Notes / Remarks</label>
            <textarea
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="e.g. Scrutinized and verified against simulated electoral timetable."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReviewModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg font-bold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold"
            >
              Confirm Approval
            </button>
          </div>
        </div>
      </Modal>

      {/* Scheduling Modal */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Schedule Announcement Publication"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Configure future timestamp when the background worker will automatically release this announcement.
          </p>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Scheduled Release Time *</label>
            <input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setScheduleModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg font-bold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSchedule}
              className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg font-bold"
            >
              Schedule Release
            </button>
          </div>
        </div>
      </Modal>

      {/* Delivery Telemetry & Outbox Modal */}
      <Modal
        isOpen={deliveryModalOpen}
        onClose={() => setDeliveryModalOpen(false)}
        title="Notification Delivery Outbox & Retries"
      >
        <div className="space-y-4 text-xs max-w-2xl">
          {deliveryStats && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="block text-slate-400 text-[10px] font-bold uppercase">Total</span>
                <span className="text-base font-extrabold text-slate-800">{deliveryStats.totalDeliveries}</span>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                <span className="block text-amber-600 text-[10px] font-bold uppercase">Pending</span>
                <span className="text-base font-extrabold text-amber-800">{deliveryStats.pending}</span>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                <span className="block text-blue-600 text-[10px] font-bold uppercase">Processing</span>
                <span className="text-base font-extrabold text-blue-800">{deliveryStats.processing}</span>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="block text-emerald-600 text-[10px] font-bold uppercase">Delivered</span>
                <span className="text-base font-extrabold text-emerald-800">{deliveryStats.delivered}</span>
              </div>
              <div className="p-2 bg-rose-50 rounded-lg border border-rose-200">
                <span className="block text-rose-600 text-[10px] font-bold uppercase">Failed</span>
                <span className="text-base font-extrabold text-rose-800">{deliveryStats.failed}</span>
              </div>
              <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-200">
                <span className="block text-indigo-600 text-[10px] font-bold uppercase">Email Outbox</span>
                <span className="text-base font-extrabold text-indigo-800">{deliveryStats.emailCount}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <span className="font-bold text-slate-700">Recent Outbound Queue Items:</span>
            <button
              type="button"
              onClick={fetchDeliveries}
              className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          {loadingDeliveries ? (
            <p className="py-4 text-center text-slate-500">Loading outbox...</p>
          ) : deliveries.length === 0 ? (
            <p className="py-4 text-center text-slate-500">Outbox is clear. Zero pending transmissions.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {deliveries.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{item.channel}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          item.status === 'DELIVERED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'FAILED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        Attempts: {item.attempts}/{item.maxAttempts}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate max-w-sm mt-0.5">
                      To: {item.recipientEmail || 'Voter In-App'}
                    </p>
                    {item.failureReason && (
                      <p className="text-[10px] text-rose-600 font-mono mt-0.5">{item.failureReason}</p>
                    )}
                  </div>

                  {item.status === 'FAILED' && (
                    <button
                      type="button"
                      onClick={() => handleRetryDelivery(item.id)}
                      className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer shrink-0"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setDeliveryModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg font-bold"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
