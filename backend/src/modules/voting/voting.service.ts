import { randomBytes } from 'node:crypto';
import {
  ConfigurationReviewStatus,
  ConstituencyType,
  ElectionStatus,
  ElectionType,
  ParticipationStatus,
  Prisma,
  ScheduleMilestoneType,
  type PrismaClient,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/database.js';
import {
  ConflictProblemError,
  ForbiddenProblemError,
  NotFoundProblemError,
  ValidationProblemError,
} from '../../common/errors/problemDetails.js';
import type { SafeAdminUser } from '../auth/auth.types.js';

export type IneligibilityCode =
  | 'UNSUPPORTED_ELECTION_TYPE'
  | 'ELECTION_CANCELLED'
  | 'ELECTION_ARCHIVED'
  | 'ELECTION_NOT_STARTED'
  | 'ELECTION_CLOSED'
  | 'CONFIGURATION_INCOMPLETE'
  | 'MISSING_CONSTITUENCY_MAPPING'
  | 'OUT_OF_JURISDICTION'
  | 'CONSTITUENCY_NOT_ASSIGNED'
  | 'NO_APPROVED_CANDIDATES'
  | 'ALREADY_PARTICIPATED';

const NOT_STARTED_STATUSES: ReadonlySet<ElectionStatus> = new Set([
  ElectionStatus.DRAFT,
  ElectionStatus.UPCOMING,
  ElectionStatus.NOMINATION_OPEN,
  ElectionStatus.NOMINATION_CLOSED,
  ElectionStatus.READY,
]);

const CLOSED_STATUSES: ReadonlySet<ElectionStatus> = new Set([
  ElectionStatus.POLLING_COMPLETED,
  ElectionStatus.COUNTING,
  ElectionStatus.RESULTS_DECLARED,
]);

function resolvePollingWindow(election: {
  pollingStartDate: Date | null;
  pollingEndDate: Date | null;
  scheduleMilestones?: Array<{
    milestoneType: ScheduleMilestoneType;
    startAt: Date | null;
    endAt: Date | null;
  }>;
}): { startAt: Date | null; endAt: Date | null } {
  const milestones = election.scheduleMilestones ?? [];
  const startMilestone = milestones.find(
    (m) => m.milestoneType === ScheduleMilestoneType.POLLING_START
  );
  const endMilestone = milestones.find(
    (m) => m.milestoneType === ScheduleMilestoneType.POLLING_END
  );

  const startAt = startMilestone?.startAt ?? election.pollingStartDate ?? null;
  const endAt =
    endMilestone?.endAt ?? endMilestone?.startAt ?? election.pollingEndDate ?? null;

  return { startAt, endAt };
}

function getEffectiveClock(
  election: { simulationClockDate: Date | null },
  nowFn: () => Date
): Date {
  return election.simulationClockDate ?? nowFn();
}

export function buildDemoReference(electionId: string): {
  demoReference: string;
  referenceId: string;
} {
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  const shortEl = electionId.replace(/[^A-Z0-9]/gi, '').slice(0, 10).toUpperCase();
  return {
    demoReference: `DEMO-${shortEl}-${suffix}`.slice(0, 30),
    referenceId: `DEMO-REF-${shortEl}-${Date.now().toString(36).toUpperCase()}-${suffix}`.slice(
      0,
      60
    ),
  };
}

function throwForIneligibility(
  code: IneligibilityCode,
  reason: string
): never {
  switch (code) {
    case 'MISSING_CONSTITUENCY_MAPPING':
    case 'UNSUPPORTED_ELECTION_TYPE':
      throw new ValidationProblemError(reason);
    case 'OUT_OF_JURISDICTION':
      throw new ForbiddenProblemError(reason);
    default:
      throw new ConflictProblemError(reason);
  }
}

export class VotingService {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly nowFn: () => Date = () => new Date()
  ) {}

  private async getVoterProfileByUserId(userId: string) {
    const profile = await this.prisma.voterProfile.findUnique({
      where: { userId },
      include: {
        state: { select: { id: true, name: true, type: true } },
        district: { select: { id: true, name: true } },
        parliamentaryConstituency: {
          select: { id: true, name: true, constituencyNumber: true, stateId: true },
        },
        assemblyConstituency: {
          select: {
            id: true,
            name: true,
            constituencyNumber: true,
            stateId: true,
            parentParliamentaryConstituencyId: true,
          },
        },
      },
    });
    if (!profile) {
      throw new NotFoundProblemError('VoterProfile', userId);
    }
    return profile;
  }

  private evaluateEligibility(
    profile: Awaited<ReturnType<VotingService['getVoterProfileByUserId']>>,
    election: {
      id: string;
      name: string;
      type: ElectionType;
      stateId: string | null;
      status: ElectionStatus;
      configReviewStatus: ConfigurationReviewStatus;
      scheduleTimezone: string;
      pollingStartDate: Date | null;
      pollingEndDate: Date | null;
      simulationClockDate: Date | null;
      scheduleMilestones: Array<{
        milestoneType: ScheduleMilestoneType;
        startAt: Date | null;
        endAt: Date | null;
      }>;
      constituencyMappings: Array<{
        constituencyType: ConstituencyType;
        parliamentaryConstituencyId: string | null;
        assemblyConstituencyId: string | null;
      }>;
    },
    approvedNominationsCount: number,
    existingParticipation: {
      id: string;
      status: ParticipationStatus;
      demoReference: string;
      referenceId: string;
      participatedAt: Date;
      recordedAt: Date;
    } | null
  ) {
    const pollingWindow = resolvePollingWindow(election);
    const effectiveNow = getEffectiveClock(election, this.nowFn);

    let targetConstituencyType: ConstituencyType | null = null;
    let targetConstituencyId: string | null = null;
    let targetConstituencyName: string | null = null;
    let targetConstituencyNumber: number | null = null;

    if (election.type === ElectionType.LOK_SABHA) {
      targetConstituencyType = ConstituencyType.PARLIAMENTARY;
      targetConstituencyId = profile.parliamentaryConstituencyId ?? null;
      targetConstituencyName = profile.parliamentaryConstituency?.name ?? null;
      targetConstituencyNumber =
        profile.parliamentaryConstituency?.constituencyNumber ?? null;
    } else if (election.type === ElectionType.STATE_ASSEMBLY) {
      targetConstituencyType = ConstituencyType.ASSEMBLY;
      targetConstituencyId = profile.assemblyConstituencyId ?? null;
      targetConstituencyName = profile.assemblyConstituency?.name ?? null;
      targetConstituencyNumber =
        profile.assemblyConstituency?.constituencyNumber ?? null;
    } else {
      return {
        eligible: false,
        code: 'UNSUPPORTED_ELECTION_TYPE' as IneligibilityCode,
        reason: `Election type '${election.type}' is not supported for demo voting.`,
        targetConstituencyType,
        targetConstituencyId,
        targetConstituencyName,
        targetConstituencyNumber,
        pollingWindow,
        effectiveNow,
      };
    }

    if (!targetConstituencyId) {
      return {
        eligible: false,
        code: 'MISSING_CONSTITUENCY_MAPPING' as IneligibilityCode,
        reason: `Voter profile is missing a ${targetConstituencyType} constituency mapping.`,
        targetConstituencyType,
        targetConstituencyId,
        targetConstituencyName,
        targetConstituencyNumber,
        pollingWindow,
        effectiveNow,
      };
    }

    if (
      election.type === ElectionType.STATE_ASSEMBLY &&
      election.stateId &&
      profile.stateId !== election.stateId
    ) {
      return {
        eligible: false,
        code: 'OUT_OF_JURISDICTION' as IneligibilityCode,
        reason: `This State Assembly election is scoped to state '${election.stateId}', whereas your voter profile is registered in '${profile.stateId}'.`,
        targetConstituencyType,
        targetConstituencyId,
        targetConstituencyName,
        targetConstituencyNumber,
        pollingWindow,
        effectiveNow,
      };
    }

    if (existingParticipation) {
      return {
        eligible: false,
        code: 'ALREADY_PARTICIPATED' as IneligibilityCode,
        reason: 'You have already recorded demo participation for this election.',
        targetConstituencyType,
        targetConstituencyId,
        targetConstituencyName,
        targetConstituencyNumber,
        pollingWindow,
        effectiveNow,
      };
    }

    if (election.status === ElectionStatus.CANCELLED) {
      return {
        eligible: false,
        code: 'ELECTION_CANCELLED' as IneligibilityCode,
        reason: 'This demo election has been cancelled.',
        targetConstituencyType,
        targetConstituencyId,
        targetConstituencyName,
        targetConstituencyNumber,
        pollingWindow,
        effectiveNow,
      };
    }

    if (election.status === ElectionStatus.ARCHIVED) {
      return {
        eligible: false,
        code: 'ELECTION_ARCHIVED' as IneligibilityCode,
        reason: 'This demo election has been archived.',
        targetConstituencyType,
        targetConstituencyId,
        targetConstituencyName,
        targetConstituencyNumber,
        pollingWindow,
        effectiveNow,
      };
    }

    if (NOT_STARTED_STATUSES.has(election.status)) {
      return {
        eligible: false,
        code: 'ELECTION_NOT_STARTED' as IneligibilityCode,
        reason: `Polling has not started for this demo election (status: ${election.status}).`,
        targetConstituencyType,
        targetConstituencyId,
        targetConstituencyName,
        targetConstituencyNumber,
        pollingWindow,
        effectiveNow,
      };
    }

    if (CLOSED_STATUSES.has(election.status)) {
      return {
        eligible: false,
        code: 'ELECTION_CLOSED' as IneligibilityCode,
        reason: `Polling has closed for this demo election (status: ${election.status}).`,
        targetConstituencyType,
        targetConstituencyId,
        targetConstituencyName,
        targetConstituencyNumber,
        pollingWindow,
        effectiveNow,
      };
    }

    const isConstituencyAssigned = election.constituencyMappings.some((m) =>
      targetConstituencyType === ConstituencyType.PARLIAMENTARY
        ? m.constituencyType === ConstituencyType.PARLIAMENTARY &&
          m.parliamentaryConstituencyId === targetConstituencyId
        : m.constituencyType === ConstituencyType.ASSEMBLY &&
          m.assemblyConstituencyId === targetConstituencyId
    );

    if (!isConstituencyAssigned) {
      return {
        eligible: false,
        code: 'CONSTITUENCY_NOT_ASSIGNED' as IneligibilityCode,
        reason: `Your constituency '${targetConstituencyId}' is not assigned to election '${election.id}'.`,
        targetConstituencyType,
        targetConstituencyId,
        targetConstituencyName,
        targetConstituencyNumber,
        pollingWindow,
        effectiveNow,
      };
    }

    if (
      election.configReviewStatus !== ConfigurationReviewStatus.APPROVED ||
      !pollingWindow.startAt ||
      !pollingWindow.endAt
    ) {
      return {
        eligible: false,
        code: 'CONFIGURATION_INCOMPLETE' as IneligibilityCode,
        reason:
          'Election configuration or polling schedule is incomplete or awaiting approval.',
        targetConstituencyType,
        targetConstituencyId,
        targetConstituencyName,
        targetConstituencyNumber,
        pollingWindow,
        effectiveNow,
      };
    }

    if (effectiveNow < pollingWindow.startAt) {
      return {
        eligible: false,
        code: 'ELECTION_NOT_STARTED' as IneligibilityCode,
        reason: 'The configured demo polling window has not started yet.',
        targetConstituencyType,
        targetConstituencyId,
        targetConstituencyName,
        targetConstituencyNumber,
        pollingWindow,
        effectiveNow,
      };
    }

    if (effectiveNow > pollingWindow.endAt) {
      return {
        eligible: false,
        code: 'ELECTION_CLOSED' as IneligibilityCode,
        reason: 'The configured demo polling window has closed.',
        targetConstituencyType,
        targetConstituencyId,
        targetConstituencyName,
        targetConstituencyNumber,
        pollingWindow,
        effectiveNow,
      };
    }

    if (approvedNominationsCount <= 0) {
      return {
        eligible: false,
        code: 'NO_APPROVED_CANDIDATES' as IneligibilityCode,
        reason:
          'There are currently no approved candidate nominations for your constituency in this election.',
        targetConstituencyType,
        targetConstituencyId,
        targetConstituencyName,
        targetConstituencyNumber,
        pollingWindow,
        effectiveNow,
      };
    }

    return {
      eligible: true,
      code: null,
      reason: null,
      targetConstituencyType,
      targetConstituencyId,
      targetConstituencyName,
      targetConstituencyNumber,
      pollingWindow,
      effectiveNow,
    };
  }

  async listVoterElections(userId: string) {
    const profile = await this.getVoterProfileByUserId(userId);

    const [elections, participations] = await Promise.all([
      this.prisma.election.findMany({
        where: {
          status: { notIn: [ElectionStatus.DRAFT] },
        },
        orderBy: [{ pollingStartDate: 'asc' }, { id: 'asc' }],
        include: {
          state: { select: { id: true, name: true, type: true } },
          scheduleMilestones: {
            select: { milestoneType: true, startAt: true, endAt: true },
          },
          constituencyMappings: {
            select: {
              constituencyType: true,
              parliamentaryConstituencyId: true,
              assemblyConstituencyId: true,
            },
          },
        },
      }),
      this.prisma.demoParticipation.findMany({
        where: { voterId: profile.id },
        select: {
          id: true,
          electionId: true,
          status: true,
          demoReference: true,
          referenceId: true,
          participatedAt: true,
          recordedAt: true,
        },
      }),
    ]);

    const partByElection = new Map(participations.map((p) => [p.electionId, p]));

    // Filter to elections relevant to the voter: LOK_SABHA (national) or STATE_ASSEMBLY matching voter's state
    const relevantElections = elections.filter(
      (el) =>
        el.type === ElectionType.LOK_SABHA ||
        (el.type === ElectionType.STATE_ASSEMBLY && el.stateId === profile.stateId)
    );

    const items = await Promise.all(
      relevantElections.map(async (el) => {
        const targetConstituencyId =
          el.type === ElectionType.LOK_SABHA
            ? profile.parliamentaryConstituencyId
            : profile.assemblyConstituencyId;
        const targetConstituencyType =
          el.type === ElectionType.LOK_SABHA
            ? ConstituencyType.PARLIAMENTARY
            : ConstituencyType.ASSEMBLY;

        const approvedCount = targetConstituencyId
          ? await this.prisma.candidateNomination.count({
              where: {
                electionId: el.id,
                constituencyType: targetConstituencyType,
                ...(targetConstituencyType === ConstituencyType.PARLIAMENTARY
                  ? { parliamentaryConstituencyId: targetConstituencyId }
                  : { assemblyConstituencyId: targetConstituencyId }),
                status: 'APPROVED',
                candidate: { isActive: true },
              },
            })
          : 0;

        const participation = partByElection.get(el.id) ?? null;
        const evalRes = this.evaluateEligibility(
          profile,
          el,
          approvedCount,
          participation
        );

        return {
          id: el.id,
          name: el.name,
          type: el.type,
          year: el.year,
          stateId: el.stateId,
          state: el.state,
          status: el.status,
          configReviewStatus: el.configReviewStatus,
          scheduleTimezone: el.scheduleTimezone,
          pollingWindow: evalRes.pollingWindow,
          constituency: {
            type: evalRes.targetConstituencyType,
            id: evalRes.targetConstituencyId,
            name: evalRes.targetConstituencyName,
            number: evalRes.targetConstituencyNumber,
          },
          approvedCandidatesCount: approvedCount,
          eligible: evalRes.eligible,
          ineligibilityCode: evalRes.code,
          ineligibilityReason: evalRes.reason,
          hasParticipated: Boolean(participation),
          participation: participation
            ? {
                status: participation.status,
                demoReference: participation.demoReference,
                referenceId: participation.referenceId,
                participatedAt: participation.participatedAt,
                recordedAt: participation.recordedAt,
              }
            : null,
          disclaimer:
            'Educational DEMO_SAMPLE simulation. Candidate choices are never transmitted to or stored by the server.',
        };
      })
    );

    return {
      voter: {
        id: profile.id,
        epicNumber: profile.epicNumber,
        fullName: profile.fullName,
        stateId: profile.stateId,
        stateName: profile.state.name,
        districtId: profile.districtId,
        districtName: profile.district.name,
        parliamentaryConstituency: profile.parliamentaryConstituency,
        assemblyConstituency: profile.assemblyConstituency,
      },
      elections: items,
    };
  }

  async getVoterElectionDetail(userId: string, electionId: string) {
    const discovery = await this.listVoterElections(userId);
    const match = discovery.elections.find((e) => e.id === electionId);
    if (!match) {
      throw new NotFoundProblemError('Election', electionId);
    }
    return match;
  }

  async getVoterElectionEligibility(userId: string, electionId: string) {
    const profile = await this.getVoterProfileByUserId(userId);
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      include: {
        state: { select: { id: true, name: true } },
        scheduleMilestones: {
          select: { milestoneType: true, startAt: true, endAt: true },
        },
        constituencyMappings: {
          select: {
            constituencyType: true,
            parliamentaryConstituencyId: true,
            assemblyConstituencyId: true,
          },
        },
      },
    });
    if (!election || election.status === ElectionStatus.DRAFT) {
      throw new NotFoundProblemError('Election', electionId);
    }

    const targetConstituencyType =
      election.type === ElectionType.LOK_SABHA
        ? ConstituencyType.PARLIAMENTARY
        : ConstituencyType.ASSEMBLY;
    const targetConstituencyId =
      election.type === ElectionType.LOK_SABHA
        ? profile.parliamentaryConstituencyId
        : profile.assemblyConstituencyId;

    const [approvedCount, participation] = await Promise.all([
      targetConstituencyId
        ? this.prisma.candidateNomination.count({
            where: {
              electionId: election.id,
              constituencyType: targetConstituencyType,
              ...(targetConstituencyType === ConstituencyType.PARLIAMENTARY
                ? { parliamentaryConstituencyId: targetConstituencyId }
                : { assemblyConstituencyId: targetConstituencyId }),
              status: 'APPROVED',
              candidate: { isActive: true },
            },
          })
        : Promise.resolve(0),
      this.prisma.demoParticipation.findUnique({
        where: {
          voterId_electionId: { voterId: profile.id, electionId: election.id },
        },
      }),
    ]);

    const evalRes = this.evaluateEligibility(
      profile,
      election,
      approvedCount,
      participation
    );

    return {
      electionId: election.id,
      electionType: election.type,
      eligible: evalRes.eligible,
      code: evalRes.code,
      reason: evalRes.reason,
      hasParticipated: Boolean(participation),
      constituency: {
        type: evalRes.targetConstituencyType,
        id: evalRes.targetConstituencyId,
        name: evalRes.targetConstituencyName,
      },
      pollingWindow: evalRes.pollingWindow,
      timezone: election.scheduleTimezone,
    };
  }

  async getBallot(userId: string, electionId: string) {
    const profile = await this.getVoterProfileByUserId(userId);
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      include: {
        state: { select: { id: true, name: true, type: true } },
        scheduleMilestones: {
          select: { milestoneType: true, startAt: true, endAt: true },
        },
        constituencyMappings: {
          select: {
            constituencyType: true,
            parliamentaryConstituencyId: true,
            assemblyConstituencyId: true,
          },
        },
      },
    });
    if (!election || election.status === ElectionStatus.DRAFT) {
      throw new NotFoundProblemError('Election', electionId);
    }

    const targetConstituencyType =
      election.type === ElectionType.LOK_SABHA
        ? ConstituencyType.PARLIAMENTARY
        : ConstituencyType.ASSEMBLY;
    const targetConstituencyId =
      election.type === ElectionType.LOK_SABHA
        ? profile.parliamentaryConstituencyId
        : profile.assemblyConstituencyId;

    const [nominations, participation] = await Promise.all([
      targetConstituencyId
        ? this.prisma.candidateNomination.findMany({
            where: {
              electionId: election.id,
              constituencyType: targetConstituencyType,
              ...(targetConstituencyType === ConstituencyType.PARLIAMENTARY
                ? { parliamentaryConstituencyId: targetConstituencyId }
                : { assemblyConstituencyId: targetConstituencyId }),
              status: 'APPROVED',
              candidate: { isActive: true },
            },
            orderBy: [{ candidate: { fullName: 'asc' } }, { id: 'asc' }],
            include: {
              candidate: {
                select: {
                  id: true,
                  fullName: true,
                  age: true,
                  gender: true,
                  education: true,
                  profession: true,
                  photoUrl: true,
                  bio: true,
                },
              },
              party: {
                select: {
                  id: true,
                  name: true,
                  abbreviation: true,
                  partyType: true,
                  symbolName: true,
                  symbolUrl: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      this.prisma.demoParticipation.findUnique({
        where: {
          voterId_electionId: { voterId: profile.id, electionId: election.id },
        },
      }),
    ]);

    const evalRes = this.evaluateEligibility(
      profile,
      election,
      nominations.length,
      participation
    );

    if (!evalRes.eligible && evalRes.code) {
      throwForIneligibility(
        evalRes.code,
        evalRes.reason ?? 'Not eligible to view this ballot.'
      );
    }

    return {
      election: {
        id: election.id,
        name: election.name,
        type: election.type,
        year: election.year,
        stateId: election.stateId,
        state: election.state,
        status: election.status,
        scheduleTimezone: election.scheduleTimezone,
        pollingWindow: evalRes.pollingWindow,
      },
      constituency: {
        type: evalRes.targetConstituencyType,
        id: evalRes.targetConstituencyId,
        name: evalRes.targetConstituencyName,
        number: evalRes.targetConstituencyNumber,
      },
      candidates: nominations.map((n, index) => ({
        ballotOrder: index + 1,
        nominationId: n.id,
        candidateId: n.candidate.id,
        fullName: n.candidate.fullName,
        age: n.candidate.age,
        gender: n.candidate.gender,
        education: n.candidate.education,
        profession: n.candidate.profession,
        photoUrl: n.candidate.photoUrl,
        bio: n.candidate.bio,
        isIndependent: n.isIndependent,
        party: n.party
          ? {
              id: n.party.id,
              name: n.party.name,
              abbreviation: n.party.abbreviation,
              partyType: n.party.partyType,
              symbolName: n.party.symbolName,
              symbolUrl: n.party.symbolUrl,
            }
          : null,
      })),
      disclaimer:
        'EDUCATIONAL DEMO ONLY — Candidate selection remains exclusively in your browser memory and is never sent to or stored by the server.',
    };
  }

  async confirmParticipation(userId: string, electionId: string) {
    const profile = await this.getVoterProfileByUserId(userId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const election = await tx.election.findUnique({
          where: { id: electionId },
          include: {
            state: { select: { id: true, name: true } },
            scheduleMilestones: {
              select: { milestoneType: true, startAt: true, endAt: true },
            },
            constituencyMappings: {
              select: {
                constituencyType: true,
                parliamentaryConstituencyId: true,
                assemblyConstituencyId: true,
              },
            },
          },
        });

        if (!election || election.status === ElectionStatus.DRAFT) {
          throw new NotFoundProblemError('Election', electionId);
        }

        const targetConstituencyType =
          election.type === ElectionType.LOK_SABHA
            ? ConstituencyType.PARLIAMENTARY
            : ConstituencyType.ASSEMBLY;
        const targetConstituencyId =
          election.type === ElectionType.LOK_SABHA
            ? profile.parliamentaryConstituencyId
            : profile.assemblyConstituencyId;

        const [approvedCount, existing] = await Promise.all([
          targetConstituencyId
            ? tx.candidateNomination.count({
                where: {
                  electionId: election.id,
                  constituencyType: targetConstituencyType,
                  ...(targetConstituencyType === ConstituencyType.PARLIAMENTARY
                    ? { parliamentaryConstituencyId: targetConstituencyId }
                    : { assemblyConstituencyId: targetConstituencyId }),
                  status: 'APPROVED',
                  candidate: { isActive: true },
                },
              })
            : Promise.resolve(0),
          tx.demoParticipation.findUnique({
            where: {
              voterId_electionId: {
                voterId: profile.id,
                electionId: election.id,
              },
            },
          }),
        ]);

        const evalRes = this.evaluateEligibility(
          profile,
          election,
          approvedCount,
          existing
        );

        if (!evalRes.eligible && evalRes.code) {
          throwForIneligibility(
            evalRes.code,
            evalRes.reason ?? 'Cannot record participation for this election.'
          );
        }

        const refs = buildDemoReference(election.id);

        const created = await tx.demoParticipation.create({
          data: {
            voterId: profile.id,
            electionId: election.id,
            constituencyType: evalRes.targetConstituencyType,
            parliamentaryConstituencyId:
              evalRes.targetConstituencyType === ConstituencyType.PARLIAMENTARY
                ? evalRes.targetConstituencyId
                : null,
            assemblyConstituencyId:
              evalRes.targetConstituencyType === ConstituencyType.ASSEMBLY
                ? evalRes.targetConstituencyId
                : null,
            status: ParticipationStatus.PARTICIPATED,
            demoReference: refs.demoReference,
            referenceId: refs.referenceId,
            participatedAt: evalRes.effectiveNow,
            metadata: {
              source: 'DEMO_VOTING_SIMULATION',
              timezone: election.scheduleTimezone,
            },
          },
        });

        return {
          id: created.id,
          electionId: election.id,
          electionName: election.name,
          electionType: election.type,
          constituencyType: created.constituencyType,
          constituencyId: evalRes.targetConstituencyId,
          constituencyName: evalRes.targetConstituencyName,
          status: created.status,
          demoReference: created.demoReference,
          referenceId: created.referenceId,
          participatedAt: created.participatedAt,
          recordedAt: created.recordedAt,
          disclaimer:
            'Educational demo participation recorded. Zero candidate-choice information was transmitted or stored.',
        };
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictProblemError(
          'You have already recorded demo participation for this election.'
        );
      }
      throw err;
    }
  }

  async listParticipationHistory(userId: string) {
    const profile = await this.getVoterProfileByUserId(userId);
    const records = await this.prisma.demoParticipation.findMany({
      where: { voterId: profile.id },
      orderBy: [{ participatedAt: 'desc' }, { recordedAt: 'desc' }],
      include: {
        election: {
          select: {
            id: true,
            name: true,
            type: true,
            year: true,
            stateId: true,
            status: true,
            scheduleTimezone: true,
          },
        },
        parliamentaryConstituency: {
          select: { id: true, name: true, constituencyNumber: true },
        },
        assemblyConstituency: {
          select: { id: true, name: true, constituencyNumber: true },
        },
      },
    });

    return records.map((r) => ({
      id: r.id,
      electionId: r.electionId,
      electionName: r.election.name,
      electionType: r.election.type,
      year: r.election.year,
      constituencyType: r.constituencyType,
      constituency:
        r.constituencyType === ConstituencyType.PARLIAMENTARY
          ? r.parliamentaryConstituency
          : r.assemblyConstituency,
      status: r.status,
      demoReference: r.demoReference,
      referenceId: r.referenceId,
      participatedAt: r.participatedAt,
      recordedAt: r.recordedAt,
    }));
  }

  async getParticipationForElection(userId: string, electionId: string) {
    const profile = await this.getVoterProfileByUserId(userId);
    const record = await this.prisma.demoParticipation.findUnique({
      where: {
        voterId_electionId: { voterId: profile.id, electionId },
      },
      include: {
        election: {
          select: {
            id: true,
            name: true,
            type: true,
            year: true,
            stateId: true,
            status: true,
          },
        },
        parliamentaryConstituency: {
          select: { id: true, name: true, constituencyNumber: true },
        },
        assemblyConstituency: {
          select: { id: true, name: true, constituencyNumber: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundProblemError('DemoParticipation', electionId);
    }

    return {
      id: record.id,
      electionId: record.electionId,
      electionName: record.election.name,
      electionType: record.election.type,
      year: record.election.year,
      constituencyType: record.constituencyType,
      constituency:
        record.constituencyType === ConstituencyType.PARLIAMENTARY
          ? record.parliamentaryConstituency
          : record.assemblyConstituency,
      status: record.status,
      demoReference: record.demoReference,
      referenceId: record.referenceId,
      participatedAt: record.participatedAt,
      recordedAt: record.recordedAt,
      disclaimer:
        'Educational demo participation record. No candidate choice is associated with this record.',
    };
  }

  // ---------------------------------------------------------------------------
  // Administrative Participation Aggregate Reporting (Zero Candidate Data)
  // ---------------------------------------------------------------------------

  private async getAuthorizedAdminElection(
    actor: SafeAdminUser,
    electionId: string
  ) {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      include: { state: { select: { id: true, name: true } } },
    });
    if (!election) {
      throw new NotFoundProblemError('Election', electionId);
    }

    if (actor.role === 'STATE_ADMIN') {
      const allowedStates = actor.assignedStateIds?.length
        ? actor.assignedStateIds
        : actor.assignedStateId
          ? [actor.assignedStateId]
          : [];
      if (
        election.type === ElectionType.STATE_ASSEMBLY &&
        (!election.stateId || !allowedStates.includes(election.stateId))
      ) {
        throw new ForbiddenProblemError(
          `Access denied: Election '${electionId}' is outside your assigned state scope.`
        );
      }
      if (election.type === ElectionType.LOK_SABHA && allowedStates.length === 0) {
        throw new ForbiddenProblemError(
          'Access denied: STATE_ADMIN has no assigned state scope.'
        );
      }
    } else if (actor.role === 'ELECTION_OFFICER') {
      if (!actor.assignedElectionIds.includes(electionId)) {
        throw new ForbiddenProblemError(
          `Access denied: Election '${electionId}' is outside your assigned officer scope.`
        );
      }
    }

    return election;
  }

  async getAdminParticipationSummary(actor: SafeAdminUser, electionId: string) {
    const election = await this.getAuthorizedAdminElection(actor, electionId);

    const eligibleWhere =
      election.type === ElectionType.STATE_ASSEMBLY && election.stateId
        ? { stateId: election.stateId }
        : {};

    const [totalEligibleVoters, totalParticipated, pcCount, acCount] =
      await Promise.all([
        this.prisma.voterProfile.count({ where: eligibleWhere }),
        this.prisma.demoParticipation.count({ where: { electionId: election.id } }),
        this.prisma.demoParticipation.count({
          where: {
            electionId: election.id,
            constituencyType: ConstituencyType.PARLIAMENTARY,
          },
        }),
        this.prisma.demoParticipation.count({
          where: {
            electionId: election.id,
            constituencyType: ConstituencyType.ASSEMBLY,
          },
        }),
      ]);

    const participationPercentage =
      totalEligibleVoters > 0
        ? Number(((totalParticipated / totalEligibleVoters) * 100).toFixed(2))
        : 0;

    return {
      electionId: election.id,
      electionName: election.name,
      electionType: election.type,
      stateId: election.stateId,
      status: election.status,
      totalEligibleVoters,
      totalParticipated,
      participationPercentage,
      byConstituencyType: {
        PARLIAMENTARY: pcCount,
        ASSEMBLY: acCount,
      },
      privacyNote:
        'Aggregate participation metrics only. Candidate choices are never collected or stored.',
    };
  }

  async getAdminParticipationByConstituency(
    actor: SafeAdminUser,
    electionId: string
  ) {
    const election = await this.getAuthorizedAdminElection(actor, electionId);
    const mappings = await this.prisma.electionConstituency.findMany({
      where: { electionId: election.id },
      include: {
        parliamentaryConstituency: {
          select: { id: true, name: true, stateId: true, constituencyNumber: true },
        },
        assemblyConstituency: {
          select: { id: true, name: true, stateId: true, constituencyNumber: true },
        },
      },
    });

    const rows = await Promise.all(
      mappings.map(async (m) => {
        const isPc = m.constituencyType === ConstituencyType.PARLIAMENTARY;
        const cid = isPc
          ? m.parliamentaryConstituencyId!
          : m.assemblyConstituencyId!;
        const cObj = isPc
          ? m.parliamentaryConstituency
          : m.assemblyConstituency;

        const [eligibleVoters, participatedCount] = await Promise.all([
          this.prisma.voterProfile.count({
            where: isPc
              ? { parliamentaryConstituencyId: cid }
              : { assemblyConstituencyId: cid },
          }),
          this.prisma.demoParticipation.count({
            where: {
              electionId: election.id,
              ...(isPc
                ? { parliamentaryConstituencyId: cid }
                : { assemblyConstituencyId: cid }),
            },
          }),
        ]);

        return {
          constituencyId: cid,
          constituencyName: cObj?.name ?? cid,
          constituencyType: m.constituencyType,
          stateId: cObj?.stateId ?? election.stateId,
          eligibleVoters,
          participatedCount,
          participationPercentage:
            eligibleVoters > 0
              ? Number(((participatedCount / eligibleVoters) * 100).toFixed(2))
              : 0,
        };
      })
    );

    return {
      electionId: election.id,
      items: rows,
    };
  }

  async getAdminParticipationTimeline(actor: SafeAdminUser, electionId: string) {
    const election = await this.getAuthorizedAdminElection(actor, electionId);
    const records = await this.prisma.demoParticipation.findMany({
      where: { electionId: election.id },
      select: { participatedAt: true },
      orderBy: { participatedAt: 'asc' },
    });

    const buckets = new Map<string, number>();
    for (const r of records) {
      const hourBucket = `${r.participatedAt.toISOString().slice(0, 13)}:00:00.000Z`;
      buckets.set(hourBucket, (buckets.get(hourBucket) ?? 0) + 1);
    }

    return {
      electionId: election.id,
      timezone: 'UTC',
      buckets: Array.from(buckets.entries()).map(([bucket, count]) => ({
        bucket,
        count,
      })),
    };
  }
}
