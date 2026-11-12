import {
  type PrismaClient,
  type ConstituencyType,
  CandidateNominationStatus,
  ResultStatus,
} from '@prisma/client';
import { prisma } from '../../config/database.js';
import {
  AppProblemError,
  ConflictProblemError,
  ForbiddenProblemError,
  NotFoundProblemError,
  ValidationProblemError,
} from '../../common/errors/problemDetails.js';
import { evaluateJurisdictionAccess } from '../admin/admin.permissions.js';
import type { SafeAdminUser } from '../auth/auth.types.js';
import { AdminAuditService } from '../admin/admin.audit.service.js';

export interface CreateCountingSessionInput {
  id?: string;
  electionId: string;
  constituencyType: ConstituencyType;
  parliamentaryConstituencyId?: string | null;
  assemblyConstituencyId?: string | null;
  totalConfiguredRounds?: number;
  totalVoters?: number;
}

export interface RecordRoundInput {
  roundNumber: number;
  roundVotes: number;
  cumulativeVotes: number;
  leadingCandidateId?: string | null;
  leadMargin?: number;
}

export interface CandidateTallyInput {
  candidateId: string;
  votes: number;
}

export interface RecordTalliesInput {
  tallies: CandidateTallyInput[];
  notaVotes?: number;
  rejectedVotes?: number;
}

export interface ResolveTieInput {
  selectedWinnerId: string;
  decision: string;
  resolutionMethod: string;
  justificationNote: string;
}

export interface CorrectResultInput {
  reason: string;
  notaVotes?: number;
  rejectedVotes?: number;
  candidateVotes?: Record<string, number>;
}

export class CountingService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly auditService: AdminAuditService = new AdminAuditService(prisma)
  ) {}

  /**
   * Initializes a counting session for an assigned election constituency.
   */
  async createCountingSession(
    input: CreateCountingSessionInput,
    actor: SafeAdminUser,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // 1. Verify election exists
    const election = await this.db.election.findUnique({
      where: { id: input.electionId },
      include: {
        constituencyMappings: {
          where:
            input.constituencyType === 'PARLIAMENTARY'
              ? { parliamentaryConstituencyId: input.parliamentaryConstituencyId }
              : { assemblyConstituencyId: input.assemblyConstituencyId },
        },
      },
    });

    if (!election) {
      throw new NotFoundProblemError('Election', input.electionId);
    }

    // 2. Verify election-constituency assignment exists
    if (!election.constituencyMappings || election.constituencyMappings.length === 0) {
      throw new ValidationProblemError(
        `Constituency is not assigned to election '${input.electionId}'. Constituencies must be assigned before initiating counting.`
      );
    }

    // 3. Resolve target state for jurisdiction scoping
    let targetStateId = election.stateId;
    if (input.constituencyType === 'PARLIAMENTARY' && input.parliamentaryConstituencyId) {
      const pc = await this.db.parliamentaryConstituency.findUnique({
        where: { id: input.parliamentaryConstituencyId },
      });
      if (pc) targetStateId = pc.stateId;
    } else if (input.constituencyType === 'ASSEMBLY' && input.assemblyConstituencyId) {
      const ac = await this.db.assemblyConstituency.findUnique({
        where: { id: input.assemblyConstituencyId },
      });
      if (ac) targetStateId = ac.stateId;
    }

    const jurisdiction = evaluateJurisdictionAccess(actor, {
      stateId: targetStateId,
      electionId: input.electionId,
      constituencyType: input.constituencyType,
      constituencyId:
        input.parliamentaryConstituencyId ?? input.assemblyConstituencyId ?? null,
    });

    if (!jurisdiction.allowed) {
      throw new ForbiddenProblemError(
        jurisdiction.reason ?? 'Constituency is outside your administrative jurisdiction.'
      );
    }

    // 4. Generate deterministic or custom session ID
    const constId =
      input.constituencyType === 'PARLIAMENTARY'
        ? input.parliamentaryConstituencyId
        : input.assemblyConstituencyId;
    const generatedId =
      input.id ?? `RESULT-${input.electionId}-${constId?.replace(/^(WB|DL|MH)-(PC|AC)-/, '')}`;

    // 5. Check if session already exists
    const existing = await this.db.countingSession.findFirst({
      where: {
        electionId: input.electionId,
        constituencyType: input.constituencyType,
        ...(input.constituencyType === 'PARLIAMENTARY'
          ? { parliamentaryConstituencyId: input.parliamentaryConstituencyId }
          : { assemblyConstituencyId: input.assemblyConstituencyId }),
      },
    });

    if (existing) {
      throw new ConflictProblemError(
        `A counting session already exists for election '${input.electionId}' and this constituency (Session ID: ${existing.id}).`
      );
    }

    // 6. Create session in DRAFT status
    const session = await this.db.countingSession.create({
      data: {
        id: generatedId,
        electionId: input.electionId,
        constituencyType: input.constituencyType,
        parliamentaryConstituencyId: input.parliamentaryConstituencyId,
        assemblyConstituencyId: input.assemblyConstituencyId,
        totalConfiguredRounds: input.totalConfiguredRounds ?? 5,
        totalVoters: input.totalVoters ?? 0,
        status: ResultStatus.DRAFT,
        isPublished: false,
      },
      include: {
        parliamentaryConstituency: true,
        assemblyConstituency: true,
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'COUNTING_SESSION_CREATED',
      domain: 'RESULTS',
      targetEntityId: session.id,
      outcome: 'SUCCESS',
      requestId,
      ipAddress,
      userAgent,
      details: {
        electionId: input.electionId,
        constituencyType: input.constituencyType,
        constituencyId: constId,
      },
    });

    return session;
  }

  /**
   * Retrieves administrative counting sessions with flexible filtering.
   */
  async listCountingSessions(
    query: {
      page?: number;
      limit?: number;
      electionId?: string;
      constituencyType?: ConstituencyType;
      status?: ResultStatus;
      stateId?: string;
      isPublished?: boolean;
    },
    actor: SafeAdminUser
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.electionId) where.electionId = query.electionId;
    if (query.constituencyType) where.constituencyType = query.constituencyType;
    if (query.status) where.status = query.status;
    if (typeof query.isPublished === 'boolean') where.isPublished = query.isPublished;

    // Apply actor jurisdiction scoping
    if (actor.role === 'STATE_ADMIN' && actor.assignedStateId) {
      where.OR = [
        { parliamentaryConstituency: { stateId: actor.assignedStateId } },
        { assemblyConstituency: { stateId: actor.assignedStateId } },
      ];
    } else if (query.stateId) {
      where.OR = [
        { parliamentaryConstituency: { stateId: query.stateId } },
        { assemblyConstituency: { stateId: query.stateId } },
      ];
    }

    if (actor.role === 'ELECTION_OFFICER' && actor.assignedElectionIds.length > 0) {
      where.electionId = { in: actor.assignedElectionIds };
    }

    const [items, total] = await Promise.all([
      this.db.countingSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        include: {
          election: { select: { id: true, name: true, type: true, status: true } },
          parliamentaryConstituency: { select: { id: true, name: true, stateId: true } },
          assemblyConstituency: { select: { id: true, name: true, stateId: true } },
          winnerCandidate: {
            select: { id: true, fullName: true, partyId: true },
          },
          runnerUpCandidate: {
            select: { id: true, fullName: true, partyId: true },
          },
          tallies: {
            include: {
              candidate: { select: { id: true, fullName: true } },
              party: { select: { id: true, name: true, abbreviation: true } },
            },
            orderBy: { votes: 'desc' },
          },
          rounds: {
            orderBy: { roundNumber: 'asc' },
          },
          tieResolution: true,
        },
      }),
      this.db.countingSession.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves full counting session details by sessionId.
   */
  async getCountingSessionById(sessionId: string, actor?: SafeAdminUser) {
    const session = await this.db.countingSession.findUnique({
      where: { id: sessionId },
      include: {
        election: { select: { id: true, name: true, type: true, status: true } },
        parliamentaryConstituency: true,
        assemblyConstituency: true,
        winnerCandidate: true,
        runnerUpCandidate: true,
        tallies: {
          include: {
            candidate: true,
            party: true,
            nomination: true,
          },
          orderBy: { votes: 'desc' },
        },
        rounds: {
          include: {
            leadingCandidate: true,
            processedByAdmin: {
              select: { id: true, fullName: true, officerCode: true },
            },
          },
          orderBy: { roundNumber: 'asc' },
        },
        tieResolution: {
          include: {
            selectedWinner: true,
            approvedByAdmin: {
              select: { id: true, fullName: true, officerCode: true },
            },
          },
        },
        corrections: {
          include: {
            correctedByAdmin: {
              select: { id: true, fullName: true, officerCode: true },
            },
          },
          orderBy: { correctedAt: 'desc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundProblemError('CountingSession', sessionId);
    }

    if (actor) {
      const stateId =
        session.parliamentaryConstituency?.stateId ??
        session.assemblyConstituency?.stateId ??
        null;
      const jurisdiction = evaluateJurisdictionAccess(actor, {
        stateId,
        electionId: session.electionId,
        constituencyType: session.constituencyType,
        constituencyId:
          session.parliamentaryConstituencyId ?? session.assemblyConstituencyId,
      });

      if (!jurisdiction.allowed) {
        throw new ForbiddenProblemError(
          jurisdiction.reason ?? 'Constituency is outside your administrative jurisdiction.'
        );
      }
    }

    return session;
  }

  /**
   * Records a sequential counting round.
   */
  async recordCountingRound(
    sessionId: string,
    input: RecordRoundInput,
    actor: SafeAdminUser,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const session = await this.getCountingSessionById(sessionId, actor);

    const lockedStatuses: readonly string[] = [
      ResultStatus.COUNTING_COMPLETED,
      ResultStatus.RESULT_READY_FOR_REVIEW,
      ResultStatus.PUBLISHED,
      ResultStatus.TIED,
    ];

    if (lockedStatuses.includes(session.status)) {
      throw new AppProblemError({
        status: 409,
        code: 'COUNTING_SESSION_LOCKED',
        title: 'Session Locked',
        detail: `Cannot record counting round: session '${sessionId}' is in status '${session.status}'.`,
      });
    }

    // Verify sequentiality
    const expectedRound = session.currentRound + 1;
    if (input.roundNumber !== expectedRound) {
      throw new ValidationProblemError(
        `Round number ${input.roundNumber} is not sequential; expected round ${expectedRound}.`
      );
    }

    if (input.roundNumber > session.totalConfiguredRounds) {
      throw new ValidationProblemError(
        `Round number ${input.roundNumber} exceeds total configured rounds (${session.totalConfiguredRounds}).`
      );
    }

    // Verify round leader nomination if provided
    if (input.leadingCandidateId) {
      const nom = await this.db.candidateNomination.findFirst({
        where: {
          candidateId: input.leadingCandidateId,
          electionId: session.electionId,
          status: CandidateNominationStatus.APPROVED,
          ...(session.constituencyType === 'PARLIAMENTARY'
            ? { parliamentaryConstituencyId: session.parliamentaryConstituencyId }
            : { assemblyConstituencyId: session.assemblyConstituencyId }),
        },
      });

      if (!nom) {
        throw new ValidationProblemError(
          `Leading candidate '${input.leadingCandidateId}' lacks an APPROVED nomination in this election and constituency.`
        );
      }
    }

    // Cumulative votes verification
    if (session.currentRound > 0) {
      const prevRound = session.rounds.find((r) => r.roundNumber === session.currentRound);
      if (prevRound && input.cumulativeVotes < prevRound.cumulativeVotes) {
        throw new ValidationProblemError(
          `Cumulative votes (${input.cumulativeVotes}) cannot decrease below previous round total (${prevRound.cumulativeVotes}).`
        );
      }
    }

    const round = await this.db.$transaction(async (tx) => {
      const createdRound = await tx.countingRound.create({
        data: {
          sessionId,
          roundNumber: input.roundNumber,
          roundVotes: input.roundVotes,
          cumulativeVotes: input.cumulativeVotes,
          leadingCandidateId: input.leadingCandidateId,
          leadMargin: input.leadMargin ?? 0,
          processedByAdminId: actor.id,
        },
      });

      const nextStatus =
        session.status === ResultStatus.DRAFT
          ? ResultStatus.COUNTING_IN_PROGRESS
          : session.status;

      await tx.countingSession.update({
        where: { id: sessionId },
        data: {
          currentRound: input.roundNumber,
          status: nextStatus,
        },
      });

      return createdRound;
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'COUNTING_ROUND_RECORDED',
      domain: 'RESULTS',
      targetEntityId: sessionId,
      outcome: 'SUCCESS',
      requestId,
      ipAddress,
      userAgent,
      details: {
        roundNumber: input.roundNumber,
        roundVotes: input.roundVotes,
        cumulativeVotes: input.cumulativeVotes,
      },
    });

    return round;
  }

  /**
   * Records or updates candidate tallies independently.
   *
   * STRICT ARCHITECTURAL INVARIANT:
   * Demo counting tallies MUST NEVER be derived from, reconciled against,
   * or influenced by DemoParticipation records or individual voter ballots.
   */
  async recordCandidateTallies(
    sessionId: string,
    input: RecordTalliesInput,
    actor: SafeAdminUser,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const session = await this.getCountingSessionById(sessionId, actor);

    const lockedStatuses: readonly string[] = [
      ResultStatus.COUNTING_COMPLETED,
      ResultStatus.RESULT_READY_FOR_REVIEW,
      ResultStatus.PUBLISHED,
      ResultStatus.TIED,
    ];

    if (lockedStatuses.includes(session.status)) {
      throw new AppProblemError({
        status: 409,
        code: 'COUNTING_SESSION_LOCKED',
        title: 'Session Locked',
        detail: `Cannot record candidate tallies: session '${sessionId}' is in '${session.status}' status. Modifications require an explicit review or recount state.`,
      });
    }

    // Verify all candidates have approved nominations in this session's constituency
    const candidateIds = input.tallies.map((t) => t.candidateId);
    const approvedNominations = await this.db.candidateNomination.findMany({
      where: {
        candidateId: { in: candidateIds },
        electionId: session.electionId,
        status: CandidateNominationStatus.APPROVED,
        ...(session.constituencyType === 'PARLIAMENTARY'
          ? { parliamentaryConstituencyId: session.parliamentaryConstituencyId }
          : { assemblyConstituencyId: session.assemblyConstituencyId }),
      },
    });

    const approvedCandidateMap = new Map<string, (typeof approvedNominations)[0]>();
    for (const nom of approvedNominations) {
      approvedCandidateMap.set(nom.candidateId, nom);
    }

    for (const t of input.tallies) {
      if (!approvedCandidateMap.has(t.candidateId)) {
        throw new ValidationProblemError(
          `Candidate '${t.candidateId}' does not have an APPROVED nomination in election '${session.electionId}' for this constituency.`
        );
      }
    }

    const notaVotes = input.notaVotes ?? session.notaVotes;
    const rejectedVotes = input.rejectedVotes ?? session.rejectedVotes;
    const totalCandidateVotes = input.tallies.reduce((sum, t) => sum + t.votes, 0);
    const totalCountedVotes = totalCandidateVotes + notaVotes + rejectedVotes;

    // Detect leader, runner-up, victory margin, and genuine ties
    const sortedTallies = [...input.tallies].sort((a, b) => b.votes - a.votes);
    let winnerId: string | null = null;
    let runnerUpId: string | null = null;
    let victoryMargin = 0;
    let newStatus =
      session.status === ResultStatus.DRAFT
        ? ResultStatus.COUNTING_IN_PROGRESS
        : session.status;

    if (sortedTallies.length > 0) {
      const topTally = sortedTallies[0]!;
      const secondTally = sortedTallies[1];

      // Tie detection: If at least 2 candidates share highest votes (> 0)
      if (secondTally && topTally.votes > 0 && topTally.votes === secondTally.votes) {
        newStatus = ResultStatus.TIED;
        winnerId = null;
        runnerUpId = null;
        victoryMargin = 0;
      } else {
        winnerId = topTally.votes > 0 ? topTally.candidateId : null;
        runnerUpId = secondTally ? secondTally.candidateId : null;
        victoryMargin = secondTally ? topTally.votes - secondTally.votes : topTally.votes;

        // Auto advance to COUNTING_COMPLETED if all configured rounds are done
        if (session.currentRound >= session.totalConfiguredRounds && winnerId) {
          newStatus = ResultStatus.COUNTING_COMPLETED;
        }
      }
    }

    const updatedSession = await this.db.$transaction(async (tx) => {
      // 1. Upsert candidate tallies
      for (const t of input.tallies) {
        const nom = approvedCandidateMap.get(t.candidateId)!;
        const voteShare =
          totalCountedVotes > 0 ? (t.votes / totalCountedVotes) * 100 : 0;

        await tx.candidateTally.upsert({
          where: {
            sessionId_candidateId: {
              sessionId,
              candidateId: t.candidateId,
            },
          },
          update: {
            votes: t.votes,
            voteSharePercentage: voteShare.toFixed(2),
            nominationId: nom.id,
            partyId: nom.partyId,
          },
          create: {
            sessionId,
            candidateId: t.candidateId,
            nominationId: nom.id,
            partyId: nom.partyId,
            votes: t.votes,
            voteSharePercentage: voteShare.toFixed(2),
          },
        });
      }

      // 2. Update counting session totals and status
      const savedSession = await tx.countingSession.update({
        where: { id: sessionId },
        data: {
          notaVotes,
          rejectedVotes,
          totalCountedVotes,
          winnerCandidateId: winnerId,
          runnerUpCandidateId: runnerUpId,
          victoryMargin,
          status: newStatus,
        },
        include: {
          tallies: {
            include: {
              candidate: true,
              party: true,
            },
            orderBy: { votes: 'desc' },
          },
          winnerCandidate: true,
          runnerUpCandidate: true,
        },
      });

      return savedSession;
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'COUNTING_TALLIES_RECORDED',
      domain: 'RESULTS',
      targetEntityId: sessionId,
      outcome: 'SUCCESS',
      requestId,
      ipAddress,
      userAgent,
      details: {
        totalCountedVotes,
        tallyCount: input.tallies.length,
        status: newStatus,
        isTied: newStatus === ResultStatus.TIED,
      },
    });

    return updatedSession;
  }

  /**
   * Resolves a tie for a session in TIED status via authorized simulated draw of lots.
   */
  async resolveTie(
    sessionId: string,
    input: ResolveTieInput,
    actor: SafeAdminUser,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (actor.role === 'READ_ONLY_AUDITOR') {
      throw new ForbiddenProblemError(
        'READ_ONLY_AUDITOR is not authorized to resolve tie breaks.'
      );
    }

    const session = await this.getCountingSessionById(sessionId, actor);

    if (session.status !== ResultStatus.TIED) {
      throw new AppProblemError({
        status: 409,
        code: 'SESSION_NOT_TIED',
        title: 'Session Not Tied',
        detail: `Cannot resolve tie: session '${sessionId}' is in status '${session.status}', not 'TIED'.`,
      });
    }

    if (session.tallies.length === 0) {
      throw new ValidationProblemError(
        `Cannot resolve tie: no candidate tallies exist for session '${sessionId}'.`
      );
    }

    // Verify genuine tie: at least 2 candidates tied at maximum votes (> 0)
    const maxVotes = Math.max(...session.tallies.map((t: { votes: number }) => t.votes));
    if (maxVotes <= 0) {
      throw new ValidationProblemError(
        `Cannot resolve tie: maximum candidate votes must be strictly greater than zero.`
      );
    }

    const topTiedCandidates = session.tallies.filter(
      (t: { votes: number }) => t.votes === maxVotes
    );
    if (topTiedCandidates.length < 2) {
      throw new ValidationProblemError(
        `Cannot resolve tie: genuine tie requires at least 2 candidates tied at maximum votes (${maxVotes}). Found: ${topTiedCandidates.length}.`
      );
    }

    const isWinnerTied = topTiedCandidates.some(
      (t: { candidateId: string }) => t.candidateId === input.selectedWinnerId
    );
    if (!isWinnerTied) {
      throw new ValidationProblemError(
        `Selected winner '${input.selectedWinnerId}' is not among the candidates tied for highest votes (${maxVotes}).`
      );
    }

    // Execute tie resolution in transaction
    const result = await this.db.$transaction(async (tx) => {
      const tieRecord = await tx.tieResolution.create({
        data: {
          sessionId,
          selectedWinnerId: input.selectedWinnerId,
          decision: input.decision,
          resolutionMethod: input.resolutionMethod,
          justificationNote: input.justificationNote,
          approvedByAdminId: actor.id,
        },
      });

      // Find runner-up (the other tied candidate, or next highest)
      const otherTied = topTiedCandidates.find(
        (t: { candidateId: string }) => t.candidateId !== input.selectedWinnerId
      );

      const updated = await tx.countingSession.update({
        where: { id: sessionId },
        data: {
          winnerCandidateId: input.selectedWinnerId,
          runnerUpCandidateId: otherTied?.candidateId ?? null,
          victoryMargin: 1, // Simulated tie break margin
          status: ResultStatus.RESULT_READY_FOR_REVIEW,
        },
        include: {
          tieResolution: true,
          winnerCandidate: true,
          runnerUpCandidate: true,
        },
      });

      return { session: updated, tieResolution: tieRecord };
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'TIE_BREAK_RESOLVED',
      domain: 'RESULTS',
      targetEntityId: sessionId,
      outcome: 'SUCCESS',
      requestId,
      ipAddress,
      userAgent,
      details: {
        winnerCandidateId: input.selectedWinnerId,
        resolutionMethod: input.resolutionMethod,
        decision: input.decision,
      },
    });

    return result;
  }

  /**
   * Advances counting session to RESULT_READY_FOR_REVIEW stage.
   */
  async submitForReview(
    sessionId: string,
    actor: SafeAdminUser,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const session = await this.getCountingSessionById(sessionId, actor);

    if (
      session.status !== ResultStatus.COUNTING_COMPLETED &&
      session.status !== ResultStatus.UNDER_REVIEW &&
      session.status !== ResultStatus.CORRECTED
    ) {
      throw new AppProblemError({
        status: 409,
        code: 'INVALID_STATUS_FOR_REVIEW',
        title: 'Invalid Status for Review',
        detail: `Cannot submit for review from status '${session.status}'. Must be in COUNTING_COMPLETED, UNDER_REVIEW, or CORRECTED.`,
      });
    }

    if (!session.winnerCandidateId) {
      throw new ValidationProblemError(
        `Cannot submit for review: no winner candidate has been declared for session '${sessionId}'.`
      );
    }

    const updated = await this.db.countingSession.update({
      where: { id: sessionId },
      data: {
        status: ResultStatus.RESULT_READY_FOR_REVIEW,
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'RESULT_SUBMITTED_FOR_REVIEW',
      domain: 'RESULTS',
      targetEntityId: sessionId,
      outcome: 'SUCCESS',
      requestId,
      ipAddress,
      userAgent,
    });

    return updated;
  }

  /**
   * Publishes the constituency result.
   */
  async publishResult(
    sessionId: string,
    actor: SafeAdminUser,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (actor.role === 'READ_ONLY_AUDITOR') {
      throw new ForbiddenProblemError(
        'READ_ONLY_AUDITOR is not authorized to publish results.'
      );
    }

    const session = await this.getCountingSessionById(sessionId, actor);

    if (session.status !== ResultStatus.RESULT_READY_FOR_REVIEW) {
      throw new AppProblemError({
        status: 409,
        code: 'RESULT_NOT_READY_FOR_PUBLICATION',
        title: 'Result Not Ready for Publication',
        detail: `Cannot publish result: session '${sessionId}' is in status '${session.status}'. Must be reviewed in RESULT_READY_FOR_REVIEW stage first.`,
      });
    }

    if (session.currentRound < session.totalConfiguredRounds) {
      throw new ValidationProblemError(
        `Cannot publish result: counting is incomplete (${session.currentRound} of ${session.totalConfiguredRounds} rounds completed).`
      );
    }

    if (!session.winnerCandidateId) {
      throw new ValidationProblemError(
        `Cannot publish result without a declared winner.`
      );
    }

    const publishedAt = new Date();

    const publishedSession = await this.db.countingSession.update({
      where: { id: sessionId },
      data: {
        status: ResultStatus.PUBLISHED,
        isPublished: true,
        publishedAt,
        publishedByAdminId: actor.id,
      },
      include: {
        winnerCandidate: true,
        runnerUpCandidate: true,
        tallies: {
          include: { candidate: true, party: true },
          orderBy: { votes: 'desc' },
        },
      },
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'RESULT_PUBLISHED',
      domain: 'RESULTS',
      targetEntityId: sessionId,
      outcome: 'SUCCESS',
      requestId,
      ipAddress,
      userAgent,
      details: {
        winnerCandidateId: session.winnerCandidateId,
        victoryMargin: session.victoryMargin,
        totalCountedVotes: session.totalCountedVotes,
      },
    });

    return publishedSession;
  }

  /**
   * Corrects a published or reviewed result with an immutable audit history record.
   */
  async correctResult(
    sessionId: string,
    input: CorrectResultInput,
    actor: SafeAdminUser,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (actor.role === 'READ_ONLY_AUDITOR') {
      throw new ForbiddenProblemError(
        'READ_ONLY_AUDITOR is not authorized to correct results.'
      );
    }

    const session = await this.getCountingSessionById(sessionId, actor);

    if (session.status !== ResultStatus.PUBLISHED && session.status !== ResultStatus.UNDER_REVIEW) {
      throw new AppProblemError({
        status: 409,
        code: 'INVALID_STATUS_FOR_CORRECTION',
        title: 'Invalid Status for Correction',
        detail: `Cannot correct result: session '${sessionId}' is in status '${session.status}'. Must be PUBLISHED or UNDER_REVIEW.`,
      });
    }

    const previousState = {
      status: session.status,
      totalCountedVotes: session.totalCountedVotes,
      notaVotes: session.notaVotes,
      rejectedVotes: session.rejectedVotes,
      winnerCandidateId: session.winnerCandidateId,
      runnerUpCandidateId: session.runnerUpCandidateId,
      victoryMargin: session.victoryMargin,
      tallies: session.tallies.map((t: { candidateId: string; votes: number }) => ({
        candidateId: t.candidateId,
        votes: t.votes,
      })),
    };

    const result = await this.db.$transaction(async (tx) => {
      // 1. Transition to UNDER_REVIEW
      await tx.countingSession.update({
        where: { id: sessionId },
        data: { status: ResultStatus.UNDER_REVIEW, isPublished: false },
      });

      // 2. Apply candidate tally updates if specified
      const updatedNota = input.notaVotes ?? session.notaVotes;
      const updatedRejected = input.rejectedVotes ?? session.rejectedVotes;

      if (input.candidateVotes) {
        for (const [candidateId, votes] of Object.entries(input.candidateVotes)) {
          await tx.candidateTally.update({
            where: {
              sessionId_candidateId: {
                sessionId,
                candidateId,
              },
            },
            data: { votes },
          });
        }
      }

      // Re-sum tallies
      const tallies = await tx.candidateTally.findMany({
        where: { sessionId },
        orderBy: { votes: 'desc' },
      });

      const totalCandVotes = tallies.reduce((sum, t) => sum + t.votes, 0);
      const newTotal = totalCandVotes + updatedNota + updatedRejected;

      // Update vote share percentage
      for (const t of tallies) {
        const share = newTotal > 0 ? (t.votes / newTotal) * 100 : 0;
        await tx.candidateTally.update({
          where: { id: t.id },
          data: { voteSharePercentage: share.toFixed(2) },
        });
      }

      const top = tallies[0];
      const second = tallies[1];
      const newWinner = top && top.votes > 0 ? top.candidateId : null;
      const newRunnerUp = second ? second.candidateId : null;
      const newMargin = second ? (top ? top.votes - second.votes : 0) : (top ? top.votes : 0);

      const correctedState = {
        totalCountedVotes: newTotal,
        notaVotes: updatedNota,
        rejectedVotes: updatedRejected,
        winnerCandidateId: newWinner,
        runnerUpCandidateId: newRunnerUp,
        victoryMargin: newMargin,
        tallies: tallies.map((t) => ({
          candidateId: t.candidateId,
          votes: t.votes,
        })),
      };

      // 3. Create immutable correction history record
      await tx.resultCorrectionHistory.create({
        data: {
          sessionId,
          previousState,
          correctedState,
          reason: input.reason,
          correctedByAdminId: actor.id,
        },
      });

      // 4. Update session to CORRECTED
      const updated = await tx.countingSession.update({
        where: { id: sessionId },
        data: {
          totalCountedVotes: newTotal,
          notaVotes: updatedNota,
          rejectedVotes: updatedRejected,
          winnerCandidateId: newWinner,
          runnerUpCandidateId: newRunnerUp,
          victoryMargin: newMargin,
          status: ResultStatus.CORRECTED,
        },
      });

      return updated;
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'RESULT_CORRECTED',
      domain: 'RESULTS',
      targetEntityId: sessionId,
      outcome: 'SUCCESS',
      requestId,
      ipAddress,
      userAgent,
      details: { reason: input.reason },
    });

    return result;
  }

  /**
   * Resets a counting session back to DRAFT for educational simulation re-runs.
   */
  async resetCountingSession(
    sessionId: string,
    actor: SafeAdminUser,
    requestId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'NATIONAL_ADMIN') {
      throw new ForbiddenProblemError(
        'Only SUPER_ADMIN or NATIONAL_ADMIN can reset counting sessions.'
      );
    }

    await this.getCountingSessionById(sessionId, actor);

    // Delete in reverse order per database triggers
    await this.db.$transaction(async (tx) => {
      // Unpublish if published
      await tx.countingSession.update({
        where: { id: sessionId },
        data: { status: ResultStatus.DRAFT, isPublished: false },
      });

      // Delete tie resolution if exists
      await tx.tieResolution.deleteMany({ where: { sessionId } });

      // Delete rounds in reverse order
      const rounds = await tx.countingRound.findMany({
        where: { sessionId },
        orderBy: { roundNumber: 'desc' },
      });

      for (const r of rounds) {
        await tx.countingRound.delete({ where: { id: r.id } });
      }

      // Reset tallies
      await tx.candidateTally.updateMany({
        where: { sessionId },
        data: { votes: 0, voteSharePercentage: 0 },
      });

      // Reset session
      await tx.countingSession.update({
        where: { id: sessionId },
        data: {
          currentRound: 0,
          totalCountedVotes: 0,
          notaVotes: 0,
          rejectedVotes: 0,
          winnerCandidateId: null,
          runnerUpCandidateId: null,
          victoryMargin: 0,
          isPublished: false,
          publishedAt: null,
          publishedByAdminId: null,
        },
      });
    });

    await this.auditService.recordSecurityEvent({
      adminUserId: actor.id,
      actorUserId: actor.userId,
      actorIdentifier: actor.officerCode,
      actorRole: actor.role,
      actionType: 'COUNTING_SESSION_RESET',
      domain: 'RESULTS',
      targetEntityId: sessionId,
      outcome: 'SUCCESS',
      requestId,
      ipAddress,
      userAgent,
    });

    return { ok: true, message: `Counting session '${sessionId}' has been reset to DRAFT.` };
  }

  // ==========================================================================
  // PUBLIC READ-ONLY RESULTS API (ONLY PUBLISHED RESULTS EXPOSED)
  // ==========================================================================

  /**
   * Retrieves public published results with clear simulation disclaimers.
   */
  async getPublicResults(query: {
    page?: number;
    limit?: number;
    electionId?: string;
    constituencyType?: ConstituencyType;
    stateId?: string;
    year?: number;
    search?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      isPublished: true,
      status: ResultStatus.PUBLISHED,
    };

    if (query.electionId) where.electionId = query.electionId;
    if (query.constituencyType) where.constituencyType = query.constituencyType;

    if (query.stateId) {
      where.OR = [
        { parliamentaryConstituency: { stateId: query.stateId } },
        { assemblyConstituency: { stateId: query.stateId } },
      ];
    }

    if (query.search) {
      const term = query.search;
      where.AND = [
        {
          OR: [
            { parliamentaryConstituency: { name: { contains: term, mode: 'insensitive' } } },
            { assemblyConstituency: { name: { contains: term, mode: 'insensitive' } } },
            { winnerCandidate: { fullName: { contains: term, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.db.countingSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        include: {
          election: {
            select: {
              id: true,
              name: true,
              type: true,
              year: true,
            },
          },
          parliamentaryConstituency: {
            select: { id: true, name: true, stateId: true, constituencyNumber: true },
          },
          assemblyConstituency: {
            select: { id: true, name: true, stateId: true, constituencyNumber: true },
          },
          winnerCandidate: {
            select: {
              id: true,
              fullName: true,
              displayName: true,
              gender: true,
              party: { select: { id: true, name: true, abbreviation: true } },
            },
          },
          runnerUpCandidate: {
            select: {
              id: true,
              fullName: true,
              displayName: true,
              party: { select: { id: true, name: true, abbreviation: true } },
            },
          },
          tallies: {
            select: {
              id: true,
              votes: true,
              voteSharePercentage: true,
              candidate: {
                select: { id: true, fullName: true, displayName: true },
              },
              party: {
                select: { id: true, name: true, abbreviation: true, partyType: true },
              },
            },
            orderBy: { votes: 'desc' },
          },
        },
      }),
      this.db.countingSession.count({ where }),
    ]);

    return {
      simulationNotice:
        'DEMO ELECTION SIMULATION: These result records are synthetic demonstration data generated for educational verification and do not represent official Election Commission of India election declarations.',
      isSimulated: true,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves a single published result by sessionId for public view.
   */
  async getPublicResultById(sessionId: string) {
    const session = await this.db.countingSession.findFirst({
      where: {
        id: sessionId,
        isPublished: true,
        status: ResultStatus.PUBLISHED,
      },
      include: {
        election: {
          select: { id: true, name: true, type: true, year: true },
        },
        parliamentaryConstituency: true,
        assemblyConstituency: true,
        winnerCandidate: {
          include: { party: true },
        },
        runnerUpCandidate: {
          include: { party: true },
        },
        tallies: {
          include: {
            candidate: true,
            party: true,
          },
          orderBy: { votes: 'desc' },
        },
        rounds: {
          select: {
            roundNumber: true,
            roundVotes: true,
            cumulativeVotes: true,
            leadMargin: true,
            processedAt: true,
            leadingCandidate: {
              select: { id: true, fullName: true, displayName: true },
            },
          },
          orderBy: { roundNumber: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundProblemError(
        'PublishedResult',
        `Published result for '${sessionId}' was not found or is not yet published.`
      );
    }

    return {
      simulationNotice:
        'DEMO ELECTION SIMULATION: This constituency result is a synthetic simulation for educational purposes.',
      isSimulated: true,
      result: session,
    };
  }

  /**
   * Generates public election-level results summary (party seat tally, total votes).
   *
   * Note: Turnout is calculated separately from demo participation records and clearly
   * identified as simulated voter participation, preserving total privacy isolation.
   */
  async getPublicElectionSummary(electionId: string) {
    const election = await this.db.election.findUnique({
      where: { id: electionId },
      include: {
        _count: {
          select: { constituencyMappings: true },
        },
      },
    });

    if (!election) {
      throw new NotFoundProblemError('Election', electionId);
    }

    const publishedSessions = await this.db.countingSession.findMany({
      where: {
        electionId,
        isPublished: true,
        status: ResultStatus.PUBLISHED,
      },
      include: {
        winnerCandidate: {
          include: { party: true },
        },
        tallies: {
          include: { party: true },
        },
      },
    });

    // Compute party seat tallies
    const partySeatMap = new Map<
      string,
      {
        partyId: string;
        partyName: string;
        abbreviation: string;
        seatsWon: number;
        totalVotes: number;
      }
    >();

    let totalCountedVotes = 0;
    let totalNotaVotes = 0;

    for (const s of publishedSessions) {
      totalCountedVotes += s.totalCountedVotes;
      totalNotaVotes += s.notaVotes;

      if (s.winnerCandidate) {
        const party = s.winnerCandidate.party;
        const pId = party?.id ?? 'INDEPENDENT';
        const pName = party?.name ?? 'Independent Candidates';
        const pAbbr = party?.abbreviation ?? 'IND';

        const existing = partySeatMap.get(pId) ?? {
          partyId: pId,
          partyName: pName,
          abbreviation: pAbbr,
          seatsWon: 0,
          totalVotes: 0,
        };

        existing.seatsWon += 1;
        partySeatMap.set(pId, existing);
      }

      for (const t of s.tallies) {
        const pId = t.partyId ?? 'INDEPENDENT';
        const pName = t.party?.name ?? 'Independent Candidates';
        const pAbbr = t.party?.abbreviation ?? 'IND';

        const existing = partySeatMap.get(pId) ?? {
          partyId: pId,
          partyName: pName,
          abbreviation: pAbbr,
          seatsWon: 0,
          totalVotes: 0,
        };

        existing.totalVotes += t.votes;
        partySeatMap.set(pId, existing);
      }
    }

    const partyStandings = Array.from(partySeatMap.values()).sort(
      (a, b) => b.seatsWon - a.seatsWon || b.totalVotes - a.totalVotes
    );

    // Compute simulated voter participation counts (isolated dataset)
    const simulatedParticipationCount = await this.db.demoParticipation.count({
      where: { electionId },
    });

    return {
      simulationNotice:
        'DEMO ELECTION SIMULATION: National/Assembly summary derived from independent synthetic counting rounds.',
      isSimulated: true,
      election: {
        id: election.id,
        name: election.name,
        type: election.type,
        year: election.year,
        totalConstituencies: election._count.constituencyMappings,
      },
      declaredConstituencies: publishedSessions.length,
      totalCountedVotes,
      totalNotaVotes,
      partyStandings,
      participationTurnoutMetric: {
        note: 'Separate demo voter participation count (strictly zero connection to candidate choices)',
        recordedVoterParticipations: simulatedParticipationCount,
      },
    };
  }
}
