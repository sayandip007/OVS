import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import Feedback from '../pages/public/Feedback';
import NotFound from '../pages/public/NotFound';

// Voter Pages
import VoterLogin from '../pages/voter/Login';
import VoterRegister from '../pages/voter/Register';
import VoterDashboard from '../pages/voter/Dashboard';
import VoterProfile from '../pages/voter/Profile';
import ElectionHub from '../pages/voter/ElectionHub';
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

/**
  * Frontend Route Guard for Protected Voter Routes
  * Prevents unauthenticated users or ECI Admins from accessing Voter Hub routes.
  */
function RequireVoter({ children }) {
  const { isVoterAuthenticated, isAdminAuthenticated } = useAuth();
  const location = useLocation();

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
  * Prevents unauthenticated users or Voters from accessing Admin Console routes.
  */
function RequireAdmin({ children }) {
  const { isAdminAuthenticated, isVoterAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAdminAuthenticated) {
    if (isVoterAuthenticated) {
      return <Navigate to="/voter/dashboard" replace />;
    }
    return <Navigate to="/eci/login" state={{ from: location }} replace />;
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
        <Route path="states" element={<StateManagement />} />
        <Route path="districts" element={<DistrictManagement />} />
        <Route path="constituencies" element={<ConstituencyManagement />} />
        <Route path="parties" element={<PartyManagement />} />
        <Route path="candidates" element={<CandidateManagement />} />
      </Route>
    </Routes>
  );
}
