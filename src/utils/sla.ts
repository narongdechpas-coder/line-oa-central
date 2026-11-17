// SLA simulation. All values are SIMULATED and driven by the deterministic demo clock.
import type { Case, Priority, SlaState } from '../types/domain';
import { addHours, ms } from './time';

/** Demo SLA targets in calendar hours (no business calendar in this demo). */
export const SLA_HOURS: Record<Priority, number> = {
  URGENT: 4,
  HIGH: 8,
  NORMAL: 24,
  LOW: 72,
};

/** Remaining time at or below this threshold counts as AT_RISK. */
export const AT_RISK_THRESHOLD_MS = 2 * 60 * 60_000;

export const dueAtFor = (priority: Priority, fromIso: string): string =>
  addHours(fromIso, SLA_HOURS[priority]);

export interface SlaInfo {
  state: SlaState;
  /** Positive = time left, negative = overdue. Measured at `now`, or at resolution for finished cases. */
  remainingMs: number;
  /** True once the case is RESOLVED/CLOSED: the result is final. */
  final: boolean;
}

export function computeSla(c: Pick<Case, 'status' | 'dueAt' | 'slaPausedAt' | 'resolvedAt'>, nowIso: string): SlaInfo {
  const due = ms(c.dueAt);
  if ((c.status === 'RESOLVED' || c.status === 'CLOSED') && c.resolvedAt) {
    const remainingMs = due - ms(c.resolvedAt);
    return { state: remainingMs < 0 ? 'BREACHED' : 'ON_TRACK', remainingMs, final: true };
  }
  if (c.slaPausedAt) {
    return { state: 'PAUSED', remainingMs: due - ms(c.slaPausedAt), final: false };
  }
  const remainingMs = due - ms(nowIso);
  if (remainingMs < 0) return { state: 'BREACHED', remainingMs, final: false };
  if (remainingMs <= AT_RISK_THRESHOLD_MS) return { state: 'AT_RISK', remainingMs, final: false };
  return { state: 'ON_TRACK', remainingMs, final: false };
}

/** When the SLA clock resumes, push dueAt out by the time spent paused. */
export function resumeDueAt(dueAt: string, pausedAt: string, nowIso: string): string {
  return new Date(ms(dueAt) + Math.max(0, ms(nowIso) - ms(pausedAt))).toISOString();
}
