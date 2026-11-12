import { ScheduleMilestoneType } from '@prisma/client';

export const DEFAULT_ELECTION_TIMEZONE = 'Asia/Kolkata';

export const MILESTONE_ORDER: readonly ScheduleMilestoneType[] = [
  ScheduleMilestoneType.ELECTION_ANNOUNCEMENT,
  ScheduleMilestoneType.NOMINATION_OPEN,
  ScheduleMilestoneType.NOMINATION_DEADLINE,
  ScheduleMilestoneType.NOMINATION_SCRUTINY,
  ScheduleMilestoneType.WITHDRAWAL_DEADLINE,
  ScheduleMilestoneType.FINAL_CANDIDATE_LIST,
  ScheduleMilestoneType.CAMPAIGN_START,
  ScheduleMilestoneType.CAMPAIGN_END,
  ScheduleMilestoneType.POLLING_START,
  ScheduleMilestoneType.POLLING_END,
  ScheduleMilestoneType.COUNTING_START,
  ScheduleMilestoneType.RESULT_REVIEW,
  ScheduleMilestoneType.RESULT_PUBLICATION,
];

export const MANDATORY_SCHEDULE_MILESTONES: readonly ScheduleMilestoneType[] = [
  ScheduleMilestoneType.NOMINATION_OPEN,
  ScheduleMilestoneType.NOMINATION_DEADLINE,
  ScheduleMilestoneType.NOMINATION_SCRUTINY,
  ScheduleMilestoneType.WITHDRAWAL_DEADLINE,
  ScheduleMilestoneType.POLLING_START,
  ScheduleMilestoneType.POLLING_END,
  ScheduleMilestoneType.COUNTING_START,
  ScheduleMilestoneType.RESULT_PUBLICATION,
];

export interface ScheduleMilestoneInput {
  milestoneType: ScheduleMilestoneType;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
  timezone?: string;
}

export interface ScheduleValidationIssue {
  code: string;
  milestoneType?: ScheduleMilestoneType;
  message: string;
  suggestedAction: string;
}

export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

function toTimestamp(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? NaN : d.getTime();
}

export function validateElectionSchedule(
  milestones: ScheduleMilestoneInput[],
  timezone: string,
  options: { requireMandatory?: boolean } = {}
): { valid: boolean; issues: ScheduleValidationIssue[] } {
  const issues: ScheduleValidationIssue[] = [];
  const requireMandatory = options.requireMandatory ?? true;

  if (!isValidIanaTimezone(timezone)) {
    issues.push({
      code: 'INVALID_TIMEZONE',
      message: `Timezone '${timezone}' is not a valid IANA timezone (expected e.g. 'Asia/Kolkata').`,
      suggestedAction: "Set schedule timezone to 'Asia/Kolkata' or another valid IANA zone.",
    });
  }

  const byType = new Map<
    ScheduleMilestoneType,
    { startMs: number | null; endMs: number | null }
  >();

  for (const m of milestones) {
    if (m.timezone && !isValidIanaTimezone(m.timezone)) {
      issues.push({
        code: 'INVALID_MILESTONE_TIMEZONE',
        milestoneType: m.milestoneType,
        message: `Milestone '${m.milestoneType}' has invalid timezone '${m.timezone}'.`,
        suggestedAction: "Use 'Asia/Kolkata' or a valid IANA timezone.",
      });
    }

    const startMs = toTimestamp(m.startAt);
    const endMs = toTimestamp(m.endAt);

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      issues.push({
        code: 'INVALID_DATE_VALUE',
        milestoneType: m.milestoneType,
        message: `Milestone '${m.milestoneType}' contains an invalid date/timestamp.`,
        suggestedAction: 'Provide valid ISO-8601 UTC timestamps.',
      });
      continue;
    }

    if (startMs !== null && endMs !== null && startMs > endMs) {
      issues.push({
        code: 'START_AFTER_END',
        milestoneType: m.milestoneType,
        message: `Milestone '${m.milestoneType}' start timestamp cannot be later than its end timestamp.`,
        suggestedAction: 'Ensure startAt <= endAt.',
      });
    }

    if (byType.has(m.milestoneType)) {
      issues.push({
        code: 'DUPLICATE_MILESTONE',
        milestoneType: m.milestoneType,
        message: `Duplicate milestone '${m.milestoneType}' in schedule payload.`,
        suggestedAction: 'Provide each milestoneType at most once.',
      });
    }

    byType.set(m.milestoneType, { startMs, endMs });
  }

  if (requireMandatory) {
    for (const reqType of MANDATORY_SCHEDULE_MILESTONES) {
      const entry = byType.get(reqType);
      if (!entry || (entry.startMs === null && entry.endMs === null)) {
        issues.push({
          code: 'MISSING_MANDATORY_MILESTONE',
          milestoneType: reqType,
          message: `Mandatory milestone '${reqType}' is not configured.`,
          suggestedAction: `Configure timestamps for '${reqType}'.`,
        });
      }
    }
  }

  // Chronological ordering check across configured milestones
  let prevType: ScheduleMilestoneType | null = null;
  let prevAnchorMs: number | null = null;

  for (const mType of MILESTONE_ORDER) {
    const entry = byType.get(mType);
    if (!entry) continue;
    const anchor = entry.startMs ?? entry.endMs;
    if (anchor === null) continue;

    if (prevAnchorMs !== null && anchor < prevAnchorMs && prevType) {
      issues.push({
        code: 'MILESTONE_OUT_OF_ORDER',
        milestoneType: mType,
        message: `Milestone '${mType}' occurs earlier than preceding milestone '${prevType}'.`,
        suggestedAction: `Ensure '${mType}' is scheduled on or after '${prevType}'.`,
      });
    }
    prevType = mType;
    prevAnchorMs = entry.endMs ?? anchor;
  }

  // Specific domain invariants
  const pollingEnd = byType.get(ScheduleMilestoneType.POLLING_END);
  const countingStart = byType.get(ScheduleMilestoneType.COUNTING_START);
  if (pollingEnd && countingStart) {
    const pEnd = pollingEnd.endMs ?? pollingEnd.startMs;
    const cStart = countingStart.startMs ?? countingStart.endMs;
    if (pEnd !== null && cStart !== null && cStart < pEnd) {
      issues.push({
        code: 'COUNTING_BEFORE_POLLING_END',
        milestoneType: ScheduleMilestoneType.COUNTING_START,
        message: 'Counting cannot start before polling ends.',
        suggestedAction: 'Schedule COUNTING_START on or after POLLING_END.',
      });
    }
  }

  const resReview = byType.get(ScheduleMilestoneType.RESULT_REVIEW);
  const resPub = byType.get(ScheduleMilestoneType.RESULT_PUBLICATION);
  if (resReview && resPub) {
    const rRev = resReview.endMs ?? resReview.startMs;
    const rPub = resPub.startMs ?? resPub.endMs;
    if (rRev !== null && rPub !== null && rPub < rRev) {
      issues.push({
        code: 'PUBLICATION_BEFORE_REVIEW',
        milestoneType: ScheduleMilestoneType.RESULT_PUBLICATION,
        message: 'Result publication cannot occur before result review.',
        suggestedAction: 'Schedule RESULT_PUBLICATION on or after RESULT_REVIEW.',
      });
    }
  }

  return { valid: issues.length === 0, issues };
}
