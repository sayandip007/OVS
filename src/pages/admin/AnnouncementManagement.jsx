import React, { useState, useMemo } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import SearchBar from '../../components/common/SearchBar';
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_STATUSES,
} from '../../utils/constants';
import { Megaphone, CheckCircle2, Archive, Edit3, FileEdit } from 'lucide-react';

export default function AnnouncementManagement() {
  const {
    allAnnouncements,
    states,
    elections,
    constituencies,
    createAnnouncement,
    updateAnnouncement,
  } = useElection();
  const { currentAdmin, canPerformAdminAction } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    title: '',
    message: '',
    category: ANNOUNCEMENT_CATEGORIES.ELECTION_UPDATE,
    targetAudience: ANNOUNCEMENT_AUDIENCES.ALL_VOTERS,
    stateId: currentAdmin?.assignedStateId || 'WB',
    electionId: 'LS-2029',
    constituencyId: 'WB-PC-KRISHNANAGAR',
    publicationDate: new Date().toISOString().slice(0, 10),
    expiryDate: '2029-12-31',
    status: ANNOUNCEMENT_STATUSES.PUBLISHED,
  });

  const filteredAnnouncements = useMemo(() => {
    return allAnnouncements.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.message.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allAnnouncements, statusFilter, search]);

  const handleSave = (e, overrideStatus) => {
    if (e) e.preventDefault();
    const targetStatus = overrideStatus || form.status;

    const payload = {
      ...form,
      status: targetStatus,
      stateId:
        form.targetAudience === ANNOUNCEMENT_AUDIENCES.SPECIFIC_STATE
          ? form.stateId
          : null,
      electionId:
        form.targetAudience === ANNOUNCEMENT_AUDIENCES.SPECIFIC_ELECTION
          ? form.electionId
          : null,
      constituencyId:
        form.targetAudience === ANNOUNCEMENT_AUDIENCES.SPECIFIC_CONSTITUENCY
          ? form.constituencyId
          : null,
    };

    if (editingId) {
      const res = updateAnnouncement(editingId, payload, currentAdmin);
      if (!res.ok) {
        notifyError(res.error);
        return;
      }
      notifySuccess(`Updated announcement: ${res.announcement.title}`);
      setEditingId(null);
    } else {
      const res = createAnnouncement(payload, currentAdmin);
      if (!res.ok) {
        notifyError(res.error);
        return;
      }
      notifySuccess(
        `Created announcement (${res.announcement.status}): ${res.announcement.title}`
      );
    }

    setForm((prev) => ({
      ...prev,
      title: '',
      message: '',
      status: ANNOUNCEMENT_STATUSES.PUBLISHED,
    }));
  };

  const handleQuickStatus = (ann, nextStatus) => {
    const perm = canPerformAdminAction('MANAGE_ANNOUNCEMENT', {
      stateId: ann.stateId,
      electionId: ann.electionId,
    });
    if (!perm.allowed) {
      notifyError(perm.reason);
      return;
    }
    const res = updateAnnouncement(
      ann.id,
      { status: nextStatus },
      currentAdmin
    );
    if (res.ok) {
      notifySuccess(`Announcement status changed to ${nextStatus}.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Megaphone className="w-6 h-6 text-[#002868]" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Public &amp; Voter Gazette Communications
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              Public Announcements &amp; Advisories ({allAnnouncements.length})
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Publish notices to All Voters, a Specific State, a Specific Election, or a Specific Constituency. Only <strong>PUBLISHED</strong> announcements appear on public and voter dashboards.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => handleSave(e)}
          className="space-y-4 pt-4 border-t border-slate-200"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Announcement Title *
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Simultaneous Polling Hours Advisory for West Bengal"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Category *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {Object.values(ANNOUNCEMENT_CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Audience *
              </label>
              <select
                value={form.targetAudience}
                onChange={(e) =>
                  setForm({ ...form, targetAudience: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value={ANNOUNCEMENT_AUDIENCES.ALL_VOTERS}>
                  ALL_VOTERS (Pan-India)
                </option>
                <option value={ANNOUNCEMENT_AUDIENCES.SPECIFIC_STATE}>
                  SPECIFIC_STATE
                </option>
                <option value={ANNOUNCEMENT_AUDIENCES.SPECIFIC_ELECTION}>
                  SPECIFIC_ELECTION
                </option>
                <option value={ANNOUNCEMENT_AUDIENCES.SPECIFIC_CONSTITUENCY}>
                  SPECIFIC_CONSTITUENCY
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {form.targetAudience === ANNOUNCEMENT_AUDIENCES.SPECIFIC_STATE && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target State / UT *
                </label>
                <select
                  value={form.stateId}
                  onChange={(e) => setForm({ ...form, stateId: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {states.map((st) => (
                    <option key={st.stateId} value={st.stateId}>
                      {st.stateName} ({st.stateId})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.targetAudience ===
              ANNOUNCEMENT_AUDIENCES.SPECIFIC_ELECTION && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Election *
                </label>
                <select
                  value={form.electionId}
                  onChange={(e) =>
                    setForm({ ...form, electionId: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {elections.map((el) => (
                    <option key={el.electionId} value={el.electionId}>
                      {el.title} ({el.electionId})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.targetAudience ===
              ANNOUNCEMENT_AUDIENCES.SPECIFIC_CONSTITUENCY && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Constituency *
                </label>
                <select
                  value={form.constituencyId}
                  onChange={(e) =>
                    setForm({ ...form, constituencyId: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {constituencies.map((c) => (
                    <option key={c.constituencyId} value={c.constituencyId}>
                      {c.name} ({c.constituencyId})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Publication Date
              </label>
              <input
                type="date"
                value={form.publicationDate}
                onChange={(e) =>
                  setForm({ ...form, publicationDate: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) =>
                  setForm({ ...form, expiryDate: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            <div className="md:col-span-8">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Announcement Body / Official Message *
              </label>
              <input
                type="text"
                required
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Enter official ECI announcement text..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-4 flex flex-wrap justify-end gap-2">
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
                type="button"
                onClick={(e) => handleSave(e, ANNOUNCEMENT_STATUSES.DRAFT)}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
              >
                <FileEdit className="w-3.5 h-3.5" />
                Save as Draft
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {editingId ? 'Save & Publish' : 'Publish Now'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Announcements List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">
            All Announcements ({filteredAnnouncements.length})
          </h2>
          <div className="flex items-center gap-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search announcements..."
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="DRAFT">DRAFT</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {filteredAnnouncements.map((ann) => (
            <div
              key={ann.id}
              className="p-4 rounded-xl border border-slate-200 hover:bg-slate-50 flex flex-wrap items-start justify-between gap-4"
            >
              <div className="space-y-1 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      ann.status === 'PUBLISHED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : ann.status === 'DRAFT'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {ann.status}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-[#002868] text-[10px] font-bold">
                    {ann.category}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Audience: {ann.targetAudience}
                    {ann.stateId ? ` (${ann.stateId})` : ''}
                    {ann.electionId ? ` (${ann.electionId})` : ''}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{ann.title}</h3>
                <p className="text-xs text-slate-600">{ann.message}</p>
                <p className="text-[11px] text-slate-400 font-mono">
                  Published: {ann.publicationDate || ann.date} • Expires:{' '}
                  {ann.expiryDate || '—'}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {ann.status !== 'PUBLISHED' && (
                  <button
                    type="button"
                    onClick={() => handleQuickStatus(ann, 'PUBLISHED')}
                    className="px-2.5 py-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold cursor-pointer"
                  >
                    Publish
                  </button>
                )}
                {ann.status !== 'ARCHIVED' && (
                  <button
                    type="button"
                    onClick={() => handleQuickStatus(ann, 'ARCHIVED')}
                    className="p-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 cursor-pointer"
                    title="Archive Announcement"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(ann.id);
                    setForm({
                      title: ann.title,
                      message: ann.message,
                      category: ann.category || ANNOUNCEMENT_CATEGORIES.ELECTION_UPDATE,
                      targetAudience:
                        ann.targetAudience || ANNOUNCEMENT_AUDIENCES.ALL_VOTERS,
                      stateId: ann.stateId || 'WB',
                      electionId: ann.electionId || 'LS-2029',
                      constituencyId:
                        ann.constituencyId || 'WB-PC-KRISHNANAGAR',
                      publicationDate: ann.publicationDate || ann.date || '2029-03-01',
                      expiryDate: ann.expiryDate || '2029-12-31',
                      status: ann.status || 'PUBLISHED',
                    });
                  }}
                  className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
                  title="Edit Announcement"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
