// Lifecycle rules for Case, Escalation and Internal Task.
import type { CaseStatus, EscalationStatus, TaskStatus } from '../types/domain';

/**
 * Manual case transitions a user can pick from "Change Status".
 * ASSIGNED and ESCALATED are system-driven (Assign PIC / Escalate) and never picked manually.
 */
export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  NEW: ['TRIAGED', 'CLOSED'],
  TRIAGED: ['CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'PENDING'],
  IN_PROGRESS: ['PENDING', 'RESOLVED'],
  PENDING: ['IN_PROGRESS', 'RESOLVED'],
  ESCALATED: [],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS', 'PENDING'],
};

export interface CaseTransitionContext {
  hasActiveEscalation: boolean;
  hasOwner: boolean;
}

export function allowedCaseTransitions(from: CaseStatus, ctx: CaseTransitionContext): CaseStatus[] {
  // While an escalation is active the case is driven by the escalation workflow.
  if (ctx.hasActiveEscalation) return [];
  return CASE_TRANSITIONS[from].filter((to) => {
    if ((to === 'IN_PROGRESS' || to === 'RESOLVED' || to === 'PENDING') && !ctx.hasOwner) return false;
    return true;
  });
}

export function canTransitionCase(from: CaseStatus, to: CaseStatus, ctx: CaseTransitionContext): boolean {
  return allowedCaseTransitions(from, ctx).includes(to);
}

/** Statuses from which "Assign PIC" is offered. */
export const ASSIGNABLE_CASE_STATUSES: CaseStatus[] = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'REOPENED'];

/** Statuses from which a new escalation may be raised. */
export const ESCALATABLE_CASE_STATUSES: CaseStatus[] = ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'REOPENED'];

export const OPEN_CASE_STATUSES: CaseStatus[] = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ESCALATED', 'REOPENED'];
export const isCaseOpen = (s: CaseStatus) => OPEN_CASE_STATUSES.includes(s);

// ---- Escalation ------------------------------------------------------------
export type EscalationAction = 'REVIEW' | 'ACCEPT' | 'REJECT' | 'START' | 'RESOLVE' | 'CANCEL';

export const ESCALATION_ACTIONS: Record<EscalationAction, { from: EscalationStatus[]; to: EscalationStatus }> = {
  REVIEW: { from: ['REQUESTED'], to: 'UNDER_REVIEW' },
  ACCEPT: { from: ['REQUESTED', 'UNDER_REVIEW'], to: 'ACCEPTED' },
  REJECT: { from: ['REQUESTED', 'UNDER_REVIEW'], to: 'REJECTED' },
  START: { from: ['ACCEPTED'], to: 'IN_PROGRESS' },
  RESOLVE: { from: ['IN_PROGRESS'], to: 'RESOLVED' },
  CANCEL: { from: ['REQUESTED', 'UNDER_REVIEW', 'ACCEPTED', 'IN_PROGRESS'], to: 'CANCELLED' },
};

export const ACTIVE_ESCALATION_STATUSES: EscalationStatus[] = ['REQUESTED', 'UNDER_REVIEW', 'ACCEPTED', 'IN_PROGRESS'];
export const isEscalationActive = (s: EscalationStatus) => ACTIVE_ESCALATION_STATUSES.includes(s);

export function allowedEscalationActions(status: EscalationStatus): EscalationAction[] {
  return (Object.keys(ESCALATION_ACTIONS) as EscalationAction[]).filter((a) =>
    ESCALATION_ACTIONS[a].from.includes(status),
  );
}

// ---- Internal task -----------------------------------------------------------
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  OPEN: ['IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'],
  IN_PROGRESS: ['BLOCKED', 'DONE', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
};

export const canTransitionTask = (from: TaskStatus, to: TaskStatus) => TASK_TRANSITIONS[from].includes(to);
export const isTaskOpen = (s: TaskStatus) => s === 'OPEN' || s === 'IN_PROGRESS' || s === 'BLOCKED';
