import React from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import PublicLayout from '../layouts/PublicLayout';
import VoterLayout from '../layouts/VoterLayout';
import AdminLayout from '../layouts/AdminLayout';

// Public Pages
import Home from '../pages/public/Home';
import About from '../pages/public/About';
import ElectionInformation from '../pages/public/ElectionInformation';
import CandidateDirectory from '../pages/public/CandidateDirectory';
import Results from '../pages/public/Results';
import LokSabhaResults from '../pages/public/LokSabhaResults';
import AssemblyResults from '../pages/public/AssemblyResults';
import ConstituencyResultDetail from '../pages/public/ConstituencyResultDetail';
import Feedback from '../pages/public/Feedback';
import NotFound from '../pages/public/NotFound';

// Voter Pages
import VoterLogin from '../pages/voter/Login';
import VoterRegister from '../pages/voter/Register';
import VoterDashboard from '../pages/voter/Dashboard';
import VoterProfile from '../pages/voter/Profile';
import ElectionHub from '../pages/voter/ElectionHub';
import ElectionDetailsPage from '../pages/voter/ElectionDetailsPage';
import BallotPage from '../pages/voter/BallotPage';
import BallotReceiptPage from '../pages/voter/BallotReceiptPage';
import ConstituencyDetails from '../pages/voter/ConstituencyDetails';
import Notifications from '../pages/voter/Notifications';
import VotingHistory from '../pages/voter/VotingHistory';
import Settings from '../pages/voter/Settings';

// Admin Pages
import AdminLogin from '../pages/admin/Login';
import AdminDashboard from '../pages/admin/Dashboard';
import ElectionManagement from '../pages/admin/ElectionManagement';
import StateManagement from '../pages/admin/StateManagement';
import DistrictManagement from '../pages/admin/DistrictManagement';
import ConstituencyManagement from '../pages/admin/ConstituencyManagement';
import PartyManagement from '../pages/admin/PartyManagement';
import CandidateManagement from '../pages/admin/CandidateManagement';
import VoterManagement from '../pages/admin/VoterManagement';
import ScheduleManagement from '../pages/admin/ScheduleManagement';
import ElectionMonitoring from '../pages/admin/ElectionMonitoring';
import AnnouncementManagement from '../pages/admin/AnnouncementManagement';
import ResultsManagement from '../pages/admin/ResultsManagement';
import AuditLogs from '../pages/admin/AuditLogs';
import AdminSettings from '../pages/admin/AdminSettings';
import AdminProfile from '../pages/admin/AdminProfile';
import AdminUserManagement from '../pages/admin/AdminUserManagement';

/**
 * Frontend Route Guard for Protected Voter Routes
 * Prevents unauthenticated users or ECI Admins from accessing Voter Hub routes.
 */
function RequireVoter({ children }) {
  const { isVoterAuthenticated, isAdminAuthenticated, isAuthInitialized } = useAuth();
  const location = useLocation();

  if (!isAuthInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs font-bold text-slate-600">
        Verifying session...
      </div>
    );
  }

  if (!isVoterAuthenticated) {
    if (isAdminAuthenticated) {
      return <Navigate to="/eci/dashboard" replace />;
    }
    return <Navigate to="/voter/login" state={{ from: location }} replace />;
  }

  return children;
}

/**
 * Frontend Route Guard for Protected ECI Officer / Admin Routes
 * Prevents unauthenticated users or Voters from accessing Admin Console routes
 * and displays explicit 403 Forbidden state for unauthorized route access.
 */
function RequireAdmin({ children }) {
  const {
    isAdminAuthenticated,
    isVoterAuthenticated,
    canAccessAdminRoute,
    isAuthInitialized,
  } = useAuth();
  const location = useLocation();

  if (!isAuthInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs font-bold text-slate-600">
        Verifying administrator session...
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    if (isVoterAuthenticated) {
      return <Navigate to="/voter/dashboard" replace />;
    }
    return <Navigate to="/eci/login" state={{ from: location }} replace />;
  }

  if (!canAccessAdminRoute(location.pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-6 text-center space-y-4 shadow-xs">
          <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-900 text-xs font-extrabold uppercase">
            403 Forbidden
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">
            Insufficient Administrative Permissions
          </h1>
          <p className="text-xs text-slate-600">
            Your assigned role or jurisdiction scope does not permit access to{' '}
            <code className="font-mono font-bold">{location.pathname}</code>.
          </p>
          <Link
            to="/eci/dashboard"
            className="inline-block px-4 py-2 rounded-xl bg-[#002868] text-white text-xs font-bold hover:bg-blue-900"
          >
            Return to Authorized Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Portal Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/elections" element={<ElectionInformation />} />
        <Route path="/candidates" element={<CandidateDirectory />} />
        <Route path="/results" element={<Results />} />
        <Route path="/results/lok-sabha" element={<LokSabhaResults />} />
        <Route path="/results/assembly" element={<AssemblyResults />} />
        <Route
          path="/results/:electionId/:constituencyId"
          element={<ConstituencyResultDetail />}
        />
        <Route path="/feedback" element={<Feedback />} />

        {/* Voter & Admin Public Entry (Login / Register) */}
        <Route path="/voter/login" element={<VoterLogin />} />
        <Route path="/voter/register" element={<VoterRegister />} />
        <Route path="/eci/login" element={<AdminLogin />} />

        {/* Legacy Route Redirects for Backwards Compatibility */}
        <Route path="/login" element={<Navigate to="/voter/login" replace />} />
        <Route path="/register" element={<Navigate to="/voter/register" replace />} />
        <Route path="/ecilogin" element={<Navigate to="/eci/login" replace />} />
        <Route path="/eciregister" element={<Navigate to="/eci/candidates" replace />} />
        <Route path="/dashboard" element={<Navigate to="/voter/dashboard" replace />} />
        <Route path="/vote" element={<Navigate to="/voter/elections" replace />} />

        {/* 404 NotFound */}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Protected Voter Portal Routes (Uses Reusable VoterLayout) */}
      <Route
        path="/voter"
        element={
          <RequireVoter>
            <VoterLayout />
          </RequireVoter>
        }
      >
        <Route index element={<Navigate to="/voter/dashboard" replace />} />
        <Route path="dashboard" element={<VoterDashboard />} />
        <Route path="profile" element={<VoterProfile />} />
        <Route path="constituencies" element={<ConstituencyDetails />} />
        <Route path="elections" element={<ElectionHub />} />
        <Route path="elections/:electionId" element={<ElectionDetailsPage />} />
        <Route path="elections/:electionId/info" element={<ElectionDetailsPage />} />
        <Route path="elections/:electionId/ballot" element={<BallotPage />} />
        <Route path="elections/:electionId/receipt" element={<BallotReceiptPage />} />
        <Route path="election-info" element={<ElectionInformation />} />
        <Route path="candidates" element={<CandidateDirectory />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="history" element={<VotingHistory />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Protected ECI Admin Console Routes */}
      <Route
        path="/eci"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="/eci/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="elections" element={<ElectionManagement />} />
        <Route path="elections/create" element={<ElectionManagement />} />
        <Route path="elections/:id" element={<ElectionManagement />} />
        <Route path="states" element={<StateManagement />} />
        <Route path="districts" element={<DistrictManagement />} />
        <Route path="constituencies" element={<ConstituencyManagement />} />
        <Route path="parties" element={<PartyManagement />} />
        <Route path="candidates" element={<CandidateManagement />} />
        <Route path="voters" element={<VoterManagement />} />
        <Route path="schedules" element={<ScheduleManagement />} />
        <Route path="monitoring" element={<ElectionMonitoring />} />
        <Route path="announcements" element={<AnnouncementManagement />} />
        <Route path="results" element={<ResultsManagement />} />
        <Route path="admin-users" element={<AdminUserManagement />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="profile" element={<AdminProfile />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Routes>
  );
}
