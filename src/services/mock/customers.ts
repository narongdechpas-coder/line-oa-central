// Customer Management / CDP-lite mock services. Pure functions over DemoState; no network.
// Customer records are NEVER merged across OAs. Links are governed and consent-bound.

import type {
  ConsentPurpose,
  Customer,
  CustomFieldDefinition,
  CustomFieldValue,
  DemoState,
  ProfileLink,
  Segment,
  SegmentRule,
} from '../../types/domain';
import { canBeLinked, consentOf, noticeOf, optionalPurposes, PURPOSE_LABEL } from '../../utils/consent';
import {
  can,
  canAddCustomerNote,
  assignableOwnerIds,
  canAssignCustomerOwner,
  canDecideLink,
  canEditCustomer,
  canEditField,
  canManageField,
  canRequestLink,
  canRevealPii,
  canSeeCustomer,
  canUnlink,
} from '../../utils/permissions';
import { DemoError, actor, audit, begin, deny, nextId, type Draft } from './operations';

function findCustomer(d: Draft, id: string): Customer {
  const c = d.data.customers.find((x) => x.id === id);
  if (!c) throw new DemoError(`ไม่พบลูกค้า ${id}`, 'NOT_FOUND');
  return c;
}

const fieldAppliesTo = (def: CustomFieldDefinition, c: Customer) => def.channelIds === 'ALL' || def.channelIds.includes(c.channelId);

function validateValue(def: CustomFieldDefinition, v: CustomFieldValue): CustomFieldValue {
  if (v === null || v === '') {
    if (def.required) throw new DemoError(`ช่อง “${def.label}” ต้องกรอก`);
    return null;
  }
  switch (def.type) {
    case 'BOOLEAN':
      if (typeof v !== 'boolean') throw new DemoError(`ช่อง “${def.label}” ต้องเป็น ใช่/ไม่ใช่`);
      return v;
    case 'NUMBER': {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) throw new DemoError(`ช่อง “${def.label}” ต้องเป็นตัวเลข`);
      return n;
    }
    case 'DATE':
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new DemoError(`ช่อง “${def.label}” ต้องเป็นวันที่`);
      return v;
    case 'SELECT':
      if (typeof v !== 'string' || !def.options?.includes(v)) throw new DemoError(`ค่าของ “${def.label}” ไม่อยู่ในตัวเลือก`);
      return v;
    case 'TEXT': {
      const s = String(v).trim();
      if (s.length > 200) throw new DemoError(`ช่อง “${def.label}” ยาวเกิน 200 ตัวอักษร`);
      return s || null;
    }
  }
}

// ---- Profile --------------------------------------------------------------------------

export interface CustomerPatch {
  tags?: string[];
  customFields?: Record<string, CustomFieldValue>;
}

/** Tags and custom fields only. displayName / LINE ID come from LINE and are read-only. */
export function updateCustomerProfile(state: DemoState, customerId: string, patch: CustomerPatch): DemoState {
  const d = begin(state);
  const me = actor(d);
  const c = findCustomer(d, customerId);
  if (!canEditCustomer(d.data, me, c)) deny('บทบาทนี้แก้ข้อมูลลูกค้ารายนี้ไม่ได้');
  const changed: string[] = [];
  if (patch.tags) {
    const tags = [...new Set(patch.tags.map((t) => t.trim()).filter(Boolean))];
    if (tags.some((t) => t.length > 30)) throw new DemoError('แท็กยาวเกิน 30 ตัวอักษร');
    c.tags = tags;
    changed.push('tags');
  }
  for (const [key, raw] of Object.entries(patch.customFields ?? {})) {
    const def = d.data.customFieldDefs.find((f) => f.key === key);
    if (!def || !def.active || !fieldAppliesTo(def, c)) throw new DemoError(`ฟิลด์ ${key} ใช้กับลูกค้ารายนี้ไม่ได้`);
    if (!canEditField(me, def)) deny(`บทบาทนี้แก้ “${def.label}” ไม่ได้`);
    c.customFields = { ...(c.customFields ?? {}), [key]: validateValue(def, raw) };
    changed.push(key);
  }
  if (!changed.length) return state;
  audit(d, `customer.update:${changed.join(',')}`, 'CUSTOMER', c.id);
  return d;
}

export function assignCustomerOwner(state: DemoState, customerId: string, userId: string | null, reason?: string): DemoState {
  const d = begin(state);
  const me = actor(d);
  const c = findCustomer(d, customerId);
  if (!canAssignCustomerOwner(d.data, me, c)) deny('บทบาทนี้มอบหมายผู้ดูแลหลักของลูกค้ารายนี้ไม่ได้');
  if ((c.ownerUserId ?? null) === userId) throw new DemoError(userId ? 'ผู้นี้เป็นผู้ดูแลหลักอยู่แล้ว' : 'ลูกค้ายังไม่มีผู้ดูแลหลัก');
  // Owner may be in ANY department (decision 4). Non-OA managers may only pick from their own department.
  if (userId && !assignableOwnerIds(d.data, me, c).includes(userId)) {
    throw new DemoError('เลือกผู้ดูแลหลักนี้ไม่ได้: ต้องเป็น PIC / Supervisor / Manager และอยู่ในแผนกที่บทบาทนี้ดูแล');
  }
  const prev = d.data.ownerAssignments.find((a) => a.customerId === c.id && a.isActive);
  if (prev) {
    prev.isActive = false;
    prev.endedAt = d.now;
  }
  if (userId) {
    d.data.ownerAssignments.push({
      id: nextId(d, 'ow'),
      customerId: c.id,
      userId,
      isActive: true,
      assignedAt: d.now,
      assignedBy: me.id,
      reason: reason?.trim() || null,
    });
  }
  c.ownerUserId = userId;
  audit(d, userId ? 'customer.owner.assign' : 'customer.owner.clear', 'CUSTOMER', c.id);
  return d;
}

export function addCustomerNote(state: DemoState, customerId: string, body: string, pinned = false): DemoState {
  const d = begin(state);
  const me = actor(d);
  const c = findCustomer(d, customerId);
  if (!canAddCustomerNote(d.data, me, c)) deny();
  const text = body.trim();
  if (!text) throw new DemoError('กรุณาพิมพ์บันทึก');
  if (text.length > 1000) throw new DemoError('บันทึกยาวเกิน 1,000 ตัวอักษร');
  d.data.customerNotes.push({ id: nextId(d, 'cn'), customerId: c.id, authorId: me.id, body: text, pinned, createdAt: d.now });
  audit(d, 'customer.note.add', 'CUSTOMER', c.id);
  return d;
}

export function toggleNotePin(state: DemoState, noteId: string): DemoState {
  const d = begin(state);
  const me = actor(d);
  const n = d.data.customerNotes.find((x) => x.id === noteId);
  if (!n) throw new DemoError('ไม่พบบันทึก', 'NOT_FOUND');
  if (!canAddCustomerNote(d.data, me, findCustomer(d, n.customerId))) deny();
  n.pinned = !n.pinned;
  audit(d, n.pinned ? 'customer.note.pin' : 'customer.note.unpin', 'CUSTOMER', n.customerId);
  return d;
}

/** Records that full PII was displayed. The UI unmasks only after this succeeds. */
export function revealPii(state: DemoState, customerId: string, field: string): DemoState {
  const d = begin(state);
  const me = actor(d);
  const c = findCustomer(d, customerId);
  if (!canRevealPii(d.data, me, c)) deny('บทบาทนี้เปิดดูข้อมูลส่วนบุคคลเต็มของลูกค้ารายนี้ไม่ได้');
  audit(d, `pii.reveal:${field}`, 'CUSTOMER', c.id);
  return d;
}

// ---- Consent (simulated customer action) -------------------------------------------------

/**
 * Simulates the CUSTOMER granting or withdrawing an optional purpose on LINE.
 * Staff cannot change consent on a customer's behalf; this is a demo control.
 * Withdrawing CROSS_SERVICE_LINKING suspends approved links and rejects pending ones.
 */
export function simulateConsentChange(state: DemoState, customerId: string, purpose: ConsentPurpose, grant: boolean): DemoState {
  const d = begin(state);
  const me = actor(d);
  const c = findCustomer(d, customerId);
  if (me.role === 'AUDITOR' || !canSeeCustomer(d.data, me, c)) deny();
  const rec = consentOf(d.data, c.id);
  const notice = noticeOf(d.data, rec);
  if (!rec || !notice) throw new DemoError('ลูกค้ารายนี้ยังไม่มีบันทึกความยินยอม');
  if (!optionalPurposes(notice).includes(purpose)) throw new DemoError('วัตถุประสงค์ที่บังคับเปลี่ยนแยกไม่ได้ในเดโม่นี้');
  const has = rec.grantedPurposes.includes(purpose);
  if (has === grant) throw new DemoError(grant ? 'ลูกค้ายินยอมข้อนี้อยู่แล้ว' : 'ลูกค้าไม่ได้ยินยอมข้อนี้อยู่แล้ว');
  rec.grantedPurposes = grant ? [...rec.grantedPurposes, purpose] : rec.grantedPurposes.filter((p) => p !== purpose);
  rec.history.push({ at: d.now, action: grant ? 'GRANTED' : 'WITHDRAWN', purposes: [purpose], source: 'SIMULATED_CUSTOMER_ACTION' });
  audit(d, `consent.${grant ? 'grant' : 'withdraw'}:${purpose}`, 'CUSTOMER', c.id);

  if (!grant && purpose === 'CROSS_SERVICE_LINKING') {
    for (const l of d.data.profileLinks) {
      if (l.customerAId !== c.id && l.customerBId !== c.id) continue;
      if (l.status === 'APPROVED') {
        l.status = 'SUSPENDED';
        l.endedAt = d.now;
        l.endReason = 'ระงับอัตโนมัติ: ลูกค้าถอนความยินยอมการเชื่อมข้อมูล';
        audit(d, 'profile.link.suspend', 'PROFILE_LINK', l.id);
      } else if (l.status === 'REQUESTED') {
        l.status = 'REJECTED';
        l.decidedAt = d.now;
        l.decisionNote = 'ปฏิเสธอัตโนมัติ: ลูกค้าถอนความยินยอมการเชื่อมข้อมูล';
        audit(d, 'profile.link.auto_reject', 'PROFILE_LINK', l.id);
      }
    }
  }
  return d;
}

// ---- Profile links ----------------------------------------------------------------------

const isOpenLink = (l: ProfileLink) => l.status === 'REQUESTED' || l.status === 'APPROVED' || l.status === 'SUSPENDED';
const samePair = (l: ProfileLink, a: string, b: string) =>
  (l.customerAId === a && l.customerBId === b) || (l.customerAId === b && l.customerBId === a);

function assertLinkConsent(d: Draft, ids: string[]) {
  for (const id of ids) {
    if (!canBeLinked(d.data, id)) {
      const name = d.data.customers.find((x) => x.id === id)?.displayName ?? id;
      throw new DemoError(`${name} ยังไม่ได้ยินยอม “${PURPOSE_LABEL.CROSS_SERVICE_LINKING}” จึงเชื่อมโปรไฟล์ไม่ได้`);
    }
  }
}

export function requestProfileLink(
  state: DemoState,
  customerAId: string,
  customerBId: string,
  reason: string,
): { state: DemoState; linkId: string } {
  const d = begin(state);
  const me = actor(d);
  const a = findCustomer(d, customerAId);
  const b = findCustomer(d, customerBId);
  if (!canRequestLink(d.data, me, a)) deny('บทบาทนี้ขอเชื่อมโปรไฟล์ไม่ได้');
  if (a.id === b.id) throw new DemoError('เลือกลูกค้าคนเดียวกันไม่ได้');
  if (a.channelId === b.channelId) throw new DemoError('เชื่อมได้เฉพาะโปรไฟล์ที่อยู่ต่าง LINE OA');
  const text = reason.trim();
  if (!text) throw new DemoError('กรุณาระบุเหตุผลและหลักฐานว่าเป็นบุคคลเดียวกัน');
  if (d.data.profileLinks.some((l) => samePair(l, a.id, b.id) && isOpenLink(l))) {
    throw new DemoError('คู่นี้มีคำขอหรือการเชื่อมอยู่แล้ว');
  }
  assertLinkConsent(d, [a.id, b.id]);
  const link: ProfileLink = {
    id: nextId(d, 'pl'),
    customerAId: a.id,
    customerBId: b.id,
    status: 'REQUESTED',
    reason: text,
    requestedBy: me.id,
    requestedAt: d.now,
    consentRecordIds: [consentOf(d.data, a.id)!.id, consentOf(d.data, b.id)!.id],
  };
  d.data.profileLinks.push(link);
  audit(d, 'profile.link.request', 'PROFILE_LINK', link.id);
  return { state: d, linkId: link.id };
}

export function decideProfileLink(state: DemoState, linkId: string, decision: 'APPROVE' | 'REJECT', note?: string): DemoState {
  const d = begin(state);
  const me = actor(d);
  const l = d.data.profileLinks.find((x) => x.id === linkId);
  if (!l) throw new DemoError('ไม่พบคำขอเชื่อมโปรไฟล์', 'NOT_FOUND');
  if (l.status !== 'REQUESTED') throw new DemoError('คำขอนี้ตัดสินไปแล้ว');
  if (l.requestedBy === me.id) deny('ผู้ขออนุมัติคำขอของตัวเองไม่ได้');
  if (!canDecideLink(d.data, me, l)) deny('อนุมัติได้เฉพาะ Manager ของแผนกเจ้าของ OA ฝั่งใดฝั่งหนึ่ง');
  if (decision === 'REJECT' && !note?.trim()) throw new DemoError('กรุณาระบุเหตุผลที่ปฏิเสธ');
  if (decision === 'APPROVE') assertLinkConsent(d, [l.customerAId, l.customerBId]); // re-check at decision time
  l.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  l.decidedBy = me.id;
  l.decidedAt = d.now;
  l.decisionNote = note?.trim() || null;
  audit(d, `profile.link.${decision.toLowerCase()}`, 'PROFILE_LINK', l.id);
  return d;
}

export function unlinkProfile(state: DemoState, linkId: string, reason: string): DemoState {
  const d = begin(state);
  const me = actor(d);
  const l = d.data.profileLinks.find((x) => x.id === linkId);
  if (!l) throw new DemoError('ไม่พบการเชื่อมโปรไฟล์', 'NOT_FOUND');
  if (l.status !== 'APPROVED' && l.status !== 'SUSPENDED') throw new DemoError('ยกเลิกได้เฉพาะการเชื่อมที่อนุมัติแล้วหรือถูกระงับ');
  if (!canUnlink(d.data, me, l)) deny();
  if (!reason.trim()) throw new DemoError('กรุณาระบุเหตุผลที่ยกเลิกการเชื่อม');
  l.status = 'UNLINKED';
  l.endedAt = d.now;
  l.endReason = reason.trim();
  audit(d, 'profile.link.unlink', 'PROFILE_LINK', l.id);
  return d;
}

// ---- Segments ---------------------------------------------------------------------------

export function createSegment(
  state: DemoState,
  payload: { name: string; description?: string; rules: SegmentRule[] },
): { state: DemoState; segmentId: string } {
  const d = begin(state);
  const me = actor(d);
  if (!can(me, 'segment.manage')) deny();
  const name = payload.name.trim();
  if (!name) throw new DemoError('กรุณาตั้งชื่อ Segment');
  if (!payload.rules.length) throw new DemoError('ต้องมีเงื่อนไขอย่างน้อย 1 ข้อ');
  if (payload.rules.some((r) => r.kind === 'POLICY_EXPIRES_WITHIN' && (!Number.isInteger(r.days) || r.days < 1 || r.days > 365))) {
    throw new DemoError('จำนวนวันต้องอยู่ระหว่าง 1–365');
  }
  const seg: Segment = {
    id: nextId(d, 'seg'),
    name,
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
    rules: payload.rules,
    ownerDepartmentId: me.departmentId,
    createdBy: me.id,
    createdAt: d.now,
  };
  d.data.segments.push(seg);
  audit(d, 'segment.create', 'SEGMENT', seg.id);
  return { state: d, segmentId: seg.id };
}

export function deleteSegment(state: DemoState, segmentId: string): DemoState {
  const d = begin(state);
  const me = actor(d);
  const seg = d.data.segments.find((s) => s.id === segmentId);
  if (!seg) throw new DemoError('ไม่พบ Segment', 'NOT_FOUND');
  if (!can(me, 'segment.manage')) deny();
  if (me.role !== 'SUPER_ADMIN' && seg.ownerDepartmentId !== me.departmentId) deny('ลบได้เฉพาะ Segment ของแผนกตัวเอง');
  d.data.segments = d.data.segments.filter((s) => s.id !== segmentId);
  audit(d, 'segment.delete', 'SEGMENT', segmentId);
  return d;
}

// ---- Custom field definitions ---------------------------------------------------------------

export type CustomFieldInput = Omit<CustomFieldDefinition, 'id' | 'active'> & { id?: string };

export function saveCustomFieldDef(state: DemoState, input: CustomFieldInput): { state: DemoState; fieldId: string } {
  const d = begin(state);
  const me = actor(d);
  if (!canManageField(d.data, me, input)) deny('จัดการได้เฉพาะฟิลด์ของ OA ในแผนกตัวเอง');
  const label = input.label.trim();
  const key = input.key.trim();
  if (!label) throw new DemoError('กรุณาระบุชื่อฟิลด์');
  if (!/^[a-zA-Z][a-zA-Z0-9]{1,30}$/.test(key)) throw new DemoError('key ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข 2–31 ตัว ขึ้นต้นด้วยตัวอักษร');
  if (input.type === 'SELECT' && (!input.options || input.options.filter((o) => o.trim()).length < 2)) {
    throw new DemoError('ฟิลด์แบบตัวเลือกต้องมีอย่างน้อย 2 ตัวเลือก');
  }
  if (input.channelIds !== 'ALL' && input.channelIds.length === 0) throw new DemoError('เลือก LINE OA อย่างน้อย 1 ช่องทาง');
  if (!input.editableByRoles.length) throw new DemoError('เลือกบทบาทที่แก้ไขได้อย่างน้อย 1 บทบาท');
  const clash = d.data.customFieldDefs.find((f) => f.key === key && f.id !== input.id);
  if (clash) throw new DemoError(`key “${key}” ถูกใช้แล้ว`);

  const options = input.type === 'SELECT' ? input.options!.map((o) => o.trim()).filter(Boolean) : undefined;
  if (input.id) {
    const f = d.data.customFieldDefs.find((x) => x.id === input.id);
    if (!f) throw new DemoError('ไม่พบฟิลด์', 'NOT_FOUND');
    if (!canManageField(d.data, me, f)) deny();
    if (f.key !== key || f.type !== input.type) throw new DemoError('เปลี่ยน key หรือชนิดของฟิลด์ที่มีอยู่ไม่ได้ (ข้อมูลเดิมจะไม่ตรงชนิด)');
    Object.assign(f, { label, options, channelIds: input.channelIds, editableByRoles: input.editableByRoles, isPII: input.isPII, required: input.required });
    audit(d, 'field.update', 'CUSTOM_FIELD', f.id);
    return { state: d, fieldId: f.id };
  }
  const f: CustomFieldDefinition = {
    id: nextId(d, 'cf'),
    key,
    label,
    type: input.type,
    ...(options ? { options } : {}),
    channelIds: input.channelIds,
    editableByRoles: input.editableByRoles,
    isPII: input.isPII,
    required: input.required,
    active: true,
  };
  d.data.customFieldDefs.push(f);
  audit(d, 'field.create', 'CUSTOM_FIELD', f.id);
  return { state: d, fieldId: f.id };
}

/** Deactivating hides the field everywhere but keeps stored values (no data loss). */
export function setCustomFieldActive(state: DemoState, fieldId: string, active: boolean): DemoState {
  const d = begin(state);
  const me = actor(d);
  const f = d.data.customFieldDefs.find((x) => x.id === fieldId);
  if (!f) throw new DemoError('ไม่พบฟิลด์', 'NOT_FOUND');
  if (!canManageField(d.data, me, f)) deny();
  if (f.active === active) return state;
  f.active = active;
  audit(d, active ? 'field.activate' : 'field.deactivate', 'CUSTOM_FIELD', f.id);
  return d;
}
