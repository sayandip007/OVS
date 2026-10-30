import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

export default function Notification() {
  const { notifications, dismissNotification } = useNotification();

  if (!notifications || notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {notifications.map((item) => {
        const isError = item.type === 'error';
        const isSuccess = item.type === 'success';

        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border bg-white text-slate-900 ${
              isError
                ? 'border-red-300'
                : isSuccess
                ? 'border-emerald-300'
                : 'border-slate-200'
            }`}
          >
            {isError ? (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-[#004d99] shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs">
              {item.title && (
                <p className="font-semibold text-slate-900 mb-0.5">
                  {item.title}
                </p>
              )}
              <p className="text-slate-600 leading-relaxed">{item.message}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismissNotification(item.id)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
