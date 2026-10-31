import React, { useState, useMemo } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import Modal from '../../components/common/Modal';
import { ELECTION_TYPES, ELECTION_STATUS_LABELS } from '../../utils/constants';
import { detectScheduleConflicts } from '../../services/adminPermissionService';
import {
  CalendarClock,
  AlertTriangle,
  ListFilter,
  Calendar,
  Save,
} from 'lucide-react';

export default function ScheduleManagement() {
  const { elections, updateElectionSchedule } = useElection();
  const { currentAdmin } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [viewMode, setViewMode] = useState('LIST'); // 'LIST' | 'CALENDAR'
  const [selectedElectionId, setSelectedElectionId] = useState(
    elections[0]?.electionId || 'LS-2029'
  );
  const [confirmActiveModal, setConfirmActiveModal] = useState(null);

  const selectedElection = useMemo(
    () =>
      elections.find((e) => e.electionId === selectedElectionId) || elections[0],
    [elections, selectedElectionId]
  );

  const [scheduleForm, setScheduleForm] = useState(() => ({
    nominationStartDate: selectedElection?.nominationStartDate || '2029-03-10',
    nominationEndDate: selectedElection?.nominationEndDate || '2029-03-25',
    scrutinyDate: selectedElection?.scrutinyDate || '2029-03-27',
    withdrawalDeadline: selectedElection?.withdrawalDeadline || '2029-03-30',
    pollingStartDate:
      selectedElection?.pollingStartDate ||
      selectedElection?.pollingDate ||
      '2029-04-15',
    pollingEndDate:
      selectedElection?.pollingEndDate ||
      selectedElection?.pollingDate ||
      '2029-04-15',
    countingDate: selectedElection?.countingDate || '2029-05-18',
    resultDate: selectedElection?.resultDate || '2029-05-20',
  }));

  const handleSelectElection = (elId) => {
    setSelectedElectionId(elId);
    const el = elections.find((e) => e.electionId === elId);
    if (el) {
      setScheduleForm({
        nominationStartDate: el.nominationStartDate || '2029-03-10',
        nominationEndDate: el.nominationEndDate || '2029-03-25',
        scrutinyDate: el.scrutinyDate || '2029-03-27',
        withdrawalDeadline: el.withdrawalDeadline || '2029-03-30',
        pollingStartDate: el.pollingStartDate || el.pollingDate || '2029-04-15',
        pollingEndDate: el.pollingEndDate || el.pollingDate || '2029-04-15',
        countingDate: el.countingDate || '2029-05-18',
        resultDate: el.resultDate || '2029-05-20',
      });
    }
  };

  const scheduleConflicts = useMemo(() => {
    if (!selectedElection) return [];
    return detectScheduleConflicts(
      {
        ...selectedElection,
        ...scheduleForm,
        pollingDate: scheduleForm.pollingStartDate,
      },
      elections
    );
  }, [selectedElection, scheduleForm, elections]);

  const handleSaveSchedule = (e) => {
    e.preventDefault();
    if (!selectedElection) return;

    const res = updateElectionSchedule(
      selectedElection.electionId,
      scheduleForm,
      {
        currentAdmin,
        confirmActiveScheduleChange: false,
      }
    );

    if (!res.ok) {
      if (res.requiresConfirmation) {
        setConfirmActiveModal({
          election: selectedElection,
          schedulePayload: scheduleForm,
        });
        return;
      }
      notifyError(res.errors?.[0] || 'Invalid schedule configuration.');
      return;
    }

    notifySuccess(
      `Updated 8-stage electoral schedule for ${selectedElection.title}.`
    );
  };

  const handleConfirmActiveScheduleUpdate = () => {
    if (!confirmActiveModal) return;
    const res = updateElectionSchedule(
      confirmActiveModal.election.electionId,
      confirmActiveModal.schedulePayload,
      {
        currentAdmin,
        confirmActiveScheduleChange: true,
      }
    );
    setConfirmActiveModal(null);
    if (!res.ok) {
      notifyError(res.errors?.[0] || 'Failed to update schedule.');
      return;
    }
    notifySuccess(
      `Confirmed and updated schedule for active election ${confirmActiveModal.election.title}.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & View Mode Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Statutory Election Gazette Timeline
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Election Schedule &amp; Milestone Configuration
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Configure Nomination Start/End, Scrutiny, Withdrawal, Polling Window, Counting, and Result Declaration dates with chronological validation.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50">
          <button
            type="button"
            onClick={() => setViewMode('LIST')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              viewMode === 'LIST'
                ? 'bg-[#002868] text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            List &amp; Editor View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('CALENDAR')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              viewMode === 'CALENDAR'
                ? 'bg-[#002868] text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendar Timeline View
          </button>
        </div>
      </div>

      {/* Schedule Editor Card */}
      {selectedElection && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <CalendarClock className="w-5 h-5 text-[#002868]" />
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Configure 8-Stage Schedule
                </h2>
                <p className="text-xs text-slate-500">
                  Enforces: Nomination Start &le; Nomination End &le; Scrutiny &le; Withdrawal &le; Polling Start &le; Polling End &le; Counting &le; Result
                </p>
              </div>
            </div>

            <select
              value={selectedElectionId}
              onChange={(e) => handleSelectElection(e.target.value)}
              className="px-3.5 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white"
            >
              {elections.map((el) => (
                <option key={el.electionId} value={el.electionId}>
                  {el.title} ({el.electionId}) — {el.status}
                </option>
              ))}
            </select>
          </div>

          {scheduleConflicts.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Simultaneous Schedule Overlap Notice:</p>
                {scheduleConflicts.map((c, idx) => (
                  <p key={idx}>• {c.message}</p>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSaveSchedule} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  1. Nomination Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={scheduleForm.nominationStartDate}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      nominationStartDate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. Nomination End Date *
                </label>
                <input
                  type="date"
                  required
                  value={scheduleForm.nominationEndDate}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      nominationEndDate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  3. Scrutiny of Nominations *
                </label>
                <input
                  type="date"
                  required
                  value={scheduleForm.scrutinyDate}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      scrutinyDate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  4. Withdrawal Deadline *
                </label>
                <input
                  type="date"
                  required
                  value={scheduleForm.withdrawalDeadline}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      withdrawalDeadline: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  5. Polling Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={scheduleForm.pollingStartDate}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      pollingStartDate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  6. Polling End Date *
                </label>
                <input
                  type="date"
                  required
                  value={scheduleForm.pollingEndDate}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      pollingEndDate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  7. Counting Date *
                </label>
                <input
                  type="date"
                  required
                  value={scheduleForm.countingDate}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      countingDate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  8. Result Declaration Date *
                </label>
                <input
                  type="date"
                  required
                  value={scheduleForm.resultDate}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      resultDate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Validate &amp; Save Election Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List View vs Calendar Timeline View */}
      {viewMode === 'LIST' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              All Election Schedules Comparison Table
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                  <th className="py-3 px-3">Election</th>
                  <th className="py-3 px-3">Nomination Window</th>
                  <th className="py-3 px-3">Scrutiny / Withdrawal</th>
                  <th className="py-3 px-3">Polling Window</th>
                  <th className="py-3 px-3">Counting</th>
                  <th className="py-3 px-3">Result Date</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {elections.map((el) => (
                  <tr
                    key={el.electionId}
                    onClick={() => handleSelectElection(el.electionId)}
                    className={`cursor-pointer hover:bg-slate-50 ${
                      el.electionId === selectedElectionId ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{el.title}</p>
                      <span className="font-mono text-[11px] text-slate-500">
                        {el.electionId} ({el.electionType})
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      {el.nominationStartDate} &rarr; {el.nominationEndDate}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      {el.scrutinyDate || '—'} / {el.withdrawalDeadline || '—'}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-[#002868]">
                      {el.pollingStartDate || el.pollingDate}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      {el.countingDate || '—'}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      {el.resultDate}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {ELECTION_STATUS_LABELS[el.status] || el.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {elections.map((el) => (
            <div
              key={el.electionId}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      el.electionType === ELECTION_TYPES.LOK_SABHA
                        ? 'bg-indigo-100 text-indigo-900'
                        : 'bg-teal-100 text-teal-900'
                    }`}
                  >
                    {el.electionType}
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900 mt-1">
                    {el.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectElection(el.electionId)}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 cursor-pointer"
                >
                  Edit Dates
                </button>
              </div>

              <ol className="relative border-l-2 border-slate-200 ml-3 space-y-3 text-xs">
                {[
                  { label: 'Nomination Opens', date: el.nominationStartDate },
                  { label: 'Nomination Closes', date: el.nominationEndDate },
                  { label: 'Scrutiny of Affidavits', date: el.scrutinyDate },
                  { label: 'Candidate Withdrawal Deadline', date: el.withdrawalDeadline },
                  { label: 'Polling Day', date: el.pollingStartDate || el.pollingDate },
                  { label: 'Counting of Votes', date: el.countingDate },
                  { label: 'Declaration of Results', date: el.resultDate },
                ].map((step, i) => (
                  <li key={i} className="ml-4">
                    <div className="absolute w-2.5 h-2.5 bg-[#002868] rounded-full -left-[6px] mt-1" />
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">
                        {step.label}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {step.date || '—'}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {/* Active Election Schedule Change Confirmation Modal */}
      <Modal
        isOpen={Boolean(confirmActiveModal)}
        onClose={() => setConfirmActiveModal(null)}
        title="Confirm Active Election Schedule Change"
        subtitle="Polling is currently active for this election"
      >
        <div className="space-y-4 text-xs text-slate-700">
          <p>
            <strong>{confirmActiveModal?.election?.title}</strong> is currently in{' '}
            <code className="font-mono font-bold">POLLING_ACTIVE</code> state. Modifying its statutory dates will immediately update public schedule views and audit logs.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setConfirmActiveModal(null)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmActiveScheduleUpdate}
              className="px-4 py-2 rounded-lg bg-[#002868] hover:bg-blue-900 font-bold text-white cursor-pointer"
            >
              Confirm Schedule Update
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
