import type { PrismaClient, ResultStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';
import type { SafeAdminUser } from '../auth/auth.types.js';
import {
  ForbiddenProblemError,
  NotFoundProblemError,
  ValidationProblemError,
} from '../../common/errors/problemDetails.js';
import type {
  BaseAnalyticsResponse,
  NationalElectionOverviewData,
  StateLevelOverviewData,
  ElectionSpecificOverviewData,
  VoterParticipationAnalyticsData,
  CandidatePartyAnalyticsData,
  SyntheticCountingAnalyticsData,
  AdministrativeAuditAnalyticsData,
} from './analytics.types.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class AnalyticsService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTtlMs = 15000; // 15-second cache TTL for aggregates

  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  public clearCache(): void {
    this.cache.clear();
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCached<T>(key: string, data: T, ttlMs = this.defaultTtlMs): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Enforces jurisdiction boundary for admin user.
   */
  public assertStateJurisdiction(admin: SafeAdminUser, targetStateId: string): void {
    if (admin.role === 'SUPER_ADMIN' || admin.role === 'NATIONAL_ADMIN' || admin.role === 'READ_ONLY_AUDITOR') {
      return;
    }
    if (admin.role === 'STATE_ADMIN') {
      if (!admin.assignedStateId || admin.assignedStateId !== targetStateId) {
        throw new ForbiddenProblemError(
          `Access denied: State Administrator is restricted to state '${admin.assignedStateId}' and cannot view state '${targetStateId}'.`
        );
      }
      return;
    }
    throw new ForbiddenProblemError('Access denied: Insufficient scope to access state-level analytics.');
  }

  public assertElectionJurisdiction(admin: SafeAdminUser, electionStateId?: string | null): void {
    if (admin.role === 'SUPER_ADMIN' || admin.role === 'NATIONAL_ADMIN' || admin.role === 'READ_ONLY_AUDITOR') {
      return;
    }
    if (admin.role === 'STATE_ADMIN') {
      if (electionStateId && admin.assignedStateId !== electionStateId) {
        throw new ForbiddenProblemError(
          `Access denied: State Administrator is restricted to state '${admin.assignedStateId}'.`
        );
      }
      return;
    }
  }

  // ============================================================================
  // DOMAIN A: NATIONAL ELECTION OVERVIEW
  // ============================================================================

  public async getNationalOverview(
    admin: SafeAdminUser,
    filters?: { year?: number; status?: string; electionType?: string; stateId?: string }
  ): Promise<BaseAnalyticsResponse<NationalElectionOverviewData>> {
    if (admin.role === 'STATE_ADMIN' && !filters?.stateId) {
      // Auto-restrict state admin to their own state
      filters = { ...filters, stateId: admin.assignedStateId ?? undefined };
    } else if (admin.role === 'STATE_ADMIN' && filters?.stateId) {
      this.assertStateJurisdiction(admin, filters.stateId);
    }

    const cacheKey = `national_${admin.role}_${admin.assignedStateId ?? 'ALL'}_${JSON.stringify(filters ?? {})}`;
    const cached = this.getCached<BaseAnalyticsResponse<NationalElectionOverviewData>>(cacheKey);
    if (cached) return cached;

    const whereElection: any = {};
    if (filters?.year) whereElection.year = filters.year;
    if (filters?.status) whereElection.status = filters.status;
    if (filters?.electionType) whereElection.type = filters.electionType;
    if (filters?.stateId) whereElection.stateId = filters.stateId;

    const [elections, mappings, states] = await Promise.all([
      this.prisma.election.findMany({
        where: whereElection,
        select: {
          id: true,
          type: true,
          status: true,
          configReviewStatus: true,
          stateId: true,
        },
      }),
      this.prisma.electionConstituency.findMany({
        where: {
          status: 'ACTIVE',
          ...(filters?.stateId ? { election: { stateId: filters.stateId } } : {}),
        },
        select: {
          constituencyType: true,
          parliamentaryConstituencyId: true,
          assemblyConstituencyId: true,
        },
      }),
      this.prisma.state.findMany({
        select: { id: true, name: true, type: true },
      }),
    ]);

    const totalElections = elections.length;
    let lokSabhaCount = 0;
    let stateAssemblyCount = 0;
    const lifecycleDistribution: Record<string, number> = {};
    const configStatusCounts = {
      draft: 0,
      submittedForReview: 0,
      underReview: 0,
      approved: 0,
      changesRequested: 0,
    };
    const statesCoveredSet = new Set<string>();

    for (const e of elections) {
      if (e.type === 'LOK_SABHA') lokSabhaCount++;
      if (e.type === 'STATE_ASSEMBLY') stateAssemblyCount++;

      lifecycleDistribution[e.status] = (lifecycleDistribution[e.status] || 0) + 1;

      if (e.configReviewStatus === 'DRAFT') configStatusCounts.draft++;
      else if (e.configReviewStatus === 'SUBMITTED_FOR_REVIEW') configStatusCounts.submittedForReview++;
      else if (e.configReviewStatus === 'UNDER_REVIEW') configStatusCounts.underReview++;
      else if (e.configReviewStatus === 'APPROVED') configStatusCounts.approved++;
      else if (e.configReviewStatus === 'CHANGES_REQUESTED') configStatusCounts.changesRequested++;

      if (e.stateId) statesCoveredSet.add(e.stateId);
    }

    let parliamentaryAssigned = 0;
    let assemblyAssigned = 0;
    for (const m of mappings) {
      if (m.constituencyType === 'PARLIAMENTARY') parliamentaryAssigned++;
      if (m.constituencyType === 'ASSEMBLY') assemblyAssigned++;
    }

    const [publishedResultsCount, awaitingReviewCount] = await Promise.all([
      this.prisma.countingSession.count({ where: { isPublished: true } }),
      this.prisma.countingSession.count({ where: { status: 'RESULT_READY_FOR_REVIEW' } }),
    ]);

    const statesCoveredList = states
      .filter((s) => statesCoveredSet.has(s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        code: s.id,
        electionCount: elections.filter((e) => e.stateId === s.id).length,
      }));

    const resultData: NationalElectionOverviewData = {
      totalElections,
      electionsByType: {
        lokSabha: lokSabhaCount,
        stateAssembly: stateAssemblyCount,
      },
      electionsByLifecycleStatus: lifecycleDistribution as any,
      totalAssignedConstituencies: {
        parliamentary: parliamentaryAssigned,
        assembly: assemblyAssigned,
        total: parliamentaryAssigned + assemblyAssigned,
      },
      statesCoveredCount: statesCoveredSet.size,
      statesCovered: statesCoveredList,
      configurationStatusCounts: configStatusCounts,
      milestoneAlerts: {
        pollingActiveCount: lifecycleDistribution['POLLING_ACTIVE'] || 0,
        upcomingMilestonesCount: (lifecycleDistribution['UPCOMING'] || 0) + (lifecycleDistribution['NOMINATION_OPEN'] || 0),
        completedElectionsCount: (lifecycleDistribution['POLLING_COMPLETED'] || 0) + (lifecycleDistribution['RESULTS_DECLARED'] || 0) + (lifecycleDistribution['ARCHIVED'] || 0),
        awaitingResultReviewCount: awaitingReviewCount,
        publishedResultsCount,
      },
    };

    const response: BaseAnalyticsResponse<NationalElectionOverviewData> = {
      isSimulated: true,
      disclaimer: 'SIMULATED DEMO DATA - NOT OFFICIAL ELECTION DATA',
      generatedAt: new Date().toISOString(),
      scope: filters?.stateId ? `STATE_${filters.stateId}` : 'NATIONAL',
      data: resultData,
    };

    this.setCached(cacheKey, response);
    return response;
  }

  // ============================================================================
  // DOMAIN A: STATE-LEVEL ANALYTICS
  // ============================================================================

  public async getStateOverview(
    admin: SafeAdminUser,
    stateId: string,
    filters?: { year?: number; electionType?: string }
  ): Promise<BaseAnalyticsResponse<StateLevelOverviewData>> {
    this.assertStateJurisdiction(admin, stateId);

    const cacheKey = `state_${stateId}_${JSON.stringify(filters ?? {})}`;
    const cached = this.getCached<BaseAnalyticsResponse<StateLevelOverviewData>>(cacheKey);
    if (cached) return cached;

    const state = await this.prisma.state.findUnique({
      where: { id: stateId },
      include: {
        parliamentarySeats: { select: { id: true } },
        assemblySeats: { select: { id: true } },
      },
    });

    if (!state) {
      throw new NotFoundProblemError(`State with ID '${stateId}' was not found.`);
    }

    const whereElection: any = {
      OR: [{ stateId }, { type: 'LOK_SABHA' }],
    };
    if (filters?.year) whereElection.year = filters.year;
    if (filters?.electionType) whereElection.type = filters.electionType;

    const [elections, nominations, demoParticipationCount, countingSessions] = await Promise.all([
      this.prisma.election.findMany({
        where: whereElection,
        include: {
          constituencyMappings: {
            where: { status: 'ACTIVE' },
            select: { id: true, constituencyType: true, parliamentaryConstituencyId: true, assemblyConstituencyId: true },
          },
        },
      }),
      this.prisma.candidateNomination.findMany({
        where: {
          status: 'APPROVED',
          OR: [
            { assemblyConstituency: { stateId } },
            { parliamentaryConstituency: { stateId } },
          ],
        },
        select: { id: true, partyId: true, isIndependent: true },
      }),
      this.prisma.demoParticipation.count({
        where: {
          OR: [
            { assemblyConstituency: { stateId } },
            { parliamentaryConstituency: { stateId } },
          ],
        },
      }),
      this.prisma.countingSession.findMany({
        where: {
          OR: [
            { assemblyConstituency: { stateId } },
            { parliamentaryConstituency: { stateId } },
          ],
        },
        select: { id: true, status: true, isPublished: true },
      }),
    ]);

    const lifecycleDistribution: Record<string, number> = {};
    let assemblyElectionsCount = 0;
    const electionList = elections.map((e) => {
      if (e.type === 'STATE_ASSEMBLY') assemblyElectionsCount++;
      lifecycleDistribution[e.status] = (lifecycleDistribution[e.status] || 0) + 1;
      return {
        id: e.id,
        name: e.name,
        type: e.type,
        year: e.year,
        status: e.status,
        configReviewStatus: e.configReviewStatus,
        constituenciesCount: e.constituencyMappings.length,
        isPollingActive: e.status === 'POLLING_ACTIVE',
      };
    });

    const activeParties = new Set<string>();
    for (const nom of nominations) {
      if (nom.partyId) activeParties.add(nom.partyId);
    }

    let completedSessions = 0;
    let publishedSessions = 0;
    let tiedSessions = 0;
    for (const s of countingSessions) {
      if (s.status === 'COUNTING_COMPLETED' || s.status === 'RESULT_READY_FOR_REVIEW' || s.status === 'PUBLISHED') {
        completedSessions++;
      }
      if (s.isPublished) publishedSessions++;
      if (s.status === 'TIED') tiedSessions++;
    }

    // Registered demo voters in state
    const demoVotersInState = await this.prisma.voterProfile.count({
      where: { stateId },
    });

    const simulatedRate =
      demoVotersInState > 0 ? Number(((demoParticipationCount / demoVotersInState) * 100).toFixed(2)) : null;

    const data: StateLevelOverviewData = {
      state: {
        id: state.id,
        name: state.name,
        code: state.id,
        type: state.type,
      },
      totalElections: elections.length,
      assemblyElectionsCount,
      parliamentaryConstituenciesCount: state.parliamentarySeats.length,
      assemblyConstituenciesCount: state.assemblySeats.length,
      lifecycleDistribution,
      approvedNominationsCount: nominations.length,
      activePartiesCount: activeParties.size,
      participationSummary: {
        totalParticipated: demoParticipationCount,
        simulatedRatePercentage: simulatedRate,
      },
      countingSummary: {
        totalSessions: countingSessions.length,
        completedSessions,
        publishedSessions,
        tiedSessions,
      },
      elections: electionList,
    };

    const response: BaseAnalyticsResponse<StateLevelOverviewData> = {
      isSimulated: true,
      disclaimer: 'SIMULATED DEMO DATA - NOT OFFICIAL ELECTION DATA',
      generatedAt: new Date().toISOString(),
      scope: `STATE_${stateId}`,
      data,
    };

    this.setCached(cacheKey, response);
    return response;
  }

  // ============================================================================
  // DOMAIN A: ELECTION-SPECIFIC OVERVIEW
  // ============================================================================

  public async getElectionOverview(
    admin: SafeAdminUser,
    electionId: string
  ): Promise<BaseAnalyticsResponse<ElectionSpecificOverviewData>> {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      include: {
        constituencyMappings: {
          where: { status: 'ACTIVE' },
          include: {
            parliamentaryConstituency: { select: { id: true, name: true, state: { select: { name: true } } } },
            assemblyConstituency: { select: { id: true, name: true, state: { select: { name: true } } } },
          },
        },
        candidateNominations: {
          include: {
            candidate: { select: { id: true, fullName: true } },
            party: { select: { id: true, name: true, abbreviation: true, partyType: true } },
          },
        },
        scheduleMilestones: true,
        countingSessions: {
          select: {
            id: true,
            status: true,
            isPublished: true,
            parliamentaryConstituencyId: true,
            assemblyConstituencyId: true,
          },
        },
      },
    });

    if (!election) {
      throw new NotFoundProblemError(`Election '${electionId}' was not found.`);
    }

    this.assertElectionJurisdiction(admin, election.stateId);

    // Get participation aggregates per constituency
    const participations = await this.prisma.demoParticipation.groupBy({
      by: ['constituencyType', 'parliamentaryConstituencyId', 'assemblyConstituencyId'],
      where: { electionId },
      _count: { id: true },
    });

    const participationMap = new Map<string, number>();
    for (const p of participations) {
      const key = p.parliamentaryConstituencyId || p.assemblyConstituencyId || '';
      if (key) participationMap.set(key, p._count.id);
    }

    const sessionMap = new Map<string, { status: ResultStatus; isPublished: boolean }>();
    for (const s of election.countingSessions) {
      const key = s.parliamentaryConstituencyId || s.assemblyConstituencyId || '';
      if (key) sessionMap.set(key, { status: s.status, isPublished: s.isPublished });
    }

    const candidateCountMap = new Map<string, number>();
    const nominationsByStatus: Record<string, number> = {};
    const partyStatsMap = new Map<string, { party: any; nominationsCount: number; approvedCount: number }>();
    let independentCandidatesCount = 0;

    for (const nom of election.candidateNominations) {
      nominationsByStatus[nom.status] = (nominationsByStatus[nom.status] || 0) + 1;
      const key = nom.parliamentaryConstituencyId || nom.assemblyConstituencyId || '';
      if (key && nom.status === 'APPROVED') {
        candidateCountMap.set(key, (candidateCountMap.get(key) || 0) + 1);
      }
      if (nom.isIndependent) independentCandidatesCount++;

      if (nom.party) {
        const p = partyStatsMap.get(nom.party.id) || {
          party: nom.party,
          nominationsCount: 0,
          approvedCount: 0,
        };
        p.nominationsCount++;
        if (nom.status === 'APPROVED') p.approvedCount++;
        partyStatsMap.set(nom.party.id, p);
      }
    }

    const constituenciesList = election.constituencyMappings.map((m) => {
      const isPc = m.constituencyType === 'PARLIAMENTARY';
      const c = isPc ? m.parliamentaryConstituency : m.assemblyConstituency;
      const cId = c?.id || '';
      const cName = c?.name || '';
      const stateName = c?.state?.name;
      const cStatus = sessionMap.get(cId);

      return {
        id: cId,
        name: cName,
        stateName,
        status: m.status,
        candidatesCount: candidateCountMap.get(cId) || 0,
        participationCount: participationMap.get(cId) || 0,
        countingStatus: cStatus ? cStatus.status : ('NOT_STARTED' as const),
        isPublished: cStatus ? cStatus.isPublished : false,
      };
    });

    const now = new Date();
    const timeline = election.scheduleMilestones
      .sort((a, b) => ((a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0)))
      .map((m) => {
        const d = m.startAt || m.endAt || now;
        return {
          id: m.id,
          milestoneType: m.milestoneType,
          scheduledDate: d.toISOString(),
          status: m.status,
          isPassed: (m.endAt ? m.endAt < now : d < now),
        };
      });

    let completedCount = 0;
    let publishedCount = 0;
    let tiedCount = 0;
    let reviewPendingCount = 0;

    for (const s of election.countingSessions) {
      if (s.status === 'COUNTING_COMPLETED' || s.status === 'RESULT_READY_FOR_REVIEW' || s.status === 'PUBLISHED') {
        completedCount++;
      }
      if (s.isPublished) publishedCount++;
      if (s.status === 'TIED') tiedCount++;
      if (s.status === 'RESULT_READY_FOR_REVIEW') reviewPendingCount++;
    }

    const data: ElectionSpecificOverviewData = {
      election: {
        id: election.id,
        name: election.name,
        type: election.type,
        year: election.year,
        status: election.status,
        stateId: election.stateId,
        configReviewStatus: election.configReviewStatus,
        scheduleTimezone: election.scheduleTimezone,
        pollingStartDate: election.pollingStartDate.toISOString(),
        pollingEndDate: election.pollingEndDate.toISOString(),
        countingDate: election.countingDate.toISOString(),
        resultDate: election.resultDate.toISOString(),
      },
      constituenciesSummary: {
        totalAssigned: election.constituencyMappings.length,
        type: election.type === 'LOK_SABHA' ? 'PARLIAMENTARY' : 'ASSEMBLY',
        constituencies: constituenciesList,
      },
      candidateAndPartySummary: {
        totalCandidates: election.candidateNominations.length,
        nominationsByStatus: nominationsByStatus as any,
        participatingPartiesCount: partyStatsMap.size,
        independentCandidatesCount,
        parties: Array.from(partyStatsMap.values()).map((item) => ({
          id: item.party.id,
          name: item.party.name,
          code: item.party.abbreviation,
          partyType: item.party.partyType,
          nominationsCount: item.nominationsCount,
          approvedCount: item.approvedCount,
        })),
      },
      scheduleTimeline: timeline,
      countingProgress: {
        totalSessions: election.countingSessions.length,
        completedCount,
        publishedCount,
        tiedCount,
        reviewPendingCount,
      },
    };

    return {
      isSimulated: true,
      disclaimer: 'SIMULATED DEMO DATA - NOT OFFICIAL ELECTION DATA',
      generatedAt: new Date().toISOString(),
      scope: `ELECTION_${electionId}`,
      data,
    };
  }

  // ============================================================================
  // DOMAIN B: VOTER PARTICIPATION ANALYTICS (ZERO CHOICE / AGGREGATE ONLY)
  // ============================================================================

  public async getParticipationAnalytics(
    admin: SafeAdminUser,
    filters?: { electionId?: string; stateId?: string; constituencyType?: string }
  ): Promise<BaseAnalyticsResponse<VoterParticipationAnalyticsData>> {
    if (admin.role === 'STATE_ADMIN') {
      if (filters?.stateId && filters.stateId !== admin.assignedStateId) {
        throw new ForbiddenProblemError('Access denied: State Administrator scope restricted.');
      }
      filters = { ...filters, stateId: admin.assignedStateId ?? undefined };
    }

    const where: any = {};
    if (filters?.electionId) where.electionId = filters.electionId;
    if (filters?.constituencyType) where.constituencyType = filters.constituencyType;
    if (filters?.stateId) {
      where.OR = [
        { parliamentaryConstituency: { stateId: filters.stateId } },
        { assemblyConstituency: { stateId: filters.stateId } },
      ];
    }

    const [totalParticipations, demoVoterCount, electionAggs, constituencyAggs, sampleParticipations] =
      await Promise.all([
        this.prisma.demoParticipation.count({ where }),
        this.prisma.voterProfile.count({
          where: filters?.stateId ? { stateId: filters.stateId } : {},
        }),
        this.prisma.demoParticipation.groupBy({
          by: ['electionId'],
          where,
          _count: { id: true },
        }),
        this.prisma.demoParticipation.groupBy({
          by: ['constituencyType', 'parliamentaryConstituencyId', 'assemblyConstituencyId'],
          where,
          _count: { id: true },
        }),
        this.prisma.demoParticipation.findMany({
          where,
          select: { participatedAt: true },
          take: 1000,
          orderBy: { participatedAt: 'asc' },
        }),
      ]);

    // Breakdowns
    const electionsInfo = await this.prisma.election.findMany({
      where: { id: { in: electionAggs.map((e) => e.electionId) } },
      select: { id: true, name: true, type: true },
    });
    const electionInfoMap = new Map(electionsInfo.map((e) => [e.id, e]));

    let lsCount = 0;
    let saCount = 0;
    const byElection = electionAggs.map((agg) => {
      const eInfo = electionInfoMap.get(agg.electionId);
      if (eInfo?.type === 'LOK_SABHA') lsCount += agg._count.id;
      if (eInfo?.type === 'STATE_ASSEMBLY') saCount += agg._count.id;
      return {
        electionId: agg.electionId,
        electionName: eInfo?.name || agg.electionId,
        electionType: eInfo?.type || ('LOK_SABHA' as const),
        participatedCount: agg._count.id,
      };
    });

    // Constituency details & Privacy Threshold (minimum 5 votes to avoid deanonymization in small groups)
    const pcIds = constituencyAggs.map((c) => c.parliamentaryConstituencyId).filter(Boolean) as string[];
    const acIds = constituencyAggs.map((c) => c.assemblyConstituencyId).filter(Boolean) as string[];

    const [pcs, acs] = await Promise.all([
      this.prisma.parliamentaryConstituency.findMany({
        where: { id: { in: pcIds } },
        select: { id: true, name: true, stateId: true },
      }),
      this.prisma.assemblyConstituency.findMany({
        where: { id: { in: acIds } },
        select: { id: true, name: true, stateId: true },
      }),
    ]);

    const nameMap = new Map<string, { name: string; stateId: string }>();
    for (const p of pcs) nameMap.set(p.id, { name: p.name, stateId: p.stateId });
    for (const a of acs) nameMap.set(a.id, { name: a.name, stateId: a.stateId });

    const byConstituency = constituencyAggs.map((c) => {
      const id = c.parliamentaryConstituencyId || c.assemblyConstituencyId || '';
      const info = nameMap.get(id);
      const count = c._count.id;
      const isSmallGroup = count < 5;

      return {
        constituencyId: id,
        constituencyName: info?.name || id,
        constituencyType: c.constituencyType || ('PARLIAMENTARY' as const),
        stateId: info?.stateId,
        participatedCount: isSmallGroup ? 0 : count,
        suppressedDueToPrivacyThreshold: isSmallGroup,
      };
    });

    // Date trends
    const dateMap = new Map<string, number>();
    for (const p of sampleParticipations) {
      const day = p.participatedAt.toISOString().slice(0, 10);
      dateMap.set(day, (dateMap.get(day) || 0) + 1);
    }
    const trends = Array.from(dateMap.entries()).map(([date, participatedCount]) => ({
      date,
      participatedCount,
    }));

    const demoRate =
      demoVoterCount > 0 ? Number(((totalParticipations / demoVoterCount) * 100).toFixed(2)) : null;

    const data: VoterParticipationAnalyticsData = {
      metricName: 'Simulated Demo Account Participation',
      classification: 'DEMO_PARTICIPATION_AGGREGATE',
      totalEligibleDemoAccounts: demoVoterCount,
      totalParticipatingDemoAccounts: totalParticipations,
      demoParticipationRatePercentage: demoRate,
      participationByType: {
        lokSabha: lsCount,
        stateAssembly: saCount,
      },
      participationByElection: byElection,
      participationByConstituency: byConstituency,
      trends,
    };

    return {
      isSimulated: true,
      disclaimer: 'SIMULATED DEMO DATA - NOT OFFICIAL ELECTION DATA',
      generatedAt: new Date().toISOString(),
      scope: filters?.stateId ? `STATE_${filters.stateId}` : 'ALL_PARTICIPATION',
      data,
    };
  }

  // ============================================================================
  // DOMAIN C: CANDIDATE & PARTY ANALYTICS
  // ============================================================================

  public async getCandidatePartyAnalytics(
    _admin: SafeAdminUser,
    filters?: { electionId?: string }
  ): Promise<BaseAnalyticsResponse<CandidatePartyAnalyticsData>> {
    const whereNom: any = {};
    if (filters?.electionId) whereNom.electionId = filters.electionId;

    const [parties, candidates, nominations] = await Promise.all([
      this.prisma.politicalParty.findMany({
        select: {
          id: true,
          name: true,
          abbreviation: true,
          partyType: true,
          nominations: { select: { id: true, status: true, electionId: true } },
        },
      }),
      this.prisma.candidate.findMany({
        select: { id: true, isActive: true },
      }),
      this.prisma.candidateNomination.findMany({
        where: whereNom,
        select: { id: true, status: true, isIndependent: true },
      }),
    ]);

    let nationalParties = 0;
    let stateParties = 0;
    let unrecognizedParties = 0;
    const partySummaries = parties.map((p) => {
      if (p.partyType === 'NATIONAL') nationalParties++;
      else if (p.partyType === 'STATE') stateParties++;
      else unrecognizedParties++;

      const contestedElections = new Set(p.nominations.map((n) => n.electionId));
      return {
        partyId: p.id,
        partyName: p.name,
        partyCode: p.abbreviation,
        partyType: p.partyType,
        totalNominations: p.nominations.length,
        approvedNominations: p.nominations.filter((n) => n.status === 'APPROVED').length,
        contestedElectionsCount: contestedElections.size,
      };
    });

    const nominationsByStatus: Record<string, number> = {};
    let independentCount = 0;
    for (const nom of nominations) {
      nominationsByStatus[nom.status] = (nominationsByStatus[nom.status] || 0) + 1;
      if (nom.isIndependent) independentCount++;
    }

    const data: CandidatePartyAnalyticsData = {
      totalRegisteredParties: parties.length,
      partiesByType: {
        national: nationalParties,
        state: stateParties,
        unrecognized: unrecognizedParties,
      },
      totalCandidates: candidates.length,
      activeCandidatesCount: candidates.filter((c) => c.isActive).length,
      nominationsByStatus: nominationsByStatus as any,
      independentCandidatesCount: independentCount,
      partySummaries,
    };

    return {
      isSimulated: true,
      disclaimer: 'SIMULATED DEMO DATA - NOT OFFICIAL ELECTION DATA',
      generatedAt: new Date().toISOString(),
      scope: filters?.electionId ? `ELECTION_${filters.electionId}` : 'ALL_PARTIES',
      data,
    };
  }

  // ============================================================================
  // DOMAIN D: INDEPENDENT SYNTHETIC COUNTING ANALYTICS
  // ============================================================================

  public async getCountingAnalytics(
    admin: SafeAdminUser,
    filters?: { electionId?: string; stateId?: string; publishedOnly?: boolean }
  ): Promise<BaseAnalyticsResponse<SyntheticCountingAnalyticsData>> {
    if (admin.role === 'STATE_ADMIN') {
      if (filters?.stateId && filters.stateId !== admin.assignedStateId) {
        throw new ForbiddenProblemError('Access denied: State Administrator scope restricted.');
      }
      filters = { ...filters, stateId: admin.assignedStateId ?? undefined };
    }

    const where: any = {};
    if (filters?.electionId) where.electionId = filters.electionId;
    if (filters?.publishedOnly) where.isPublished = true;
    if (filters?.stateId) {
      where.OR = [
        { parliamentaryConstituency: { stateId: filters.stateId } },
        { assemblyConstituency: { stateId: filters.stateId } },
      ];
    }

    const sessions = await this.prisma.countingSession.findMany({
      where,
      include: {
        election: { select: { id: true, name: true } },
        parliamentaryConstituency: { select: { id: true, name: true } },
        assemblyConstituency: { select: { id: true, name: true } },
        winnerCandidate: {
          select: {
            id: true,
            fullName: true,
            nominations: {
              where: filters?.electionId ? { electionId: filters.electionId } : {},
              select: { party: { select: { id: true, name: true, abbreviation: true } } },
            },
          },
        },
        tallies: {
          include: {
            party: { select: { id: true, name: true, abbreviation: true } },
            candidate: { select: { id: true, fullName: true } },
          },
        },
        tieResolution: true,
      },
    });

    let completedCount = 0;
    let publishedCount = 0;
    let readyForReviewCount = 0;
    let underReviewCount = 0;
    let tiedCount = 0;
    let resolvedTiesCount = 0;
    let totalVotes = 0;
    let totalNota = 0;
    let totalRejected = 0;

    const partySeats = new Map<string, { party: any; seatsWon: number; seatsLeading: number; votes: number }>();
    const publishedWinnersList: any[] = [];

    for (const s of sessions) {
      totalVotes += s.totalCountedVotes;
      totalNota += s.notaVotes;
      totalRejected += s.rejectedVotes;

      if (s.status === 'COUNTING_COMPLETED' || s.status === 'RESULT_READY_FOR_REVIEW' || s.status === 'PUBLISHED') {
        completedCount++;
      }
      if (s.isPublished) publishedCount++;
      if (s.status === 'RESULT_READY_FOR_REVIEW') readyForReviewCount++;
      if (s.status === 'UNDER_REVIEW') underReviewCount++;
      if (s.status === 'TIED') tiedCount++;
      if (s.tieResolution) resolvedTiesCount++;

      // Tally party votes and seats
      const sortedTallies = [...s.tallies].sort((a, b) => b.votes - a.votes);
      for (let rankIdx = 0; rankIdx < sortedTallies.length; rankIdx++) {
        const t = sortedTallies[rankIdx]!;
        if (t.party) {
          const pEntry = partySeats.get(t.party.id) || {
            party: t.party,
            seatsWon: 0,
            seatsLeading: 0,
            votes: 0,
          };
          pEntry.votes += t.votes;
          if (s.isPublished && s.winnerCandidateId === t.candidateId) {
            pEntry.seatsWon++;
          } else if (rankIdx === 0 && !s.isPublished) {
            pEntry.seatsLeading++;
          }
          partySeats.set(t.party.id, pEntry);
        }
      }

      // Record published winner
      if (s.isPublished && s.winnerCandidate) {
        const cName = s.parliamentaryConstituency?.name || s.assemblyConstituency?.name || '';
        const cId = s.parliamentaryConstituencyId || s.assemblyConstituencyId || '';
        const partyName = s.winnerCandidate.nominations[0]?.party?.name || 'Independent / Unaffiliated';

        publishedWinnersList.push({
          sessionId: s.id,
          electionId: s.electionId,
          constituencyId: cId,
          constituencyName: cName,
          winnerCandidateId: s.winnerCandidate.id,
          winnerCandidateName: s.winnerCandidate.fullName,
          winnerPartyName: partyName,
          totalVotes: s.totalCountedVotes,
          victoryMargin: s.victoryMargin,
          publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
        });
      }
    }

    const data: SyntheticCountingAnalyticsData = {
      metricName: 'Independent Synthetic Demo Counting Results',
      classification: 'SYNTHETIC_DEMO_COUNTING_INDEPENDENT',
      totalCountingSessions: sessions.length,
      completedCountingSessions: completedCount,
      sessionsAwaitingCompletion: sessions.length - completedCount,
      publishedSessionsCount: publishedCount,
      sessionsReadyForReviewCount: readyForReviewCount,
      sessionsUnderReviewCount: underReviewCount,
      tiedSessionsCount: tiedCount,
      resolvedTiesCount,
      totalSimulatedVotesCounted: totalVotes,
      totalSimulatedNotaVotes: totalNota,
      totalSimulatedRejectedVotes: totalRejected,
      partyWiseSeatDistribution: Array.from(partySeats.values()).map((ps) => ({
        partyId: ps.party.id,
        partyName: ps.party.name,
        partyCode: ps.party.abbreviation,
        seatsWon: ps.seatsWon,
        seatsLeading: ps.seatsLeading,
        totalSimulatedVotes: ps.votes,
      })),
      publishedWinners: publishedWinnersList,
    };

    return {
      isSimulated: true,
      disclaimer: 'SIMULATED DEMO DATA - NOT OFFICIAL ELECTION DATA',
      generatedAt: new Date().toISOString(),
      scope: filters?.stateId ? `STATE_${filters.stateId}` : 'ALL_COUNTING',
      data,
    };
  }

  // ============================================================================
  // DOMAIN E: ADMINISTRATIVE AUDIT ANALYTICS
  // ============================================================================

  public async getAuditAnalytics(
    _admin: SafeAdminUser,
    filters?: {
      domain?: string;
      actionType?: string;
      actorRole?: string;
      outcome?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<BaseAnalyticsResponse<AdministrativeAuditAnalyticsData>> {
    const where: any = {};
    if (filters?.domain) where.domain = filters.domain;
    if (filters?.actionType) where.actionType = filters.actionType;
    if (filters?.actorRole) where.actorRole = filters.actorRole;
    if (filters?.outcome) where.outcome = filters.outcome;

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;

    const [total, byOutcome, logs] = await Promise.all([
      this.prisma.adminActionLog.count({ where }),
      this.prisma.adminActionLog.groupBy({
        by: ['outcome'],
        where,
        _count: { id: true },
      }),
      this.prisma.adminActionLog.findMany({
        where,
        select: {
          id: true,
          timestamp: true,
          actorIdentifier: true,
          actorRole: true,
          actionType: true,
          domain: true,
          targetEntityId: true,
          outcome: true,
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    let successCount = 0;
    let failureCount = 0;
    for (const o of byOutcome) {
      if (o.outcome === 'SUCCESS') successCount = o._count.id;
      else failureCount += o._count.id;
    }

    const byRole: Record<string, number> = {};
    const byDomain: Record<string, number> = {};

    for (const log of logs) {
      if (log.actorRole) byRole[log.actorRole] = (byRole[log.actorRole] || 0) + 1;
      if (log.domain) byDomain[log.domain] = (byDomain[log.domain] || 0) + 1;
    }

    const data: AdministrativeAuditAnalyticsData = {
      totalActionsLogged: total,
      actionsByOutcome: {
        success: successCount,
        failure: failureCount,
      },
      actionsByRole: byRole,
      actionsByDomain: byDomain,
      recentActivity: logs.map((l) => ({
        id: l.id,
        timestamp: l.timestamp.toISOString(),
        actorIdentifier: l.actorIdentifier || 'ANONYMOUS',
        actorRole: l.actorRole,
        actionType: l.actionType,
        domain: l.domain,
        targetEntityId: l.targetEntityId,
        outcome: l.outcome,
      })),
    };

    return {
      isSimulated: true,
      disclaimer: 'SIMULATED DEMO DATA - NOT OFFICIAL ELECTION DATA',
      generatedAt: new Date().toISOString(),
      scope: 'ADMIN_AUDIT',
      data,
    };
  }

  // ============================================================================
  // PUBLIC SAFE ANALYTICS
  // ============================================================================

  public async getPublicAnalytics(filters?: { year?: number; electionType?: string; stateId?: string }) {
    const where: any = {
      status: { in: ['POLLING_ACTIVE', 'POLLING_COMPLETED', 'COUNTING', 'RESULTS_DECLARED', 'ARCHIVED'] },
    };
    if (filters?.year) where.year = filters.year;
    if (filters?.electionType) where.type = filters.electionType;
    if (filters?.stateId) where.stateId = filters.stateId;

    const [elections, publishedSessions] = await Promise.all([
      this.prisma.election.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          year: true,
          status: true,
          stateId: true,
          pollingStartDate: true,
          pollingEndDate: true,
          resultDate: true,
        },
      }),
      this.prisma.countingSession.findMany({
        where: { isPublished: true },
        select: {
          id: true,
          electionId: true,
          parliamentaryConstituency: { select: { id: true, name: true } },
          assemblyConstituency: { select: { id: true, name: true } },
          winnerCandidate: { select: { id: true, fullName: true } },
          victoryMargin: true,
          publishedAt: true,
        },
      }),
    ]);

    return {
      isSimulated: true,
      disclaimer: 'SIMULATED DEMO RESULTS - NOT OFFICIAL ELECTION DATA',
      generatedAt: new Date().toISOString(),
      elections: elections.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        year: e.year,
        status: e.status,
        stateId: e.stateId,
      })),
      publishedResultsCount: publishedSessions.length,
      publishedResults: publishedSessions.map((s) => ({
        sessionId: s.id,
        electionId: s.electionId,
        constituencyName: s.parliamentaryConstituency?.name || s.assemblyConstituency?.name || '',
        winnerCandidateName: s.winnerCandidate?.fullName || 'N/A',
        victoryMargin: s.victoryMargin,
        publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
      })),
    };
  }
}
