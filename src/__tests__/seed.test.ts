import { describe, expect, it } from 'vitest';
import { SEED } from '../data/seed';
import { computeSla } from '../utils/sla';
import { DEMO_START } from '../data/seed';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('seed integrity', () => {
  it('keeps every original ID from the handover seed.json', () => {
    expect(ids(SEED.users)).toEqual(expect.arrayContaining(['usr-admin', 'usr-manager', 'usr-sup-claims', 'usr-pic-1', 'usr-pic-2', 'usr-pic-3', 'usr-legal', 'usr-auditor']));
    expect(ids(SEED.cases)).toEqual(expect.arrayContaining(['case-0001', 'case-0002', 'case-0003']));
    expect(ids(SEED.messages)).toEqual(expect.arrayContaining(['msg-001', 'msg-002', 'msg-003', 'msg-004', 'msg-005']));
    expect(ids(SEED.assignments)).toEqual(expect.arrayContaining(['as-001', 'as-002', 'as-003']));
    expect(ids(SEED.escalations)).toContain('esc-001');
    expect(ids(SEED.tasks)).toContain('task-001');
    expect(ids(SEED.timeline)).toEqual(expect.arrayContaining(['tl-001', 'tl-002', 'tl-003']));
  });

  it('has unique IDs in every collection', () => {
    for (const [name, list] of Object.entries(SEED)) {
      if (!Array.isArray(list)) continue;
      const all = ids(list as { id: string }[]);
      expect(new Set(all).size, name).toBe(all.length);
    }
  });

  it('every reference resolves', () => {
    const has = (xs: { id: string }[], id: string | null | undefined) => id == null || xs.some((x) => x.id === id);
    for (const c of SEED.conversations) {
      const cus = SEED.customers.find((x) => x.id === c.customerId);
      expect(cus?.channelId, c.id).toBe(c.channelId); // customer belongs to the same channel
      expect(has(SEED.users, c.assignedUserId)).toBe(true);
    }
    for (const c of SEED.cases) {
      const conv = SEED.conversations.find((x) => x.id === c.conversationId);
      expect(conv?.channelId, c.id).toBe(c.originalChannelId);
      expect(conv?.customerId, c.id).toBe(c.originalCustomerId);
      expect(has(SEED.departments, c.currentDepartmentId) && has(SEED.teams, c.currentTeamId) && has(SEED.users, c.currentOwnerId)).toBe(true);
    }
    for (const m of SEED.messages) expect(has(SEED.conversations, m.conversationId)).toBe(true);
    for (const t of SEED.tasks) expect(has(SEED.cases, t.caseId) && has(SEED.escalations, t.escalationId) && has(SEED.users, t.assignedUserId)).toBe(true);
    for (const e of SEED.escalations) expect(has(SEED.cases, e.caseId)).toBe(true);
    for (const cm of SEED.comments) expect(has(SEED.tasks, cm.taskId)).toBe(true);
  });

  it('at most one active PRIMARY_PIC per case, matching currentOwnerId', () => {
    for (const c of SEED.cases) {
      const active = SEED.assignments.filter((a) => a.caseId === c.id && a.isActive && a.assignmentType === 'PRIMARY_PIC');
      expect(active.length, c.id).toBeLessThanOrEqual(1);
      expect(active[0]?.userId ?? null, c.id).toBe(c.currentOwnerId);
    }
  });

  it('identity is (channel, lineUserId): no merge across OAs', () => {
    const keys = SEED.customers.map((c) => `${c.channelId}|${c.lineUserId}`);
    expect(new Set(keys).size).toBe(keys.length);
    const malis = SEED.customers.filter((c) => c.displayName === 'Mali Customer');
    expect(new Set(malis.map((m) => m.channelId)).size).toBe(2);
  });

  it('derived SLA matches the original seed slaState for the original cases', () => {
    const expected: Record<string, string> = { 'case-0001': 'AT_RISK', 'case-0002': 'ON_TRACK', 'case-0003': 'BREACHED' };
    for (const [id, state] of Object.entries(expected)) {
      const c = SEED.cases.find((x) => x.id === id)!;
      expect(computeSla(c, DEMO_START).state, id).toBe(state);
    }
  });

  it('every SLA state appears so the dashboard has something to show', () => {
    const states = new Set(SEED.cases.map((c) => computeSla(c, DEMO_START).state));
    expect([...states].sort()).toEqual(['AT_RISK', 'BREACHED', 'ON_TRACK', 'PAUSED']);
  });

  it('has Claims OA conversations without a case for the acceptance scenario', () => {
    const free = SEED.conversations.filter((c) => c.channelId === 'ch-claims' && !SEED.cases.some((k) => k.conversationId === c.id));
    expect(free.length).toBeGreaterThan(0);
  });
});
