import { CandidateNominationStatus, ElectionStatus } from '@prisma/client';
import {
  ADMIN_PERMISSIONS,
  type AdminPermission,
} from '../admin/admin.permissions.js';

export interface NominationTransitionRule {
  from: CandidateNominationStatus;
  to: CandidateNominationStatus;
  requiredPermission: AdminPermission;
  requiresReason: boolean;
  description: string;
}

export const NOMINATION_TRANSITION_MATRIX: readonly NominationTransitionRule[] = [
  {
    from: CandidateNominationStatus.DRAFT,
    to: CandidateNominationStatus.SUBMITTED,
    requiredPermission: ADMIN_PERMISSIONS.NOMINATIONS_SUBMIT,
    requiresReason: false,
    description: 'Submit draft nomination for official scrutiny.',
  },
  {
    from: CandidateNominationStatus.SUBMITTED,
    to: CandidateNominationStatus.UNDER_REVIEW,
    requiredPermission: ADMIN_PERMISSIONS.NOMINATIONS_REVIEW,
    requiresReason: false,
    description: 'Open submitted nomination for administrative scrutiny.',
  },
  {
    from: CandidateNominationStatus.SUBMITTED,
    to: CandidateNominationStatus.WITHDRAWN,
    requiredPermission: ADMIN_PERMISSIONS.NOMINATIONS_WITHDRAW,
    requiresReason: true,
    description: 'Withdraw submitted nomination prior to scrutiny completion.',
  },
  {
    from: CandidateNominationStatus.UNDER_REVIEW,
    to: CandidateNominationStatus.APPROVED,
    requiredPermission: ADMIN_PERMISSIONS.NOMINATIONS_APPROVE,
    requiresReason: false,
    description: 'Approve reviewed nomination for ballot eligibility.',
  },
  {
    from: CandidateNominationStatus.UNDER_REVIEW,
    to: CandidateNominationStatus.REJECTED,
    requiredPermission: ADMIN_PERMISSIONS.NOMINATIONS_REJECT,
    requiresReason: true,
    description: 'Reject reviewed nomination with mandatory reason.',
  },
  {
    from: CandidateNominationStatus.UNDER_REVIEW,
    to: CandidateNominationStatus.WITHDRAWN,
    requiredPermission: ADMIN_PERMISSIONS.NOMINATIONS_WITHDRAW,
    requiresReason: true,
    description: 'Withdraw nomination during scrutiny review.',
  },
  {
    from: CandidateNominationStatus.APPROVED,
    to: CandidateNominationStatus.WITHDRAWN,
    requiredPermission: ADMIN_PERMISSIONS.NOMINATIONS_WITHDRAW,
    requiresReason: true,
    description: 'Withdraw previously approved nomination while preserving history.',
  },
];

export const NOMINATION_ALLOWED_ELECTION_STATUSES: ReadonlySet<ElectionStatus> =
  new Set([
    ElectionStatus.DRAFT,
    ElectionStatus.UPCOMING,
    ElectionStatus.NOMINATION_OPEN,
    ElectionStatus.NOMINATION_CLOSED,
    ElectionStatus.READY,
    ElectionStatus.POLLING_ACTIVE,
  ]);

export function findNominationTransitionRule(
  from: CandidateNominationStatus,
  to: CandidateNominationStatus
): NominationTransitionRule | null {
  return (
    NOMINATION_TRANSITION_MATRIX.find((r) => r.from === from && r.to === to) ??
    null
  );
}

export function isNominationEditable(status: CandidateNominationStatus): boolean {
  return status === CandidateNominationStatus.DRAFT;
}

export function isElectionOpenForNominations(status: ElectionStatus): boolean {
  return NOMINATION_ALLOWED_ELECTION_STATUSES.has(status);
}
