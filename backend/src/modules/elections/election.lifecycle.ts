import { ElectionStatus } from '@prisma/client';
import {
  ADMIN_PERMISSIONS,
  type AdminPermission,
} from '../admin/admin.permissions.js';

export interface ElectionTransitionRule {
  from: ElectionStatus;
  to: ElectionStatus;
  requiredPermission: AdminPermission;
  requiresReason: boolean;
  description: string;
}

/**
 * Authoritative Election Lifecycle Transition Matrix (Phase 8.5).
 * Cancellation and archival are separated into dedicated endpoints;
 * archived elections are strictly terminal, and cancelled elections may
 * only be archived (never reopened).
 */
export const ELECTION_TRANSITION_MATRIX: readonly ElectionTransitionRule[] = [
  // Standard forward lifecycle progression
  {
    from: ElectionStatus.DRAFT,
    to: ElectionStatus.UPCOMING,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_MANAGE_STATUS,
    requiresReason: false,
    description: 'Publish draft election schedule as an upcoming election.',
  },
  {
    from: ElectionStatus.UPCOMING,
    to: ElectionStatus.DRAFT,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_MANAGE_STATUS,
    requiresReason: false,
    description: 'Return upcoming election to draft prior to nominations opening.',
  },
  {
    from: ElectionStatus.UPCOMING,
    to: ElectionStatus.NOMINATION_OPEN,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_MANAGE_STATUS,
    requiresReason: false,
    description: 'Open candidate nomination window.',
  },
  {
    from: ElectionStatus.NOMINATION_OPEN,
    to: ElectionStatus.NOMINATION_CLOSED,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_MANAGE_STATUS,
    requiresReason: false,
    description: 'Close candidate nomination window for scrutiny.',
  },
  {
    from: ElectionStatus.NOMINATION_CLOSED,
    to: ElectionStatus.READY,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_MANAGE_STATUS,
    requiresReason: false,
    description: 'Finalize scrutiny and mark election ready for polling.',
  },
  {
    from: ElectionStatus.READY,
    to: ElectionStatus.POLLING_ACTIVE,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_MANAGE_STATUS,
    requiresReason: false,
    description: 'Open active simulated polling.',
  },
  {
    from: ElectionStatus.POLLING_ACTIVE,
    to: ElectionStatus.POLLING_COMPLETED,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_MANAGE_STATUS,
    requiresReason: false,
    description: 'Close polling window and mark polling completed.',
  },
  {
    from: ElectionStatus.POLLING_COMPLETED,
    to: ElectionStatus.COUNTING,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_MANAGE_STATUS,
    requiresReason: false,
    description: 'Initiate vote counting phase.',
  },
  {
    from: ElectionStatus.COUNTING,
    to: ElectionStatus.RESULTS_DECLARED,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_MANAGE_STATUS,
    requiresReason: false,
    description: 'Mark election counting complete with results declared.',
  },
  // Explicit cancellations (via POST /cancel)
  {
    from: ElectionStatus.DRAFT,
    to: ElectionStatus.CANCELLED,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_CANCEL,
    requiresReason: true,
    description: 'Cancel draft election with mandatory reason.',
  },
  {
    from: ElectionStatus.UPCOMING,
    to: ElectionStatus.CANCELLED,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_CANCEL,
    requiresReason: true,
    description: 'Cancel upcoming election with mandatory reason.',
  },
  {
    from: ElectionStatus.NOMINATION_OPEN,
    to: ElectionStatus.CANCELLED,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_CANCEL,
    requiresReason: true,
    description: 'Cancel election during nominations with mandatory reason.',
  },
  {
    from: ElectionStatus.NOMINATION_CLOSED,
    to: ElectionStatus.CANCELLED,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_CANCEL,
    requiresReason: true,
    description: 'Cancel election after nominations closed with mandatory reason.',
  },
  {
    from: ElectionStatus.READY,
    to: ElectionStatus.CANCELLED,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_CANCEL,
    requiresReason: true,
    description: 'Cancel ready election before polling with mandatory reason.',
  },
  {
    from: ElectionStatus.POLLING_ACTIVE,
    to: ElectionStatus.CANCELLED,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_CANCEL,
    requiresReason: true,
    description: 'Cancel active polling election due to verified irregularity.',
  },
  // Explicit archival (via POST /archive)
  {
    from: ElectionStatus.RESULTS_DECLARED,
    to: ElectionStatus.ARCHIVED,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_ARCHIVE,
    requiresReason: false,
    description: 'Archive completed election after results declaration.',
  },
  {
    from: ElectionStatus.CANCELLED,
    to: ElectionStatus.ARCHIVED,
    requiredPermission: ADMIN_PERMISSIONS.ELECTIONS_ARCHIVE,
    requiresReason: false,
    description: 'Archive cancelled election while preserving historical audit records.',
  },
];

export const METADATA_EDITABLE_STATUSES: ReadonlySet<ElectionStatus> = new Set([
  ElectionStatus.DRAFT,
  ElectionStatus.UPCOMING,
]);

export const CANCELLABLE_STATUSES: ReadonlySet<ElectionStatus> = new Set([
  ElectionStatus.DRAFT,
  ElectionStatus.UPCOMING,
  ElectionStatus.NOMINATION_OPEN,
  ElectionStatus.NOMINATION_CLOSED,
  ElectionStatus.READY,
  ElectionStatus.POLLING_ACTIVE,
]);

export const ARCHIVABLE_STATUSES: ReadonlySet<ElectionStatus> = new Set([
  ElectionStatus.RESULTS_DECLARED,
  ElectionStatus.CANCELLED,
]);

export const PUBLIC_HIDDEN_STATUSES: readonly ElectionStatus[] = [
  ElectionStatus.DRAFT,
  ElectionStatus.CANCELLED,
  ElectionStatus.ARCHIVED,
];

export function findTransitionRule(
  from: ElectionStatus,
  to: ElectionStatus
): ElectionTransitionRule | null {
  return (
    ELECTION_TRANSITION_MATRIX.find((r) => r.from === from && r.to === to) ?? null
  );
}

export function getAllowedNextStatuses(
  from: ElectionStatus,
  options: { includeTerminalActions?: boolean } = {}
): ElectionStatus[] {
  const includeTerminal = options.includeTerminalActions ?? false;
  return ELECTION_TRANSITION_MATRIX.filter((r) => {
    if (r.from !== from) return false;
    if (
      !includeTerminal &&
      (r.to === ElectionStatus.CANCELLED || r.to === ElectionStatus.ARCHIVED)
    ) {
      return false;
    }
    return true;
  }).map((r) => r.to);
}

export function isElectionMetadataEditable(status: ElectionStatus): boolean {
  return METADATA_EDITABLE_STATUSES.has(status);
}

export function isElectionCancellable(status: ElectionStatus): boolean {
  return CANCELLABLE_STATUSES.has(status);
}

export function isElectionArchivable(status: ElectionStatus): boolean {
  return ARCHIVABLE_STATUSES.has(status);
}
