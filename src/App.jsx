import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationProvider } from './context/NotificationContext';
import { ElectionProvider } from './context/ElectionContext';
import { AuthProvider } from './context/AuthContext';
import { VoterProvider } from './context/VoterContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import Notification from './components/common/Notification';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <NotificationProvider>
          <ElectionProvider>
            <AuthProvider>
              <VoterProvider>
                <Notification />
                <AppRoutes />
              </VoterProvider>
            </AuthProvider>
          </ElectionProvider>
        </NotificationProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

