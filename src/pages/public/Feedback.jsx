import React, { useState } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import PageHeader from '../../components/common/PageHeader';

export default function Feedback() {
  const { feedbacks, submitFeedback, states } = useElection();
  const { notifySuccess, notifyError } = useNotification();

  const [form, setForm] = useState({
    name: '',
    email: '',
    stateId: 'WB',
    category: 'Voter Experience',
    rating: '5',
    message: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      notifyError('Please fill in your name, email address, and feedback message.');
      return;
    }

    submitFeedback(form);
    notifySuccess('Thank you! Your feedback has been recorded with the ECI Helpdesk.');
    setForm({
      name: '',
      email: '',
      stateId: 'WB',
      category: 'Voter Experience',
      rating: '5',
      message: '',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader
        badge="Citizen Grievance & Feedback"
        title="Voter Feedback & Portal Suggestions"
        subtitle="Share your experience with the Online Voting System or report constituency metadata suggestions."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Submit Citizen Feedback
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter your full name"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002868]"
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
                  placeholder="citizen@example.in"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002868]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  State / UT
                </label>
                <select
                  value={form.stateId}
                  onChange={(e) => setForm({ ...form, stateId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {states.map((st) => (
                    <option key={st.stateId} value={st.stateId}>
                      {st.stateName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Voter Experience">Voter Experience</option>
                  <option value="Simultaneous Ballot UI">Simultaneous Ballot UI</option>
                  <option value="Constituency Mapping">Constituency Mapping</option>
                  <option value="Accessibility">Accessibility</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Portal Rating
                </label>
                <select
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="5">5 - Excellent</option>
                  <option value="4">4 - Good</option>
                  <option value="3">3 - Satisfactory</option>
                  <option value="2">2 - Needs Improvement</option>
                  <option value="1">1 - Poor</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Feedback Message *
              </label>
              <textarea
                rows={4}
                required
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Describe your feedback or suggestion in detail..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002868]"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-[#002868] hover:bg-blue-900 text-white font-bold text-sm rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Submit Feedback
            </button>
          </form>
        </div>

        {/* Recent Citizen Feedback List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-3">
              Recent Submitted Feedback ({feedbacks.length})
            </h3>
            {feedbacks.length === 0 ? (
              <p className="text-xs text-slate-500">
                No feedback entries submitted in this session yet. Submit the form to see
                live persistence.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {feedbacks.map((fb) => (
                  <div
                    key={fb.id}
                    className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900">{fb.name}</strong>
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-semibold">
                        {fb.category} • {fb.rating}/5
                      </span>
                    </div>
                    <p className="text-slate-700">{fb.message}</p>
                    <p className="text-[10px] text-slate-400">
                      State: {fb.stateId} • {new Date(fb.submittedAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
