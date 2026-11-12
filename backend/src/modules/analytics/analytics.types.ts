import type {
  AdminRole,
  ElectionStatus,
  ElectionType,
  ConstituencyType,
  CandidateNominationStatus,
  ResultStatus,
} from '@prisma/client';

export interface BaseAnalyticsResponse<T> {
  isSimulated: true;
  disclaimer: string;
  generatedAt: string;
  scope: string;
  data: T;
}

// ============================================================================
// DOMAIN A: ELECTION ADMINISTRATION ANALYTICS
// ============================================================================

export interface NationalElectionOverviewData {
  totalElections: number;
  electionsByType: {
    lokSabha: number;
    stateAssembly: number;
  };
  electionsByLifecycleStatus: Record<ElectionStatus, number>;
  totalAssignedConstituencies: {
    parliamentary: number;
    assembly: number;
    total: number;
  };
  statesCoveredCount: number;
  statesCovered: Array<{
    id: string;
    name: string;
    code: string;
    electionCount: number;
  }>;
  configurationStatusCounts: {
    draft: number;
    submittedForReview: number;
    underReview: number;
    approved: number;
    changesRequested: number;
  };
  milestoneAlerts: {
    pollingActiveCount: number;
    upcomingMilestonesCount: number;
    completedElectionsCount: number;
    awaitingResultReviewCount: number;
    publishedResultsCount: number;
  };
}

export interface StateLevelOverviewData {
  state: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
  totalElections: number;
  assemblyElectionsCount: number;
  parliamentaryConstituenciesCount: number;
  assemblyConstituenciesCount: number;
  lifecycleDistribution: Record<string, number>;
  approvedNominationsCount: number;
  activePartiesCount: number;
  participationSummary: {
    totalParticipated: number;
    simulatedRatePercentage: number | null;
  };
  countingSummary: {
    totalSessions: number;
    completedSessions: number;
    publishedSessions: number;
    tiedSessions: number;
  };
  elections: Array<{
    id: string;
    name: string;
    type: ElectionType;
    year: number;
    status: ElectionStatus;
    configReviewStatus: string;
    constituenciesCount: number;
    isPollingActive: boolean;
  }>;
}

export interface ElectionSpecificOverviewData {
  election: {
    id: string;
    name: string;
    type: ElectionType;
    year: number;
    status: ElectionStatus;
    stateId: string | null;
    configReviewStatus: string;
    scheduleTimezone: string;
    pollingStartDate: string;
    pollingEndDate: string;
    countingDate: string;
    resultDate: string;
  };
  constituenciesSummary: {
    totalAssigned: number;
    type: ConstituencyType;
    constituencies: Array<{
      id: string;
      name: string;
      stateName?: string;
      status: string;
      candidatesCount: number;
      participationCount: number;
      countingStatus: ResultStatus | 'NOT_STARTED';
      isPublished: boolean;
    }>;
  };
  candidateAndPartySummary: {
    totalCandidates: number;
    nominationsByStatus: Record<CandidateNominationStatus, number>;
    participatingPartiesCount: number;
    independentCandidatesCount: number;
    parties: Array<{
      id: string;
      name: string;
      code: string;
      partyType: string;
      nominationsCount: number;
      approvedCount: number;
    }>;
  };
  scheduleTimeline: Array<{
    id: string;
    milestoneType: string;
    scheduledDate: string;
    status: string;
    isPassed: boolean;
  }>;
  countingProgress: {
    totalSessions: number;
    completedCount: number;
    publishedCount: number;
    tiedCount: number;
    reviewPendingCount: number;
  };
}

// ============================================================================
// DOMAIN B: VOTER PARTICIPATION ANALYTICS (STRICT PRIVACY / ZERO-CHOICE)
// ============================================================================

export interface VoterParticipationAnalyticsData {
  metricName: 'Simulated Demo Account Participation';
  classification: 'DEMO_PARTICIPATION_AGGREGATE';
  totalEligibleDemoAccounts: number;
  totalParticipatingDemoAccounts: number;
  demoParticipationRatePercentage: number | null;
  participationByType: {
    lokSabha: number;
    stateAssembly: number;
  };
  participationByElection: Array<{
    electionId: string;
    electionName: string;
    electionType: ElectionType;
    participatedCount: number;
  }>;
  participationByConstituency: Array<{
    constituencyId: string;
    constituencyName: string;
    constituencyType: ConstituencyType;
    stateId?: string;
    participatedCount: number;
    suppressedDueToPrivacyThreshold?: boolean;
  }>;
  trends: Array<{
    date: string;
    participatedCount: number;
  }>;
}

// ============================================================================
// DOMAIN C: CANDIDATE & PARTY ANALYTICS
// ============================================================================

export interface CandidatePartyAnalyticsData {
  totalRegisteredParties: number;
  partiesByType: {
    national: number;
    state: number;
    unrecognized: number;
  };
  totalCandidates: number;
  activeCandidatesCount: number;
  nominationsByStatus: Record<CandidateNominationStatus, number>;
  independentCandidatesCount: number;
  partySummaries: Array<{
    partyId: string;
    partyName: string;
    partyCode: string;
    partyType: string;
    totalNominations: number;
    approvedNominations: number;
    contestedElectionsCount: number;
  }>;
}

// ============================================================================
// DOMAIN D: SYNTHETIC COUNTING ANALYTICS (INDEPENDENT DATASET)
// ============================================================================

export interface SyntheticCountingAnalyticsData {
  metricName: 'Independent Synthetic Demo Counting Results';
  classification: 'SYNTHETIC_DEMO_COUNTING_INDEPENDENT';
  totalCountingSessions: number;
  completedCountingSessions: number;
  sessionsAwaitingCompletion: number;
  publishedSessionsCount: number;
  sessionsReadyForReviewCount: number;
  sessionsUnderReviewCount: number;
  tiedSessionsCount: number;
  resolvedTiesCount: number;
  totalSimulatedVotesCounted: number;
  totalSimulatedNotaVotes: number;
  totalSimulatedRejectedVotes: number;
  partyWiseSeatDistribution: Array<{
    partyId: string;
    partyName: string;
    partyCode: string;
    seatsWon: number;
    seatsLeading: number;
    totalSimulatedVotes: number;
  }>;
  publishedWinners: Array<{
    sessionId: string;
    electionId: string;
    constituencyId: string;
    constituencyName: string;
    winnerCandidateId: string;
    winnerCandidateName: string;
    winnerPartyName: string;
    totalVotes: number;
    victoryMargin: number;
    publishedAt: string | null;
  }>;
}

// ============================================================================
// DOMAIN E: ADMINISTRATIVE AUDIT ANALYTICS
// ============================================================================

export interface AdministrativeAuditAnalyticsData {
  totalActionsLogged: number;
  actionsByOutcome: {
    success: number;
    failure: number;
  };
  actionsByRole: Record<string, number>;
  actionsByDomain: Record<string, number>;
  recentActivity: Array<{
    id: string;
    timestamp: string;
    actorIdentifier: string;
    actorRole: AdminRole | null;
    actionType: string;
    domain: string;
    targetEntityId: string;
    outcome: string;
  }>;
}

// ============================================================================
// DATA EXPORT SPECIFICATIONS
// ============================================================================

export type ExportFormat = 'csv' | 'json';

export type ExportDomain =
  | 'national'
  | 'state'
  | 'election'
  | 'participation'
  | 'counting'
  | 'audit';

export interface ExportResult {
  filename: string;
  mimeType: string;
  content: string;
}
