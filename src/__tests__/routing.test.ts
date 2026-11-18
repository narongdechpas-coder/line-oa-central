// Topic routing: department → topic → PIC, customer owner priority, observer departments.
import { describe, expect, it } from 'vitest';
import { DEMO_START, SEED, cloneSeed } from '../data/seed';
import * as svc from '../services/mock';
import { DemoError } from '../services/mock';
import type { DemoState } from '../types/domain';
import { canReplyConversation, canSeeCase, canSeeConversation, canWorkOnCase, isObserverOnly } from '../utils/permissions';
import { rankPicsForCase } from '../utils/routing';
import { isEligiblePic } from '../utils/scoring';

const fresh = (actingUserId = 'usr-admin'): DemoState => ({ data: cloneSeed(), now: new Date(DEMO_START).toISOString(), seq: 0, actingUserId });
const as = (s: DemoState, id: string) => svc.switchActingUser(s, id);
const user = (s: DemoState, id: string) => s.data.users.find((u) => u.id === id)!;
const kase = (s: DemoState, id: string) => s.data.cases.find((c) => c.id === id)!;

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

describe('topic seed', () => {
  it('every case has a topic; topic PICs are eligible users of the responsible department', () => {
    for (const c of SEED.cases) expect(SEED.topics.some((t) => t.id === c.topicId), c.id).toBe(true);
    for (const t of SEED.topics) {
      expect(t.picUserIds.length, t.id).toBeGreaterThan(0);
      expect(t.observerDepartmentIds, t.id).not.toContain(t.responsibleDepartmentId);
      for (const id of t.picUserIds) {
        const u = SEED.users.find((x) => x.id === id)!;
        expect(isEligiblePic(u) && u.departmentId === t.responsibleDepartmentId, `${t.id}/${id}`).toBe(true);
      }
    }
  });
});

describe('create case by topic', () => {
  it('same-department topic: chosen PIC from the topic list is assigned directly (even by a PIC agent)', () => {
    // conv-034 (Claims OA, handled by nobody) — created by a PIC agent? PIC sees only assigned convs, so use Supervisor.
    const r = svc.createCaseFromConversation(fresh('usr-sup-claims'), 'conv-034', { title: 'ชนเสา', topicId: 'tp-motor-claim', priority: 'NORMAL', picUserId: 'usr-pic-2' });
    expect(kase(r.state, r.caseId)).toMatchObject({ status: 'ASSIGNED', currentOwnerId: 'usr-pic-2', currentDepartmentId: 'dep-claims', topicId: 'tp-motor-claim', category: 'Motor Claim' });
    expect(r.escalationId).toBeNull();
  });

  it('PIC must be on the topic list', () => {
    // usr-pic-5 is in Claims but not on the Motor Claim list
    expectError(() => svc.createCaseFromConversation(fresh(), 'conv-034', { title: 'x', topicId: 'tp-motor-claim', priority: 'LOW', picUserId: 'usr-pic-5' }));
  });

  it('customer owner on the topic list is ranked first (priority 1)', () => {
    // Rungnapa (cus-033, Claims OA) is owned by Phakamas (Marketing), who is on the Campaign topic list
    const s = fresh();
    const rk = rankPicsForCase(s.data, { requiredSkills: ['marketing', 'customer'], currentDepartmentId: 'dep-marketing', topicId: 'tp-campaign', originalCustomerId: 'cus-033' });
    expect(rk.fromTopic).toBe(true);
    expect(rk.ranked[0]).toMatchObject({ userId: 'usr-mkt-1', isCustomerOwner: true, recommended: true });
    expect(rk.ownerOutsideList).toBeNull();
  });

  it('owner is pinned first even when another PIC scores higher; scores are unchanged', () => {
    // Sirilak (BUSY, 60% load, 2 yrs) scores lowest on the Campaign list; make her the owner
    const s = svc.assignCustomerOwner(fresh(), 'cus-033', 'usr-mkt-3');
    const input = { requiredSkills: ['marketing', 'customer'], currentDepartmentId: 'dep-marketing', topicId: 'tp-campaign', originalCustomerId: 'cus-033' };
    const rk = rankPicsForCase(s.data, input);
    expect(rk.ranked[0]).toMatchObject({ userId: 'usr-mkt-3', isCustomerOwner: true, recommended: true });
    const best = Math.max(...rk.ranked.map((r) => r.total));
    expect(rk.ranked[0]!.total).toBeLessThan(best);
    expect(rk.ranked.filter((r) => r.recommended)).toHaveLength(1);
  });

  it('owner not on the topic list → shown separately and follows the case as OBSERVER', () => {
    const s = fresh();
    const rk = rankPicsForCase(s.data, { requiredSkills: ['claims', 'motor'], currentDepartmentId: 'dep-claims', topicId: 'tp-motor-claim', originalCustomerId: 'cus-033' });
    expect(rk.ownerOutsideList).toBe('usr-mkt-1');
    expect(rk.ranked.some((r) => r.userId === 'usr-mkt-1')).toBe(false);

    const r = svc.createCaseFromConversation(s, 'conv-033', { title: 'ชนแล้วหนี', topicId: 'tp-motor-claim', priority: 'HIGH', picUserId: 'usr-pic-1' });
    const obs = r.state.data.assignments.filter((a) => a.caseId === r.caseId && a.assignmentType === 'OBSERVER');
    expect(obs.map((a) => a.userId)).toEqual(['usr-mkt-1']);
    const c = kase(r.state, r.caseId);
    const owner = user(r.state, 'usr-mkt-1');
    expect(canSeeCase(r.state.data, owner, c)).toBe(true);
    expect(isObserverOnly(r.state.data, owner, c)).toBe(true);
    expect(canWorkOnCase(r.state.data, owner, c, 'case.update')).toBe(false);
  });

  it('other-department topic: case starts at the OA department and escalates automatically', () => {
    let s = fresh('usr-sup-claims');
    expectError(() => svc.createCaseFromConversation(s, 'conv-033', { title: 'สอบถามโปรโมชัน', topicId: 'tp-campaign', priority: 'NORMAL' })); // reason required
    const r = svc.createCaseFromConversation(s, 'conv-033', { title: 'สอบถามโปรโมชัน', topicId: 'tp-campaign', priority: 'NORMAL', picUserId: 'usr-mkt-1', escalationReason: 'ลูกค้าถามโปรโมชันต่ออายุ' });
    s = r.state;
    const c = kase(s, r.caseId);
    expect(c).toMatchObject({ status: 'ESCALATED', currentDepartmentId: 'dep-claims', originalChannelId: 'ch-claims' });
    const e = s.data.escalations.find((x) => x.id === r.escalationId)!;
    expect(e).toMatchObject({ status: 'REQUESTED', fromDepartmentId: 'dep-claims', toDepartmentId: 'dep-marketing', requestedOwnerId: 'usr-mkt-1' });
    expect(e.reason).toContain('Campaign Inquiry');

    // Marketing manager accepts → Marketing owns the case, requested PIC takes it; channel never moves
    s = svc.transitionEscalation(as(s, 'usr-mgr-mkt'), e.id, 'ACCEPT');
    expect(kase(s, c.id)).toMatchObject({ currentDepartmentId: 'dep-marketing', currentOwnerId: 'usr-mkt-1', originalChannelId: 'ch-claims' });
    // In Marketing the topic list applies again for reassignment
    expect(rankPicsForCase(s.data, kase(s, c.id)).fromTopic).toBe(true);
  });

  it('inactive or unknown topic is rejected', () => {
    const s = svc.setTopicActive(fresh(), 'tp-general', false);
    expectError(() => svc.createCaseFromConversation(s, 'conv-034', { title: 'x', topicId: 'tp-general', priority: 'LOW' }));
    expectError(() => svc.createCaseFromConversation(fresh(), 'conv-034', { title: 'x', topicId: 'nope', priority: 'LOW' }));
  });

  it('after escalation to a department that does not own the topic, all eligible PICs there are candidates', () => {
    let s = svc.createEscalation(fresh(), 'case-0001', { toDepartmentId: 'dep-legal', reason: 'ตรวจข้อกฎหมาย' }).state;
    s = svc.transitionEscalation(as(s, 'usr-mgr-legal'), s.data.escalations.at(-1)!.id, 'ACCEPT');
    const rk = rankPicsForCase(s.data, kase(s, 'case-0001'));
    expect(rk.fromTopic).toBe(false);
    expect(rk.ranked.map((r) => r.userId).sort()).toEqual(['usr-legal', 'usr-legal-2']);
  });
});

describe('observer departments (log only)', () => {
  it('Marketing sees Repair Coordination cases but cannot act or reply', () => {
    const s = fresh('usr-mgr-mkt');
    const mgr = user(s, 'usr-mgr-mkt');
    const c = kase(s, 'case-0003'); // Repair Coordination, observer: Marketing
    expect(canSeeCase(s.data, mgr, c)).toBe(true);
    expect(isObserverOnly(s.data, mgr, c)).toBe(true);
    expectError(() => svc.transitionCase(s, 'case-0003', 'PENDING'), 'DENIED');
    expectError(() => svc.createInternalTask(s, 'case-0003', { title: 'x', assignedDepartmentId: 'dep-marketing', dueAt: '2026-11-10T10:00:00+07:00' }), 'DENIED');
    const conv = s.data.conversations.find((v) => v.id === c.conversationId)!;
    expect(canReplyConversation(s.data, mgr, conv)).toBe(false);
    expectError(() => svc.sendSimulatedMessage(s, conv.id, { text: 'hi' }), 'DENIED');
    // a Motor Claim case (no observers) stays invisible to Marketing
    expect(canSeeCase(s.data, mgr, kase(s, 'case-0001'))).toBe(false);
  });
});

describe('topic admin', () => {
  const base = { name: 'Glass Claim', skills: ['claims', 'motor'], responsibleDepartmentId: 'dep-claims', observerDepartmentIds: ['dep-marketing'], picUserIds: ['usr-pic-2'] };

  it('Dept Admin manages topics their department receives only', () => {
    const s = fresh('usr-depadmin-claims');
    const r = svc.saveTopic(s, base);
    expect(r.state.data.topics.find((t) => t.id === r.topicId)).toMatchObject({ name: 'Glass Claim', active: true });
    expectError(() => svc.saveTopic(s, { ...base, name: 'x', responsibleDepartmentId: 'dep-service', picUserIds: ['usr-pic-3'] }), 'DENIED');
    const billing = s.data.topics.find((t) => t.id === 'tp-billing')!;
    expectError(() => svc.saveTopic(s, { ...billing }), 'DENIED');
    expectError(() => svc.saveTopic(fresh('usr-manager'), base), 'DENIED');
  });

  it('validates PICs, names and observers', () => {
    const s = fresh();
    expectError(() => svc.saveTopic(s, { ...base, picUserIds: ['usr-pic-3'] })); // other department
    expectError(() => svc.saveTopic(s, { ...base, picUserIds: ['usr-manager'] })); // managers are not PIC candidates
    expectError(() => svc.saveTopic(s, { ...base, picUserIds: [] }));
    expectError(() => svc.saveTopic(s, { ...base, name: 'motor claim' })); // duplicate (case-insensitive)
    const r = svc.saveTopic(s, { ...base, observerDepartmentIds: ['dep-claims', 'dep-marketing', 'dep-marketing'] });
    expect(r.state.data.topics.find((t) => t.id === r.topicId)?.observerDepartmentIds).toEqual(['dep-marketing']);
  });

  it('editing a topic changes routing for new cases only', () => {
    const s = fresh();
    const motor = s.data.topics.find((t) => t.id === 'tp-motor-claim')!;
    const s2 = svc.saveTopic(s, { ...motor, picUserIds: ['usr-pic-4'] }).state;
    expect(kase(s2, 'case-0001').currentOwnerId).toBe('usr-pic-1'); // unchanged
    expectError(() => svc.createCaseFromConversation(s2, 'conv-034', { title: 'x', topicId: 'tp-motor-claim', priority: 'LOW', picUserId: 'usr-pic-1' }));
  });
});

describe('customer owner inbox visibility (purpose limitation)', () => {
  it('owner sees metadata of an unassigned chat but not the chat itself until a case gives them a role', () => {
    let s = fresh('usr-sup-claims');
    const conv = () => s.data.conversations.find((v) => v.id === 'conv-033')!;
    const owner = user(s, 'usr-mkt-1');
    expect(canSeeConversation(s.data, owner, conv())).toBe(false);
    expect(svc.ownedHiddenConversations(s.data, owner).map((v) => v.id)).toEqual(['conv-033']);
    // other users get no notice for customers they do not own
    expect(svc.ownedHiddenConversations(s.data, user(s, 'usr-mkt-2')).map((v) => v.id)).not.toContain('conv-033');
    s = svc.createCaseFromConversation(s, 'conv-033', { title: 'ชนแล้วหนี', topicId: 'tp-motor-claim', priority: 'HIGH', picUserId: 'usr-pic-1' }).state;
    expect(canSeeConversation(s.data, user(s, 'usr-mkt-1'), conv())).toBe(true); // OBSERVER via the case
    expect(svc.ownedHiddenConversations(s.data, user(s, 'usr-mkt-1'))).toEqual([]);
  });
});
