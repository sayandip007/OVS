import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    (payloadOrMessage) => {
      const normalized =
        typeof payloadOrMessage === 'string'
          ? { type: 'info', title: 'Portal Update', message: payloadOrMessage, duration: 4000 }
          : {
              type: payloadOrMessage?.type || 'info',
              title: payloadOrMessage?.title || '',
              message: payloadOrMessage?.message || '',
              duration:
                payloadOrMessage?.duration !== undefined
                  ? payloadOrMessage.duration
                  : 4000,
            };

      const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setNotifications((prev) => [...prev, { id, ...normalized }]);
      if (normalized.duration > 0) {
        setTimeout(() => {
          dismissNotification(id);
        }, normalized.duration);
      }
      return id;
    },
    [dismissNotification]
  );

  const notifySuccess = useCallback(
    (message, title = 'Success') => notify({ type: 'success', title, message }),
    [notify]
  );

  const notifyError = useCallback(
    (message, title = 'Validation Alert') => notify({ type: 'error', title, message }),
    [notify]
  );

  const notifyInfo = useCallback(
    (message, title = 'Information') => notify({ type: 'info', title, message }),
    [notify]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        notify,
        notifySuccess,
        notifyError,
        notifyInfo,
        dismissNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return ctx;
}
