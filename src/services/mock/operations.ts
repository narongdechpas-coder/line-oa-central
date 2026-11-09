// Mock service boundary. Every function takes the current DemoState and returns a NEW state.
// Nothing here makes a network request — there is no LINE API, webhook or backend.
// A real implementation would replace these with API calls of the same names
// (see docs/handover/07_reference/api/openapi.yaml).

import type {
  AuditEvent,
  Case,
  CaseStatus,
  DemoState,
  DemoUser,
  Escalation,
  InternalTask,
  Priority,
  TaskStatus,
  TimelineEvent,
} from '../../types/domain';
import { skillsForCategory } from '../../utils/categories';
import {
  can,
  canCancelEscalation,
  canDecideEscalation,
  canSeeConversation,
  canUpdateTask,
  canWorkEscalation,
  canWorkOnCase,
} from '../../utils/permissions';
import { recommendPics } from '../../utils/scoring';
import { dueAtFor, resumeDueAt } from '../../utils/sla';
import { addMinutes } from '../../utils/time';
import {
  ASSIGNABLE_CASE_STATUSES,
  ESCALATABLE_CASE_STATUSES,
  ESCALATION_ACTIONS,
  type EscalationAction,
  canTransitionCase,
  canTransitionTask,
  isCaseOpen,
  isEscalationActive,
  isTaskOpen,
} from '../../utils/transitions';

/** Thrown for validation failures and permission denials. `message` is user-facing Thai. */
export class DemoError extends Error {
  constructor(
    message: string,
    public readonly kind: 'VALIDATION' | 'DENIED' | 'NOT_FOUND' = 'VALIDATION',
  ) {
    super(message);
    this.name = 'DemoError';
  }
}

/** How far each mutation moves the demo clock, so timeline order stays stable. */
export const CLOCK_STEP_MINUTES = 1;

// ---- internal helpers ---------------------------------------------------------

type Draft = DemoState;

function begin(state: DemoState): Draft {
  const d = structuredClone(state);
  d.now = addMinutes(d.now, CLOCK_STEP_MINUTES);
  return d;
}

function nextId(d: Draft, prefix: string): string {
  d.seq += 1;
  return `${prefix}-d${String(d.seq).padStart(4, '0')}`;
}

function actor(d: Draft): DemoUser {
  const u = d.data.users.find((x) => x.id === d.actingUserId);
  if (!u) throw new DemoError('ไม่พบผู้ใช้เดโม่ที่เลือกอยู่', 'NOT_FOUND');
  return u;
}

function deny(message = 'บทบาทเดโม่นี้ไม่มีสิทธิ์ทำรายการนี้'): never {
  throw new DemoError(message, 'DENIED');
}

function findCase(d: Draft, id: string): Case {
  const c = d.data.cases.find((x) => x.id === id);
  if (!c) throw new DemoError(`ไม่พบ Case ${id}`, 'NOT_FOUND');
  return c;
}

function findEscalation(d: Draft, id: string): Escalation {
  const e = d.data.escalations.find((x) => x.id === id);
  if (!e) throw new DemoError(`ไม่พบ Escalation ${id}`, 'NOT_FOUND');
  return e;
}

function findTask(d: Draft, id: string): InternalTask {
  const t = d.data.tasks.find((x) => x.id === id);
  if (!t) throw new DemoError(`ไม่พบงานภายใน ${id}`, 'NOT_FOUND');
  return t;
}

const nameOf = (d: Draft, userId: string | null | undefined) =>
  d.data.users.find((u) => u.id === userId)?.name ?? '—';
const depNameOf = (d: Draft, depId: string) => d.data.departments.find((x) => x.id === depId)?.name ?? depId;

function timeline(d: Draft, caseId: string, type: TimelineEvent['type'], label: string) {
  d.data.timeline.push({ id: nextId(d, 'tl'), caseId, type, label, actorId: d.actingUserId, createdAt: d.now });
}

function audit(d: Draft, action: string, resourceType: AuditEvent['resourceType'], resourceId: string) {
  d.data.audit.push({
    id: nextId(d, 'au'),
    actorId: d.actingUserId,
    action,
    resourceType,
    resourceId,
    outcome: 'SUCCESS',
    createdAt: d.now,
  });
}

const firstTeamOf = (d: Draft, depId: string) => d.data.teams.find((t) => t.departmentId === depId)?.id ?? null;

/** Ends the active PRIMARY_PIC (if any) and makes `userId` the new one. Keeps history. */
function setPrimaryPic(d: Draft, c: Case, userId: string, reason: string | null, score: number | null) {
  const prev = d.data.assignments.find((a) => a.caseId === c.id && a.assignmentType === 'PRIMARY_PIC' && a.isActive);
  if (prev?.userId === userId) return false;
  if (prev) {
    prev.isActive = false;
    prev.unassignedAt = d.now;
    const prevUser = d.data.users.find((u) => u.id === prev.userId);
    if (prevUser) prevUser.workload = Math.max(0, prevUser.workload - 5);
  }
  d.data.assignments.push({
    id: nextId(d, 'as'),
    caseId: c.id,
    userId,
    assignmentType: 'PRIMARY_PIC',
    isActive: true,
    assignedAt: d.now,
    assignedBy: d.actingUserId,
    reason,
    recommendationScore: score,
  });
  const newUser = d.data.users.find((u) => u.id === userId);
  if (newUser) newUser.workload = Math.min(100, newUser.workload + 5);
  c.currentOwnerId = userId;
  const conv = d.data.conversations.find((x) => x.id === c.conversationId);
  if (conv) conv.assignedUserId = userId;
  timeline(d, c.id, prev ? 'REASSIGNED' : 'ASSIGNED', `${prev ? 'เปลี่ยน' : 'มอบหมาย'} PIC: ${nameOf(d, userId)}${reason ? ` — ${reason}` : ''}`);
  return true;
}

function applyCaseStatus(d: Draft, c: Case, next: CaseStatus, label?: string) {
  const prev = c.status;
  if (prev === next) return;
  // SLA pause / resume around PENDING
  if (next === 'PENDING' && !c.slaPausedAt) c.slaPausedAt = d.now;
  if (prev === 'PENDING' && next !== 'PENDING' && c.slaPausedAt) {
    c.dueAt = resumeDueAt(c.dueAt, c.slaPausedAt, d.now);
    c.slaPausedAt = null;
  }
  if (next === 'RESOLVED') c.resolvedAt = d.now;
  if (next === 'CLOSED') {
    c.closedAt = d.now;
    if (!c.resolvedAt) c.resolvedAt = d.now;
  }
  if (next === 'REOPENED') {
    c.resolvedAt = null;
    c.closedAt = null;
    c.slaPausedAt = null;
    c.dueAt = dueAtFor(c.priority, d.now);
  }
  c.status = next;
  // Keep the conversation status in step with its cases.
  const conv = d.data.conversations.find((x) => x.id === c.conversationId);
  if (conv) {
    const anyOpen = d.data.cases.some((x) => x.conversationId === conv.id && isCaseOpen(x.status));
    conv.status = anyOpen ? (next === 'PENDING' ? 'PENDING' : 'OPEN') : 'CLOSED';
  }
  timeline(d, c.id, 'STATUS_CHANGED', label ?? `เปลี่ยนสถานะ ${prev} → ${next}`);
}

// ---- Conversations ------------------------------------------------------------

export function markConversationRead(state: DemoState, conversationId: string): DemoState {
  const conv = state.data.conversations.find((x) => x.id === conversationId);
  if (!conv || conv.unread === 0) return state;
  // Reading does not advance the demo clock and is not audited.
  const d = structuredClone(state);
  const c = d.data.conversations.find((x) => x.id === conversationId);
  if (c) c.unread = 0;
  return d;
}

/** Adds an OUTBOUND message to local state only. Always on the conversation's own channel. NOT SENT TO LINE. */
export function sendSimulatedMessage(state: DemoState, conversationId: string, payload: { text: string }): DemoState {
  const d = begin(state);
  const me = actor(d);
  const conv = d.data.conversations.find((x) => x.id === conversationId);
  if (!conv) throw new DemoError('ไม่พบบทสนทนา', 'NOT_FOUND');
  if (!can(me, 'conversation.reply') || !canSeeConversation(d.data, me, conv)) deny();
  if (me.role === 'PIC_AGENT' && conv.assignedUserId !== me.id) deny('PIC ตอบได้เฉพาะบทสนทนาที่ได้รับมอบหมาย');
  const text = payload.text.trim();
  if (!text) throw new DemoError('กรุณาพิมพ์ข้อความ');
  if (text.length > 1000) throw new DemoError('ข้อความยาวเกิน 1,000 ตัวอักษร');
  d.data.messages.push({
    id: nextId(d, 'msg'),
    conversationId: conv.id,
    direction: 'OUTBOUND',
    text,
    createdAt: d.now,
    simulated: true,
    sentByUserId: me.id,
  });
  conv.lastMessageAt = d.now;
  for (const c of d.data.cases.filter((x) => x.conversationId === conv.id && isCaseOpen(x.status))) {
    timeline(d, c.id, 'REPLY_SIMULATED', 'ตอบลูกค้า (SIMULATED — NOT SENT TO LINE)');
  }
  audit(d, 'message.simulate_send', 'CONVERSATION', conv.id);
  return d;
}

// ---- Cases ----------------------------------------------------------------------

export interface CreateCasePayload {
  title: string;
  category: string;
  priority: Priority;
  description?: string;
}

/** Creates a case; origin channel and customer are COPIED from the conversation and never editable. */
export function createCaseFromConversation(
  state: DemoState,
  conversationId: string,
  payload: CreateCasePayload,
): { state: DemoState; caseId: string } {
  const d = begin(state);
  const me = actor(d);
  const conv = d.data.conversations.find((x) => x.id === conversationId);
  if (!conv) throw new DemoError('ไม่พบบทสนทนา', 'NOT_FOUND');
  if (!can(me, 'case.create') || !canSeeConversation(d.data, me, conv)) deny();
  const title = payload.title.trim();
  if (!title) throw new DemoError('กรุณาระบุหัวข้อ Case');
  if (!payload.category) throw new DemoError('กรุณาเลือกประเภท Case');
  const channel = d.data.channels.find((x) => x.id === conv.channelId);
  if (!channel) throw new DemoError('ไม่พบ LINE OA ของบทสนทนา', 'NOT_FOUND');

  const maxN = d.data.cases.reduce((m, c) => Math.max(m, Number(c.caseNumber.slice(-4)) || 0), 0);
  const n = String(maxN + 1).padStart(4, '0');
  const c: Case = {
    id: `case-${n}`,
    caseNumber: `JC-2026-${n}`,
    conversationId: conv.id,
    originalChannelId: conv.channelId,
    originalCustomerId: conv.customerId,
    title,
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
    category: payload.category,
    requiredSkills: skillsForCategory(payload.category),
    priority: payload.priority,
    status: 'NEW',
    statusBeforeEscalation: null,
    currentDepartmentId: channel.departmentId,
    currentTeamId: firstTeamOf(d, channel.departmentId),
    currentOwnerId: null,
    dueAt: dueAtFor(payload.priority, d.now),
    slaPausedAt: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: d.now,
  };
  d.data.cases.push(c);
  if (conv.status === 'CLOSED') conv.status = 'OPEN';
  timeline(d, c.id, 'CASE_CREATED', `สร้าง Case จาก ${channel.name}`);
  audit(d, 'case.create', 'CASE', c.id);
  return { state: d, caseId: c.id };
}

export function transitionCase(state: DemoState, caseId: string, next: CaseStatus): DemoState {
  const d = begin(state);
  const me = actor(d);
  const c = findCase(d, caseId);
  if (!canWorkOnCase(d.data, me, c, 'case.update')) deny();
  const hasActiveEscalation = d.data.escalations.some((e) => e.caseId === c.id && isEscalationActive(e.status));
  if (!canTransitionCase(c.status, next, { hasActiveEscalation, hasOwner: !!c.currentOwnerId })) {
    throw new DemoError(
      hasActiveEscalation
        ? 'Case นี้มี Escalation ที่ยังไม่จบ ต้องปิด Escalation ก่อนเปลี่ยนสถานะ'
        : `เปลี่ยนสถานะจาก ${c.status} เป็น ${next} ไม่ได้`,
    );
  }
  applyCaseStatus(d, c, next);
  audit(d, `case.status.${next}`, 'CASE', c.id);
  return d;
}

export function changeCasePriority(state: DemoState, caseId: string, priority: Priority): DemoState {
  const d = begin(state);
  const me = actor(d);
  const c = findCase(d, caseId);
  if (!canWorkOnCase(d.data, me, c, 'case.update')) deny();
  if (!isCaseOpen(c.status)) throw new DemoError('เปลี่ยนความสำคัญได้เฉพาะ Case ที่ยังเปิดอยู่');
  if (c.priority === priority) return state;
  const prev = c.priority;
  c.priority = priority; // dueAt is kept: SLA target is fixed at creation (demo assumption)
  timeline(d, c.id, 'PRIORITY_CHANGED', `เปลี่ยนความสำคัญ ${prev} → ${priority}`);
  audit(d, 'case.priority', 'CASE', c.id);
  return d;
}

// ---- PIC assignment ----------------------------------------------------------------

export function recommendPic(state: DemoState, caseId: string) {
  const c = state.data.cases.find((x) => x.id === caseId);
  if (!c) throw new DemoError(`ไม่พบ Case ${caseId}`, 'NOT_FOUND');
  return recommendPics(c, state.data.users);
}

export function assignPic(state: DemoState, caseId: string, userId: string, reason?: string): DemoState {
  const d = begin(state);
  const me = actor(d);
  const c = findCase(d, caseId);
  if (!canWorkOnCase(d.data, me, c, 'case.assign')) deny('เฉพาะ Manager / Supervisor ที่ดูแล Case นี้เท่านั้นที่มอบหมาย PIC ได้');
  if (!ASSIGNABLE_CASE_STATUSES.includes(c.status)) throw new DemoError(`มอบหมาย PIC ไม่ได้ขณะ Case อยู่ในสถานะ ${c.status}`);
  const ranked = recommendPics(c, d.data.users);
  const pick = ranked.find((r) => r.userId === userId);
  if (!pick) throw new DemoError('ผู้ที่เลือกไม่อยู่ในรายชื่อ PIC ที่มอบหมายได้ของแผนกนี้');
  const top = ranked[0];
  const isOverride = !!top && top.userId !== userId;
  const finalReason = reason?.trim() || (isOverride ? 'เลือกเอง (override คำแนะนำ)' : null);
  const changed = setPrimaryPic(d, c, userId, finalReason, pick.total);
  if (!changed) throw new DemoError('ผู้นี้เป็น PIC ของ Case อยู่แล้ว');
  if (c.status === 'NEW' || c.status === 'TRIAGED' || c.status === 'REOPENED') applyCaseStatus(d, c, 'ASSIGNED');
  audit(d, isOverride ? 'assignment.override' : 'assignment.recommended', 'ASSIGNMENT', c.id);
  return d;
}

// ---- Escalation --------------------------------------------------------------------

export interface CreateEscalationPayload {
  toDepartmentId: string;
  toTeamId?: string | null;
  reason: string;
  requestedOwnerId?: string | null;
}

/** Internal handoff only. Never touches originalChannelId, originalCustomerId or the conversation. */
export function createEscalation(
  state: DemoState,
  caseId: string,
  payload: CreateEscalationPayload,
): { state: DemoState; escalationId: string } {
  const d = begin(state);
  const me = actor(d);
  const c = findCase(d, caseId);
  if (!canWorkOnCase(d.data, me, c, 'escalation.request')) deny();
  if (!ESCALATABLE_CASE_STATUSES.includes(c.status)) throw new DemoError(`Escalate ไม่ได้ขณะ Case อยู่ในสถานะ ${c.status}`);
  if (d.data.escalations.some((e) => e.caseId === c.id && isEscalationActive(e.status))) {
    throw new DemoError('Case นี้มี Escalation ที่ยังไม่จบอยู่แล้ว');
  }
  const reason = payload.reason.trim();
  if (!reason) throw new DemoError('กรุณาระบุเหตุผลการส่งต่อ');
  if (!d.data.departments.some((x) => x.id === payload.toDepartmentId)) throw new DemoError('กรุณาเลือกแผนกปลายทาง');
  if (payload.toDepartmentId === c.currentDepartmentId) throw new DemoError('แผนกปลายทางต้องไม่ใช่แผนกที่ดูแล Case อยู่');
  const toTeamId = payload.toTeamId || firstTeamOf(d, payload.toDepartmentId);
  if (toTeamId && !d.data.teams.some((t) => t.id === toTeamId && t.departmentId === payload.toDepartmentId)) {
    throw new DemoError('ทีมปลายทางไม่อยู่ในแผนกที่เลือก');
  }
  if (payload.requestedOwnerId) {
    const owner = d.data.users.find((u) => u.id === payload.requestedOwnerId);
    if (!owner || owner.departmentId !== payload.toDepartmentId) throw new DemoError('ผู้รับผิดชอบที่ขอต้องอยู่ในแผนกปลายทาง');
  }
  const e: Escalation = {
    id: nextId(d, 'esc'),
    caseId: c.id,
    fromDepartmentId: c.currentDepartmentId,
    fromTeamId: c.currentTeamId,
    toDepartmentId: payload.toDepartmentId,
    toTeamId,
    requestedOwnerId: payload.requestedOwnerId || null,
    previousOwnerId: c.currentOwnerId,
    status: 'REQUESTED',
    reason,
    requestedBy: me.id,
    createdAt: d.now,
    updatedAt: d.now,
  };
  d.data.escalations.push(e);
  c.statusBeforeEscalation = c.status;
  applyCaseStatus(d, c, 'ESCALATED', `Case อยู่ระหว่าง Escalation (เดิม ${c.status})`);
  timeline(d, c.id, 'ESCALATED', `ส่งต่อภายในไปยัง ${depNameOf(d, e.toDepartmentId)} — ลูกค้ายังอยู่ที่ LINE OA เดิม`);
  audit(d, 'escalation.create', 'ESCALATION', e.id);
  return { state: d, escalationId: e.id };
}

const ESC_ACTION_LABEL: Record<EscalationAction, string> = {
  REVIEW: 'เริ่มพิจารณา Escalation',
  ACCEPT: 'รับ Escalation',
  REJECT: 'ปฏิเสธ Escalation',
  START: 'เริ่มดำเนินการ Escalation',
  RESOLVE: 'Escalation แก้ไขเสร็จ',
  CANCEL: 'ยกเลิก Escalation',
};

/** Puts ownership back where it was before the handoff and ends the ESCALATED case status. */
function returnFromEscalation(d: Draft, c: Case, e: Escalation, handedOver: boolean) {
  if (handedOver) {
    c.currentDepartmentId = e.fromDepartmentId;
    c.currentTeamId = e.fromTeamId ?? firstTeamOf(d, e.fromDepartmentId);
    if (e.previousOwnerId && c.currentOwnerId !== e.previousOwnerId) {
      setPrimaryPic(d, c, e.previousOwnerId, `กลับจาก Escalation ${depNameOf(d, e.toDepartmentId)}`, null);
    } else if (!e.previousOwnerId && c.currentOwnerId) {
      // Case had no PIC before the handoff: end the target-department PIC, keep the history.
      const active = d.data.assignments.find((a) => a.caseId === c.id && a.assignmentType === 'PRIMARY_PIC' && a.isActive);
      if (active) {
        active.isActive = false;
        active.unassignedAt = d.now;
      }
      c.currentOwnerId = null;
      timeline(d, c.id, 'REASSIGNED', 'สิ้นสุด PIC จาก Escalation — รอมอบหมาย PIC ใหม่');
    }
  }
  const back = c.statusBeforeEscalation && c.statusBeforeEscalation !== 'ESCALATED' ? c.statusBeforeEscalation : 'IN_PROGRESS';
  c.statusBeforeEscalation = null;
  applyCaseStatus(d, c, c.currentOwnerId ? back : 'TRIAGED', `Escalation จบ — Case กลับเป็น ${c.currentOwnerId ? back : 'TRIAGED'}`);
}

export function transitionEscalation(
  state: DemoState,
  escalationId: string,
  action: EscalationAction,
  note?: string,
): DemoState {
  const d = begin(state);
  const me = actor(d);
  const e = findEscalation(d, escalationId);
  const c = findCase(d, e.caseId);
  const rule = ESCALATION_ACTIONS[action];
  if (!rule.from.includes(e.status)) throw new DemoError(`ทำรายการ "${ESC_ACTION_LABEL[action]}" ไม่ได้ขณะสถานะ ${e.status}`);

  const allowed =
    action === 'CANCEL'
      ? canCancelEscalation(me, e)
      : action === 'START' || action === 'RESOLVE'
        ? canWorkEscalation(d.data, me, e)
        : canDecideEscalation(me, e);
  if (!allowed) deny(action === 'CANCEL' ? 'ยกเลิกได้เฉพาะผู้ขอหรือผู้จัดการแผนกต้นทาง' : 'เฉพาะ Manager / Supervisor ของแผนกปลายทางเท่านั้น');

  if (action === 'REJECT' && !note?.trim()) throw new DemoError('กรุณาระบุเหตุผลที่ปฏิเสธ');
  if (action === 'RESOLVE') {
    const open = d.data.tasks.filter((t) => t.escalationId === e.id && isTaskOpen(t.status));
    if (open.length) throw new DemoError(`ยังมีงานภายในของ Escalation นี้ค้างอยู่ ${open.length} งาน`);
  }

  const wasHandedOver = e.status === 'ACCEPTED' || e.status === 'IN_PROGRESS';
  e.status = rule.to;
  e.updatedAt = d.now;
  if (note?.trim()) e.decisionNote = note.trim();

  if (action === 'ACCEPT') {
    // Internal ownership moves to the target department. The customer and channel do not.
    c.currentDepartmentId = e.toDepartmentId;
    c.currentTeamId = e.toTeamId;
    if (e.requestedOwnerId) setPrimaryPic(d, c, e.requestedOwnerId, `รับงานจาก Escalation`, null);
  }
  timeline(d, c.id, 'ESCALATION_UPDATED', `${ESC_ACTION_LABEL[action]}${note?.trim() ? ` — ${note.trim()}` : ''}`);
  if (action === 'RESOLVE' || action === 'REJECT' || action === 'CANCEL') {
    returnFromEscalation(d, c, e, wasHandedOver);
  }
  audit(d, `escalation.${action.toLowerCase()}`, 'ESCALATION', e.id);
  return d;
}

// ---- Internal tasks --------------------------------------------------------------------

export interface CreateTaskPayload {
  title: string;
  description?: string;
  assignedDepartmentId: string;
  assignedTeamId?: string | null;
  assignedUserId?: string | null;
  dueAt: string;
  escalationId?: string | null;
}

export function createInternalTask(
  state: DemoState,
  caseId: string,
  payload: CreateTaskPayload,
): { state: DemoState; taskId: string } {
  const d = begin(state);
  const me = actor(d);
  const c = findCase(d, caseId);
  if (!canWorkOnCase(d.data, me, c, 'task.create')) deny();
  if (!isCaseOpen(c.status)) throw new DemoError('สร้างงานได้เฉพาะ Case ที่ยังเปิดอยู่');
  const title = payload.title.trim();
  if (!title) throw new DemoError('กรุณาระบุชื่องาน');
  if (!payload.assignedDepartmentId) throw new DemoError('กรุณาเลือกแผนกที่รับงาน');
  if (!payload.dueAt || Number.isNaN(Date.parse(payload.dueAt))) throw new DemoError('กรุณาระบุกำหนดเสร็จ');
  if (payload.assignedUserId) {
    const u = d.data.users.find((x) => x.id === payload.assignedUserId);
    if (!u || u.departmentId !== payload.assignedDepartmentId) throw new DemoError('ผู้รับงานต้องอยู่ในแผนกที่เลือก');
  }
  if (payload.escalationId) {
    const e = findEscalation(d, payload.escalationId);
    if (e.caseId !== c.id) throw new DemoError('Escalation ไม่ได้อยู่ใน Case นี้');
  }
  const task: InternalTask = {
    id: nextId(d, 'task'),
    caseId: c.id,
    escalationId: payload.escalationId ?? null,
    title,
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
    assignedDepartmentId: payload.assignedDepartmentId,
    assignedTeamId: payload.assignedTeamId || firstTeamOf(d, payload.assignedDepartmentId),
    assignedUserId: payload.assignedUserId || null,
    status: 'OPEN',
    dueAt: new Date(payload.dueAt).toISOString(),
    createdAt: d.now,
    createdBy: me.id,
  };
  d.data.tasks.push(task);
  timeline(d, c.id, 'TASK_CREATED', `สร้างงานภายใน: ${title} → ${depNameOf(d, task.assignedDepartmentId)}`);
  audit(d, 'task.create', 'TASK', task.id);
  return { state: d, taskId: task.id };
}

export interface TaskPatch {
  status?: TaskStatus;
  assignedUserId?: string | null;
  dueAt?: string;
}

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  OPEN: 'เปิด',
  IN_PROGRESS: 'เริ่มทำ',
  BLOCKED: 'ติดปัญหา',
  DONE: 'เสร็จ',
  CANCELLED: 'ยกเลิก',
};

export function updateInternalTask(state: DemoState, taskId: string, patch: TaskPatch): DemoState {
  const d = begin(state);
  const me = actor(d);
  const t = findTask(d, taskId);
  if (!canUpdateTask(d.data, me, t)) deny();
  if (!isTaskOpen(t.status)) throw new DemoError('งานนี้ปิดแล้ว แก้ไขไม่ได้');
  const changes: string[] = [];
  if (patch.status && patch.status !== t.status) {
    if (!canTransitionTask(t.status, patch.status)) throw new DemoError(`เปลี่ยนสถานะงานจาก ${t.status} เป็น ${patch.status} ไม่ได้`);
    t.status = patch.status;
    changes.push(TASK_STATUS_LABEL[patch.status]);
  }
  if (patch.assignedUserId !== undefined && patch.assignedUserId !== t.assignedUserId) {
    if (patch.assignedUserId) {
      const u = d.data.users.find((x) => x.id === patch.assignedUserId);
      if (!u || u.departmentId !== t.assignedDepartmentId) throw new DemoError('ผู้รับงานต้องอยู่ในแผนกของงาน');
    }
    t.assignedUserId = patch.assignedUserId;
    changes.push(`มอบให้ ${nameOf(d, patch.assignedUserId)}`);
  }
  if (patch.dueAt && patch.dueAt !== t.dueAt) {
    if (Number.isNaN(Date.parse(patch.dueAt))) throw new DemoError('กำหนดเสร็จไม่ถูกต้อง');
    t.dueAt = new Date(patch.dueAt).toISOString();
    changes.push('เลื่อนกำหนดเสร็จ');
  }
  if (!changes.length) return state;
  timeline(d, t.caseId, 'TASK_UPDATED', `งานภายใน "${t.title}": ${changes.join(', ')}`);
  audit(d, 'task.update', 'TASK', t.id);
  return d;
}

/** Internal-only comment. Never added to the customer conversation. */
export function addInternalComment(state: DemoState, taskId: string, body: string): DemoState {
  const d = begin(state);
  const me = actor(d);
  const t = findTask(d, taskId);
  if (!canUpdateTask(d.data, me, t)) deny();
  const text = body.trim();
  if (!text) throw new DemoError('กรุณาพิมพ์ความคิดเห็น');
  d.data.comments.push({ id: nextId(d, 'cm'), taskId: t.id, authorId: me.id, body: text, createdAt: d.now });
  timeline(d, t.caseId, 'TASK_COMMENTED', `ความคิดเห็นภายในในงาน "${t.title}"`);
  audit(d, 'task.comment', 'TASK', t.id);
  return d;
}

// ---- Demo controls ---------------------------------------------------------------------

/** "Advance demo time" — moves the deterministic clock forward to show SLA changes. */
export function advanceDemoTime(state: DemoState, minutes: number): DemoState {
  if (!Number.isFinite(minutes) || minutes <= 0) throw new DemoError('ระยะเวลาต้องมากกว่า 0');
  return { ...state, now: addMinutes(state.now, minutes) };
}

export function switchActingUser(state: DemoState, userId: string): DemoState {
  if (!state.data.users.some((u) => u.id === userId)) throw new DemoError('ไม่พบผู้ใช้เดโม่', 'NOT_FOUND');
  return { ...state, actingUserId: userId };
}
