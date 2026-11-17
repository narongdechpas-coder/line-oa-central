// Service-level run of the acceptance scenario (docs/handover/05_technical/06_ACCEPTANCE_TESTS.md)
// plus role and integrity tests. UI-level checks come in a later step.
import { describe, expect, it } from 'vitest';
import { DEMO_START, cloneSeed } from '../data/seed';
import * as svc from '../services/mock/operations';
import { DemoError } from '../services/mock/operations';
import { listConversations, messagesOf } from '../services/mock/queries';
import type { DemoState } from '../types/domain';

const fresh = (actingUserId = 'usr-admin'): DemoState => ({
  data: cloneSeed(),
  now: new Date(DEMO_START).toISOString(),
  seq: 0,
  actingUserId,
});
const as = (s: DemoState, userId: string): DemoState => svc.switchActingUser(s, userId);
const caseOf = (s: DemoState, id: string) => s.data.cases.find((c) => c.id === id)!;

function expectError(fn: () => unknown, kind?: DemoError['kind']) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DemoError);
    if (kind) expect((e as DemoError).kind).toBe(kind);
    return;
  }
  throw new Error('expected DemoError');
}

describe('end-to-end scenario (service level)', () => {
  it('conversation → case → PIC → escalation → task → reply → close, channel never changes', () => {
    let s = fresh();

    // 2–3. Claims OA, pick a conversation without a case
    const admin = s.data.users.find((u) => u.id === 'usr-admin')!;
    const claims = listConversations(s.data, admin, { channelId: 'ch-claims' });
    expect(claims.every((c) => c.channelId === 'ch-claims')).toBe(true);
    const conv = claims.find((c) => !s.data.cases.some((k) => k.conversationId === c.id))!;
    expect(conv).toBeDefined();

    // 4–5. Create case; origin copied from conversation
    s = as(s, 'usr-sup-claims');
    const created = svc.createCaseFromConversation(s, conv.id, { title: 'รถถูกชนแล้วหนี', category: 'Motor Claim', priority: 'HIGH' });
    s = created.state;
    const id = created.caseId;
    expect(caseOf(s, id)).toMatchObject({ status: 'NEW', originalChannelId: 'ch-claims', originalCustomerId: conv.customerId, currentDepartmentId: 'dep-claims' });
    expect(id).toBe('case-0026');

    // 6–7. Recommend + assign PIC
    const ranked = svc.recommendPic(s, id);
    const top = ranked[0]!;
    s = svc.assignPic(s, id, top.userId);
    expect(caseOf(s, id)).toMatchObject({ status: 'ASSIGNED', currentOwnerId: top.userId });
    // override to the second candidate: history kept, one active PRIMARY_PIC
    const second = ranked[1]!;
    s = svc.assignPic(s, id, second.userId, 'ลูกค้าเคยคุยกับคนนี้');
    const hist = s.data.assignments.filter((a) => a.caseId === id);
    expect(hist).toHaveLength(2);
    expect(hist.filter((a) => a.isActive)).toHaveLength(1);
    expect(hist.find((a) => a.isActive)?.userId).toBe(second.userId);

    s = svc.transitionCase(s, id, 'IN_PROGRESS');

    // 8. Escalate to Legal
    const esc = svc.createEscalation(s, id, { toDepartmentId: 'dep-legal', reason: 'ต้องตรวจความรับผิด', requestedOwnerId: 'usr-legal-2' });
    s = esc.state;
    expect(caseOf(s, id).status).toBe('ESCALATED');

    // PIC of the source department cannot accept
    expectError(() => svc.transitionEscalation(as(s, second.userId), esc.escalationId, 'ACCEPT'), 'DENIED');
    // Claims manager cannot accept an escalation sent to Legal
    expectError(() => svc.transitionEscalation(as(s, 'usr-manager'), esc.escalationId, 'ACCEPT'), 'DENIED');

    // 9. Accept with the Legal Manager role
    s = as(s, 'usr-mgr-legal');
    s = svc.transitionEscalation(s, esc.escalationId, 'ACCEPT');
    expect(caseOf(s, id)).toMatchObject({ currentDepartmentId: 'dep-legal', currentOwnerId: 'usr-legal-2' });
    s = svc.transitionEscalation(s, esc.escalationId, 'START');

    // 10–11. Task for the target team, comment, complete
    const tk = svc.createInternalTask(s, id, {
      title: 'ตรวจเงื่อนไข',
      assignedDepartmentId: 'dep-legal',
      assignedUserId: 'usr-legal-2',
      dueAt: '2026-11-10T17:00:00+07:00',
      escalationId: esc.escalationId,
    });
    s = tk.state;
    // cannot resolve while the task is open
    expectError(() => svc.transitionEscalation(s, esc.escalationId, 'RESOLVE'));
    s = svc.addInternalComment(s, tk.taskId, 'บันทึกภายใน ห้ามโชว์ลูกค้า');
    s = svc.updateInternalTask(s, tk.taskId, { status: 'IN_PROGRESS' });
    s = svc.updateInternalTask(s, tk.taskId, { status: 'DONE' });

    // 12. Resolve escalation → ownership returns, status back to IN_PROGRESS
    s = svc.transitionEscalation(s, esc.escalationId, 'RESOLVE');
    expect(caseOf(s, id)).toMatchObject({ status: 'IN_PROGRESS', currentDepartmentId: 'dep-claims', currentOwnerId: second.userId });

    // 13. Original channel unchanged everywhere
    expect(caseOf(s, id)).toMatchObject({ originalChannelId: 'ch-claims', originalCustomerId: conv.customerId });
    expect(s.data.conversations.find((c) => c.id === conv.id)?.channelId).toBe('ch-claims');

    // 14. Simulated reply (by the case owner)
    s = as(s, second.userId);
    s = svc.sendSimulatedMessage(s, conv.id, { text: 'ดำเนินการให้แล้วครับ' });
    const msgs = messagesOf(s.data, conv.id);
    const last = msgs[msgs.length - 1]!;
    expect(last).toMatchObject({ direction: 'OUTBOUND', simulated: true, text: 'ดำเนินการให้แล้วครับ' });
    // internal comment never in the customer thread
    expect(msgs.some((m) => m.text.includes('บันทึกภายใน'))).toBe(false);

    // 15. Resolve and close
    s = svc.transitionCase(s, id, 'RESOLVED');
    s = svc.transitionCase(s, id, 'CLOSED');
    expect(caseOf(s, id)).toMatchObject({ status: 'CLOSED' });
    expect(s.data.conversations.find((c) => c.id === conv.id)?.status).toBe('CLOSED');

    // timeline captured the important changes, in order
    const types = s.data.timeline.filter((t) => t.caseId === id).map((t) => t.type);
    expect(types).toEqual(expect.arrayContaining(['CASE_CREATED', 'ASSIGNED', 'REASSIGNED', 'ESCALATED', 'ESCALATION_UPDATED', 'TASK_CREATED', 'TASK_COMMENTED', 'TASK_UPDATED', 'REPLY_SIMULATED', 'STATUS_CHANGED']));
    const times = s.data.timeline.filter((t) => t.caseId === id).map((t) => Date.parse(t.createdAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe('roles', () => {
  it('Auditor cannot mutate anything', () => {
    const s = fresh('usr-auditor');
    expectError(() => svc.createCaseFromConversation(s, 'conv-033', { title: 'x', category: 'Motor Claim', priority: 'LOW' }), 'DENIED');
    expectError(() => svc.assignPic(s, 'case-0004', 'usr-pic-1'), 'DENIED');
    expectError(() => svc.transitionCase(s, 'case-0001', 'PENDING'), 'DENIED');
    expectError(() => svc.transitionEscalation(s, 'esc-002', 'ACCEPT'), 'DENIED');
    expectError(() => svc.updateInternalTask(s, 'task-001', { status: 'DONE' }), 'DENIED');
    expectError(() => svc.addInternalComment(s, 'task-001', 'x'), 'DENIED');
    expectError(() => svc.sendSimulatedMessage(s, 'conv-001', { text: 'x' }), 'DENIED');
  });

  it('PIC cannot assign PIC; Manager/Supervisor can', () => {
    expectError(() => svc.assignPic(fresh('usr-pic-1'), 'case-0004', 'usr-pic-1'), 'DENIED');
    expect(() => svc.assignPic(fresh('usr-manager'), 'case-0004', 'usr-pic-1')).not.toThrow();
    expect(() => svc.assignPic(fresh('usr-sup-claims'), 'case-0004', 'usr-pic-1')).not.toThrow();
  });

  it('PIC sees only assigned work', () => {
    const s = fresh('usr-pic-3');
    const me = s.data.users.find((u) => u.id === 'usr-pic-3')!;
    const convs = listConversations(s.data, me);
    expect(convs.length).toBeGreaterThan(0);
    expect(convs.length).toBeLessThan(s.data.conversations.length);
  });

  it('cannot assign a PIC from another department (that is what escalation is for)', () => {
    expectError(() => svc.assignPic(fresh(), 'case-0004', 'usr-pic-3'));
  });
});

describe('integrity', () => {
  it('escalation never changes conversation.channelId or case origin', () => {
    let s = fresh();
    const before = structuredClone(s.data.conversations);
    s = svc.createEscalation(s, 'case-0001', { toDepartmentId: 'dep-underwriting', reason: 'ทดสอบ' }).state;
    s = svc.transitionEscalation(s, s.data.escalations.at(-1)!.id, 'ACCEPT');
    expect(s.data.conversations.map((c) => c.channelId)).toEqual(before.map((c) => c.channelId));
    expect(caseOf(s, 'case-0001')).toMatchObject({ originalChannelId: 'ch-claims', originalCustomerId: 'cus-001' });
  });

  it('only one active escalation per case', () => {
    const s = svc.createEscalation(fresh(), 'case-0001', { toDepartmentId: 'dep-legal', reason: 'a' }).state;
    expectError(() => svc.createEscalation(s, 'case-0001', { toDepartmentId: 'dep-underwriting', reason: 'b' }));
  });

  it('reject requires a reason and returns the case to its previous status', () => {
    let s = fresh();
    s = svc.createEscalation(s, 'case-0001', { toDepartmentId: 'dep-legal', reason: 'a' }).state;
    const escId = s.data.escalations.at(-1)!.id;
    s = as(s, 'usr-mgr-legal');
    expectError(() => svc.transitionEscalation(s, escId, 'REJECT'));
    s = svc.transitionEscalation(s, escId, 'REJECT', 'ไม่ใช่เรื่องกฎหมาย');
    expect(caseOf(s, 'case-0001')).toMatchObject({ status: 'IN_PROGRESS', currentDepartmentId: 'dep-claims', currentOwnerId: 'usr-pic-1' });
  });

  it('PENDING pauses SLA and resuming extends the due time', () => {
    let s = fresh();
    const due0 = Date.parse(caseOf(s, 'case-0001').dueAt);
    s = svc.transitionCase(s, 'case-0001', 'PENDING');
    expect(caseOf(s, 'case-0001').slaPausedAt).toBeTruthy();
    s = svc.advanceDemoTime(s, 60);
    s = svc.transitionCase(s, 'case-0001', 'IN_PROGRESS');
    const c = caseOf(s, 'case-0001');
    expect(c.slaPausedAt).toBeNull();
    expect(Date.parse(c.dueAt) - due0).toBe(61 * 60_000); // 60 min advance + 1 min clock step
  });

  it('operations never mutate the input state', () => {
    const s = fresh();
    const snapshot = JSON.stringify(s);
    svc.assignPic(s, 'case-0004', 'usr-pic-1');
    svc.sendSimulatedMessage(s, 'conv-001', { text: 'hi' });
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('validates required fields', () => {
    const s = fresh();
    expectError(() => svc.createCaseFromConversation(s, 'conv-033', { title: '  ', category: 'Motor Claim', priority: 'LOW' }));
    expectError(() => svc.createEscalation(s, 'case-0001', { toDepartmentId: 'dep-legal', reason: '' }));
    expectError(() => svc.createEscalation(s, 'case-0001', { toDepartmentId: 'dep-claims', reason: 'same dept' }));
    expectError(() => svc.sendSimulatedMessage(s, 'conv-001', { text: '' }));
  });
});
