import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useElection } from './ElectionContext';
import {
  getVoterEligibleElections,
  getVoterConstituencyIdForElection,
  getVoterElectionParticipationStatus,
  getVoterParticipationSummary,
  getVoterProfileCompletion,
  getCandidatesForElectionConstituency,
} from '../utils/electionHelpers';
import { validateBallotAccess } from '../services/ballotValidationService';

const VoterContext = createContext(null);

export function VoterProvider({ children }) {
  const { activeVoterId, isVoter } = useAuth();
  const {
    voters,
    states,
    districts,
    constituencies,
    elections,
    candidates,
    voterNotifications,
    recentCandidates,
    updateVoterProfile,
    castSimulatedVote,
    simulateElectionParticipationStatus,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications,
    recordCandidateView,
  } = useElection();

  // Controlled Demo Test Polling Mode allows testing UPCOMING/READY elections without changing system dates
  const [controlledDemoPollingMode, setControlledDemoPollingMode] = useState(false);

  const currentVoter = useMemo(() => {
    if (!isVoter || !activeVoterId) return null;
    return (
      voters.find((v) => v.id === activeVoterId || v.voterId === activeVoterId) ||
      null
    );
  }, [isVoter, activeVoterId, voters]);

  const voterGeography = useMemo(() => {
    if (!currentVoter) {
      return {
        state: null,
        district: null,
        parliamentaryConstituency: null,
        assemblyConstituency: null,
      };
    }
    return {
      state:
        states.find(
          (s) => s.id === currentVoter.stateId || s.stateId === currentVoter.stateId
        ) || null,
      district:
        districts.find(
          (d) =>
            d.id === currentVoter.districtId ||
            d.districtId === currentVoter.districtId
        ) || null,
      parliamentaryConstituency:
        constituencies.find(
          (c) =>
            c.id === currentVoter.parliamentaryConstituencyId ||
            c.constituencyId === currentVoter.parliamentaryConstituencyId
        ) || null,
      assemblyConstituency:
        constituencies.find(
          (c) =>
            c.id === currentVoter.assemblyConstituencyId ||
            c.constituencyId === currentVoter.assemblyConstituencyId
        ) || null,
    };
  }, [currentVoter, states, districts, constituencies]);

  const eligibleElections = useMemo(() => {
    return getVoterEligibleElections(currentVoter, elections);
  }, [currentVoter, elections]);

  const participationSummary = useMemo(() => {
    const raw = getVoterParticipationSummary(currentVoter, eligibleElections);
    const items = (raw.targetElections || []).map((el) => {
      const elId = el.id || el.electionId;
      const entry = raw.byElectionId?.[elId] || {
        status: 'PENDING',
        participatedAt: null,
        referenceId: null,
        demoReference: null,
      };
      return {
        electionId: elId,
        status: entry.status,
        participatedAt: entry.participatedAt,
        referenceId: entry.referenceId,
        demoReference: entry.demoReference || entry.referenceId,
      };
    });
    return {
      ...raw,
      items,
    };
  }, [currentVoter, eligibleElections]);

  const profileCompletion = useMemo(() => {
    return getVoterProfileCompletion(currentVoter);
  }, [currentVoter]);

  const myNotifications = useMemo(() => {
    const rawList = !currentVoter
      ? voterNotifications || []
      : (voterNotifications || []).filter(
          (n) => !n.targetStateId || n.targetStateId === currentVoter.stateId
        );
    return rawList.map((n) => ({
      ...n,
      id: n.id || n.notificationId,
      notificationId: n.notificationId || n.id,
      read: Boolean(n.read || n.isRead),
      isRead: Boolean(n.read || n.isRead),
      createdAt: n.createdAt || n.timestamp || new Date().toISOString(),
      timestamp: n.timestamp || n.createdAt || new Date().toISOString(),
    }));
  }, [voterNotifications, currentVoter]);

  const unreadNotificationCount = useMemo(
    () => myNotifications.filter((n) => !n.isRead).length,
    [myNotifications]
  );

  const getConstituencyForVoterElection = useCallback(
    (election) => {
      if (!currentVoter || !election) return null;
      const constId = getVoterConstituencyIdForElection(currentVoter, election);
      return (
        constituencies.find(
          (c) => c.id === constId || c.constituencyId === constId
        ) || null
      );
    },
    [currentVoter, constituencies]
  );

  const getCandidatesForVoterElection = useCallback(
    (election) => {
      if (!currentVoter || !election) return [];
      const constId = getVoterConstituencyIdForElection(currentVoter, election);
      const elId = election.id || election.electionId;
      return getCandidatesForElectionConstituency(
        candidates,
        elId,
        constId,
        true
      );
    },
    [currentVoter, candidates]
  );

  const getElectionParticipationStatus = useCallback(
    (election) => {
      return getVoterElectionParticipationStatus(currentVoter, election);
    },
    [currentVoter]
  );

  const hasParticipatedInElection = useCallback(
    (electionId) => {
      if (!currentVoter || !electionId) return false;
      const entry = currentVoter.elections?.[electionId];
      return entry?.status === 'VOTED' || entry?.participated === true;
    },
    [currentVoter]
  );

  const checkBallotEligibilityForVoter = useCallback(
    (election, overrideDemoMode = false) => {
      const constituency = getConstituencyForVoterElection(election);
      return validateBallotAccess({
        voter: currentVoter,
        election,
        constituency,
        demoPollingOverride: controlledDemoPollingMode || overrideDemoMode,
      });
    },
    [currentVoter, getConstituencyForVoterElection, controlledDemoPollingMode]
  );

  const updateCurrentVoterProfile = useCallback(
    (updates, options = {}) => {
      if (!currentVoter) {
        return { ok: false, error: 'Voter not authenticated.' };
      }
      const res = updateVoterProfile(
        currentVoter.id || currentVoter.voterId,
        updates,
        {
          ...options,
          correctionReason: updates?.correctionReason || options?.correctionReason,
        }
      );
      if (!res.ok) {
        return {
          ...res,
          error: Array.isArray(res.errors) ? res.errors[0] : res.error,
        };
      }
      return res;
    },
    [currentVoter, updateVoterProfile]
  );

  /**
   * Completes demo participation for a single election ID.
   * Updates only participation status, timestamp, and non-sensitive demoReference.
   * Never stores candidate or party selection in voter profile or participation history.
   */
  const completeDemoParticipationForCurrentVoter = useCallback(
    (electionId) => {
      if (!currentVoter) {
        return { ok: false, error: 'Voter not authenticated.' };
      }
      return simulateElectionParticipationStatus(
        currentVoter.id || currentVoter.voterId,
        electionId
      );
    },
    [currentVoter, simulateElectionParticipationStatus]
  );

  return (
    <VoterContext.Provider
      value={{
        currentVoter,
        voterGeography,
        voterState: voterGeography.state,
        voterDistrict: voterGeography.district,
        voterParliamentaryConstituency: voterGeography.parliamentaryConstituency,
        voterAssemblyConstituency: voterGeography.assemblyConstituency,
        eligibleElections,
        participationSummary,
        profileCompletion,
        notifications: myNotifications,
        unreadNotificationCount,
        recentCandidates,
        controlledDemoPollingMode,
        setControlledDemoPollingMode,
        getConstituencyForVoterElection,
        getCandidatesForVoterElection,
        getElectionParticipationStatus,
        hasParticipatedInElection,
        checkBallotEligibilityForVoter,
        updateCurrentVoterProfile,
        completeDemoParticipationForCurrentVoter,
        simulateParticipationForCurrentVoter: completeDemoParticipationForCurrentVoter,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearAllNotifications,
        recordCandidateView,
        updateVoterProfile,
        castSimulatedVote,
      }}
    >
      {children}
    </VoterContext.Provider>
  );
}

export function useVoter() {
  const ctx = useContext(VoterContext);
  if (!ctx) {
    throw new Error('useVoter must be used within a VoterProvider');
  }
  return ctx;
}
