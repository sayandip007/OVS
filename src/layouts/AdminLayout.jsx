import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import AdminSidebar from '../components/admin/AdminSidebar';
import Modal from '../components/common/Modal';
import { useElection } from '../context/ElectionContext';
import { useNotification } from '../context/NotificationContext';

export default function AdminLayout() {
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const { resetDemoData } = useElection();
  const { notify } = useNotification();

  const handleConfirmReset = () => {
    resetDemoData();
    setConfirmResetOpen(false);
    notify({
      type: 'success',
      title: 'Demo Data Restored',
      message:
        'All elections, states, districts, constituencies, parties, candidates, and voter records have been restored to initial seed values.',
    });
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900 font-sans">
      <Navbar />
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
        <AdminSidebar onResetDemo={() => setConfirmResetOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
      <Footer />

      <Modal
        isOpen={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Reset Demonstration Data"
        subtitle="Restore all local datasets to original seed state"
      >
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            Are you sure you want to reset all local demonstration data? This will restore all 36 States/UTs, 72 sample districts, Parliamentary &amp; Assembly constituencies, elections, candidates, and voter participation statuses to their initial defaults.
          </p>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setConfirmResetOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReset}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 cursor-pointer"
            >
              Confirm Reset
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
