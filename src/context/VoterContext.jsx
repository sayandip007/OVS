import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useElection } from './ElectionContext';
import {
  getVoterEligibleElections,
  getVoterConstituencyIdForElection,
  getVoterParticipationSummary,
  getCandidatesForElectionConstituency,
} from '../utils/electionHelpers';

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
    updateVoterProfile,
    castSimulatedVote,
  } = useElection();

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
      };
      return {
        electionId: elId,
        status: entry.status,
        participatedAt: entry.participatedAt,
      };
    });
    return {
      ...raw,
      pendingCount: Math.max(0, raw.totalCount - raw.completedCount),
      items,
    };
  }, [currentVoter, eligibleElections]);

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

  const hasParticipatedInElection = useCallback(
    (electionId) => {
      if (!currentVoter || !electionId) return false;
      return currentVoter.elections?.[electionId]?.status === 'VOTED';
    },
    [currentVoter]
  );

  const submitBallotForElection = useCallback(
    ({ electionId, candidateOrNotaId }) => {
      if (!currentVoter) {
        return { ok: false, error: 'Voter not authenticated.' };
      }
      const targetElection = eligibleElections.find(
        (e) => (e.id || e.electionId) === electionId
      );
      if (!targetElection) {
        return { ok: false, error: 'Election not found for this voter.' };
      }
      const constituencyId = getVoterConstituencyIdForElection(
        currentVoter,
        targetElection
      );
      return castSimulatedVote({
        voterId: currentVoter.id || currentVoter.voterId,
        electionId,
        constituencyId,
        selectedCandidateIdOrNota: candidateOrNotaId,
      });
    },
    [currentVoter, eligibleElections, castSimulatedVote]
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
        getConstituencyForVoterElection,
        getCandidatesForVoterElection,
        hasParticipatedInElection,
        submitBallotForElection,
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
