import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';
import { frontendEnv } from '../../config/env';
import { AlertTriangle, Clock, X, Info } from 'lucide-react';

export default function MaintenanceBanner() {
  const [maintenance, setMaintenance] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!frontendEnv.isBackendApi) return;

    let mounted = true;
    apiClient.publicConfig
      .get()
      .then((res) => {
        if (mounted && res?.data?.config?.maintenance) {
          setMaintenance(res.data.config.maintenance);
        }
      })
      .catch(() => {
        // Silently ignore if offline
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (dismissed || !maintenance || maintenance.state === 'NORMAL') {
    return null;
  }

  const isScheduled = maintenance.state === 'SCHEDULED_MAINTENANCE';
  const isActive = maintenance.state === 'MAINTENANCE_ACTIVE';
  const isReadOnly = maintenance.state === 'READ_ONLY_MODE';

  return (
    <aside
      aria-label="System maintenance notice"
      className={`w-full py-2.5 px-4 text-xs font-medium border-b flex items-center justify-between z-50 transition-colors ${
        isActive
          ? 'bg-rose-600 text-white border-rose-700'
          : isScheduled
          ? 'bg-amber-500 text-white border-amber-600'
          : 'bg-sky-600 text-white border-sky-700'
      }`}
    >
      <div className="flex items-center gap-2 max-w-5xl mx-auto flex-1">
        {isActive ? (
          <AlertTriangle className="w-4 h-4 shrink-0" />
        ) : isScheduled ? (
          <Clock className="w-4 h-4 shrink-0" />
        ) : (
          <Info className="w-4 h-4 shrink-0" />
        )}
        <span>
          <strong className="font-bold uppercase tracking-wider mr-1.5">
            {isActive
              ? 'Maintenance Notice:'
              : isScheduled
              ? 'Scheduled Maintenance:'
              : 'Read-Only Mode:'}
          </strong>
          {maintenance.message || 'System operational adjustments in progress.'}
          {maintenance.startAt && isScheduled && (
            <span className="ml-2 opacity-90">
              (Begins: {new Date(maintenance.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
            </span>
          )}
        </span>
      </div>

      {!isActive && (
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-black/10 rounded transition-colors"
          title="Dismiss notice"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </aside>
  );
}
