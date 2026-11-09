import { describe, expect, it } from 'vitest';
import { CASE_STATUSES, ESCALATION_STATUSES } from '../types/domain';
import {
  CASE_TRANSITIONS,
  allowedCaseTransitions,
  allowedEscalationActions,
  canTransitionCase,
  canTransitionTask,
} from '../utils/transitions';

const ctx = { hasActiveEscalation: false, hasOwner: true };

describe('case lifecycle', () => {
  it('defines transitions for every status', () => {
    for (const s of CASE_STATUSES) expect(CASE_TRANSITIONS[s]).toBeDefined();
  });

  it('follows the main path', () => {
    expect(canTransitionCase('ASSIGNED', 'IN_PROGRESS', ctx)).toBe(true);
    expect(canTransitionCase('IN_PROGRESS', 'RESOLVED', ctx)).toBe(true);
    expect(canTransitionCase('RESOLVED', 'CLOSED', ctx)).toBe(true);
    expect(canTransitionCase('CLOSED', 'REOPENED', ctx)).toBe(true);
  });

  it('rejects invalid jumps', () => {
    expect(canTransitionCase('NEW', 'RESOLVED', ctx)).toBe(false);
    expect(canTransitionCase('CLOSED', 'IN_PROGRESS', ctx)).toBe(false);
    expect(canTransitionCase('IN_PROGRESS', 'ESCALATED', ctx)).toBe(false); // system-driven only
    expect(canTransitionCase('NEW', 'ASSIGNED', ctx)).toBe(false); // via Assign PIC only
  });

  it('blocks manual changes during an active escalation', () => {
    expect(allowedCaseTransitions('ESCALATED', { ...ctx, hasActiveEscalation: true })).toEqual([]);
    expect(allowedCaseTransitions('IN_PROGRESS', { ...ctx, hasActiveEscalation: true })).toEqual([]);
  });

  it('needs an owner to work or resolve', () => {
    expect(allowedCaseTransitions('REOPENED', { ...ctx, hasOwner: false })).toEqual([]);
  });
});

describe('escalation lifecycle', () => {
  it('REQUESTED can be reviewed, accepted, rejected or cancelled', () => {
    expect(allowedEscalationActions('REQUESTED').sort()).toEqual(['ACCEPT', 'CANCEL', 'REJECT', 'REVIEW']);
  });
  it('follows ACCEPTED → IN_PROGRESS → RESOLVED', () => {
    expect(allowedEscalationActions('ACCEPTED')).toContain('START');
    expect(allowedEscalationActions('IN_PROGRESS')).toContain('RESOLVE');
  });
  it('terminal states have no actions', () => {
    for (const s of ESCALATION_STATUSES.filter((x) => ['RESOLVED', 'REJECTED', 'CANCELLED'].includes(x))) {
      expect(allowedEscalationActions(s)).toEqual([]);
    }
  });
});

describe('task lifecycle', () => {
  it('OPEN → IN_PROGRESS → DONE, DONE is terminal', () => {
    expect(canTransitionTask('OPEN', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionTask('IN_PROGRESS', 'DONE')).toBe(true);
    expect(canTransitionTask('DONE', 'IN_PROGRESS')).toBe(false);
    expect(canTransitionTask('BLOCKED', 'DONE')).toBe(false);
  });
});
