// Customer Management / CDP-lite: seed integrity, permissions, consent-bound linking, segments.
import { describe, expect, it } from 'vitest';
import { DEMO_START, SEED, cloneSeed } from '../data/seed';
import * as svc from '../services/mock';
import { DemoError } from '../services/mock';
import { customer360, segmentMembers } from '../services/mock/queries';
import type { DemoState } from '../types/domain';
import { canBeLinked, shareableCategories } from '../utils/consent';
import { maskPhone } from '../utils/pii';

const fresh = (actingUserId = 'usr-admin'): DemoState => ({ data: cloneSeed(), now: new Date(DEMO_START).toISOString(), seq: 0, actingUserId });
const as = (s: DemoState, userId: string) => svc.switchActingUser(s, userId);
const cus = (s: DemoState, id: string) => s.data.customers.find((c) => c.id === id)!;
const link = (s: DemoState, id: string) => s.data.profileLinks.find((l) => l.id === id)!;
const user = (s: DemoState, id: string) => s.data.users.find((u) => u.id === id)!;

function expectError(fn: () => unknown, kind?: DemoError['kind']): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DemoError);
    if (kind) expect((e as DemoError).kind).toBe(kind);
    return (e as DemoError).message;
  }
  throw new Error('expected DemoError');
}

describe('customer seed integrity', () => {
  it('every customer has exactly one consent record from its own OA notice', () => {
    for (const c of SEED.customers) {
      const recs = SEED.consentRecords.filter((r) => r.customerId === c.id);
      expect(recs, c.id).toHaveLength(1);
      const notice = SEED.consentNotices.find((n) => n.id === recs[0]!.noticeId);
      expect(notice?.channelId, c.id).toBe(c.channelId);
      // required purposes always granted
      for (const p of notice!.purposes.filter((x) => x.required)) expect(recs[0]!.grantedPurposes).toContain(p.purpose);
    }
  });

  it('one active owner per customer, matching ownerUserId and the OA department', () => {
    for (const c of SEED.customers) {
      const active = SEED.ownerAssignments.filter((a) => a.customerId === c.id && a.isActive);
      expect(active.length, c.id).toBeLessThanOrEqual(1);
      expect(active[0]?.userId ?? null, c.id).toBe(c.ownerUserId ?? null);
      if (c.ownerUserId) {
        const dep = SEED.channels.find((ch) => ch.id === c.channelId)?.departmentId;
        expect(SEED.users.find((u) => u.id === c.ownerUserId)?.departmentId, c.id).toBe(dep);
      }
    }
  });

  it('links join different OAs and respect consent', () => {
    for (const l of SEED.profileLinks) {
      const a = SEED.customers.find((c) => c.id === l.customerAId)!;
      const b = SEED.customers.find((c) => c.id === l.customerBId)!;
      expect(a.channelId).not.toBe(b.channelId);
      if (l.status === 'APPROVED' || l.status === 'REQUESTED') {
        expect(canBeLinked(SEED, a.id) && canBeLinked(SEED, b.id), l.id).toBe(true);
      }
    }
    expect(SEED.profileLinks.map((l) => l.status).sort()).toEqual(['APPROVED', 'REQUESTED', 'SUSPENDED']);
    expect(canBeLinked(SEED, 'cus-036')).toBe(false); // withdrew → pl-003 suspended
  });

  it('custom field values match their definitions and channels', () => {
    for (const c of SEED.customers) {
      for (const key of Object.keys(c.customFields ?? {})) {
        const def = SEED.customFieldDefs.find((f) => f.key === key);
        expect(def, `${c.id}.${key}`).toBeDefined();
        expect(def!.channelIds === 'ALL' || def!.channelIds.includes(c.channelId), `${c.id}.${key}`).toBe(true);
      }
    }
  });

  it('policies and notes reference existing customers; policy numbers are demo format', () => {
    const ids = new Set(SEED.customers.map((c) => c.id));
    for (const p of SEED.policies) {
      expect(ids.has(p.customerId)).toBe(true);
      expect(p.policyNo).toMatch(/^DEMO-/);
    }
    for (const n of SEED.customerNotes) expect(ids.has(n.customerId)).toBe(true);
  });
});

describe('Customer 360 (purpose limitation)', () => {
  it('shows linked profile only with categories from that profile’s notice', () => {
    const fromService = customer360(SEED, 'cus-002'); // Mali on Service OA
    expect(fromService.map((v) => v.customer.id)).toEqual(['cus-006']);
    expect(fromService[0]!.allowed).toContain('CLAIM_DETAIL'); // claims notice covers claim detail

    const fromClaims = customer360(SEED, 'cus-006');
    expect(fromClaims[0]!.customer.id).toBe('cus-002');
    expect(fromClaims[0]!.allowed).not.toContain('CLAIM_DETAIL'); // service notice does not
  });

  it('suspended and requested links expose nothing', () => {
    expect(customer360(SEED, 'cus-004')).toEqual([]); // pl-003 suspended
    expect(customer360(SEED, 'cus-001')).toEqual([]); // pl-002 only requested
  });

  it('a profile without linking consent exposes nothing, even if a link record says APPROVED', () => {
    expect(shareableCategories(SEED, 'cus-036')).toEqual([]); // withdrew linking consent
    expect(shareableCategories(SEED, 'cus-005')).toEqual([]); // never granted it
    const data = cloneSeed();
    data.profileLinks.find((l) => l.id === 'pl-003')!.status = 'APPROVED'; // inconsistent record
    expect(customer360(data, 'cus-004')[0]!.allowed).toEqual([]);
  });

  it('a Sales-side profile never exposes policy data', () => {
    expect(shareableCategories(SEED, 'cus-035')).toEqual(['IDENTITY', 'CONTACT', 'CONVERSATION']);
  });
});

describe('customer owner', () => {
  it('Claims manager assigns within Claims; history kept, one active', () => {
    let s = as(fresh(), 'usr-manager');
    s = svc.assignCustomerOwner(s, 'cus-005', 'usr-pic-5', 'ลูกค้าใหม่');
    expect(cus(s, 'cus-005').ownerUserId).toBe('usr-pic-5');
    s = svc.assignCustomerOwner(s, 'cus-005', 'usr-pic-1');
    const hist = s.data.ownerAssignments.filter((a) => a.customerId === 'cus-005');
    expect(hist).toHaveLength(2);
    expect(hist.filter((a) => a.isActive).map((a) => a.userId)).toEqual(['usr-pic-1']);
  });

  it('owner must be in the OA department; other departments cannot assign', () => {
    expectError(() => svc.assignCustomerOwner(as(fresh(), 'usr-manager'), 'cus-005', 'usr-pic-3'));
    expectError(() => svc.assignCustomerOwner(as(fresh(), 'usr-mgr-service'), 'cus-005', 'usr-pic-1'), 'DENIED');
    expectError(() => svc.assignCustomerOwner(fresh('usr-pic-1'), 'cus-005', 'usr-pic-1'), 'DENIED');
  });

  it('owner can be cleared', () => {
    const s = svc.assignCustomerOwner(fresh(), 'cus-001', null);
    expect(cus(s, 'cus-001').ownerUserId).toBeNull();
    expect(s.data.ownerAssignments.some((a) => a.customerId === 'cus-001' && a.isActive)).toBe(false);
  });
});

describe('profile editing and PII', () => {
  it('PIC edits own customer within field role limits', () => {
    const s = svc.updateCustomerProfile(fresh('usr-pic-1'), 'cus-001', { customFields: { contactPref: 'อีเมล' } });
    expect(cus(s, 'cus-001').customFields?.contactPref).toBe('อีเมล');
    expectError(() => svc.updateCustomerProfile(fresh('usr-pic-1'), 'cus-001', { customFields: { vip: true } }), 'DENIED');
    expectError(() => svc.updateCustomerProfile(fresh('usr-pic-1'), 'cus-002', { tags: ['x'] }), 'DENIED');
  });

  it('validates values and channel applicability', () => {
    expectError(() => svc.updateCustomerProfile(fresh(), 'cus-001', { customFields: { contactPref: 'แฟกซ์' } }));
    expectError(() => svc.updateCustomerProfile(fresh(), 'cus-001', { customFields: { birthDate: '12/04/1985' } }));
    expectError(() => svc.updateCustomerProfile(fresh(), 'cus-002', { customFields: { preferredGarage: 'x' } })); // Claims-only field
  });

  it('tags are trimmed and de-duplicated', () => {
    const s = svc.updateCustomerProfile(fresh(), 'cus-001', { tags: [' VIP ', 'VIP', 'Motor', ''] });
    expect(cus(s, 'cus-001').tags).toEqual(['VIP', 'Motor']);
  });

  it('PII reveal is audited and scope-checked; Auditor may reveal but not edit', () => {
    const s = svc.revealPii(fresh('usr-auditor'), 'cus-001', 'phone');
    expect(s.data.audit.at(-1)).toMatchObject({ action: 'pii.reveal:phone', resourceType: 'CUSTOMER', resourceId: 'cus-001', actorId: 'usr-auditor' });
    expectError(() => svc.updateCustomerProfile(fresh('usr-auditor'), 'cus-001', { tags: [] }), 'DENIED');
    expectError(() => svc.revealPii(fresh('usr-pic-1'), 'cus-002', 'phone'), 'DENIED');
    expectError(() => svc.revealPii(fresh('usr-sysadmin'), 'cus-001', 'phone'), 'DENIED');
  });

  it('masks phone numbers', () => {
    expect(maskPhone('08X-XXX-1001')).toBe('•••-•••-••01');
  });
});

describe('consent-bound profile linking', () => {
  it('rejects links without consent, on the same OA, or without a reason', () => {
    const s = fresh('usr-sup-claims');
    expect(expectError(() => svc.requestProfileLink(s, 'cus-005', 'cus-020', 'same person'))).toContain('ยินยอม');
    expectError(() => svc.requestProfileLink(s, 'cus-001', 'cus-006', 'x')); // both Claims OA
    expectError(() => svc.requestProfileLink(s, 'cus-008', 'cus-013', '  '));
    expectError(() => svc.requestProfileLink(fresh('usr-pic-1'), 'cus-008', 'cus-013', 'x'), 'DENIED');
  });

  it('requester cannot approve; unrelated department manager cannot approve', () => {
    let s = fresh('usr-sup-claims');
    const r = svc.requestProfileLink(s, 'cus-008', 'cus-013', 'ลูกค้ายืนยันตัวตนทางโทรศัพท์');
    s = r.state;
    expectError(() => svc.decideProfileLink(s, r.linkId, 'APPROVE'), 'DENIED');
    expectError(() => svc.decideProfileLink(as(s, 'usr-mgr-legal'), r.linkId, 'APPROVE'), 'DENIED');
    s = svc.decideProfileLink(as(s, 'usr-mgr-service'), r.linkId, 'APPROVE');
    expect(link(s, r.linkId).status).toBe('APPROVED');
    expect(customer360(s.data, 'cus-008').map((v) => v.customer.id)).toEqual(['cus-013']);
  });

  it('reject needs a reason; duplicate pair is blocked', () => {
    const s = as(fresh(), 'usr-manager');
    expectError(() => svc.decideProfileLink(s, 'pl-002', 'REJECT'));
    expectError(() => svc.requestProfileLink(s, 'cus-035', 'cus-001', 'again'));
  });

  it('approving pl-002 exposes only Sales-notice categories from Claims side', () => {
    const s = svc.decideProfileLink(as(fresh(), 'usr-manager'), 'pl-002', 'APPROVE', 'ok');
    const v = customer360(s.data, 'cus-001');
    expect(v[0]!.customer.id).toBe('cus-035');
    expect(v[0]!.allowed).not.toContain('POLICY');
  });

  it('withdrawing linking consent suspends approved links and rejects pending ones', () => {
    let s = fresh();
    s = svc.simulateConsentChange(s, 'cus-006', 'CROSS_SERVICE_LINKING', false);
    expect(link(s, 'pl-001').status).toBe('SUSPENDED');
    expect(customer360(s.data, 'cus-002')).toEqual([]);
    s = svc.simulateConsentChange(s, 'cus-035', 'CROSS_SERVICE_LINKING', false);
    expect(link(s, 'pl-002').status).toBe('REJECTED');
    const rec = s.data.consentRecords.find((r) => r.customerId === 'cus-006')!;
    expect(rec.history.at(-1)).toMatchObject({ action: 'WITHDRAWN', purposes: ['CROSS_SERVICE_LINKING'] });
  });

  it('re-granting consent does not silently restore a suspended link', () => {
    const s = svc.simulateConsentChange(fresh(), 'cus-036', 'CROSS_SERVICE_LINKING', true);
    expect(link(s, 'pl-003').status).toBe('SUSPENDED');
    expect(customer360(s.data, 'cus-004')).toEqual([]);
  });

  it('required purposes cannot be toggled; Auditor cannot simulate', () => {
    expectError(() => svc.simulateConsentChange(fresh(), 'cus-001', 'CLAIMS_PROCESSING', false));
    expectError(() => svc.simulateConsentChange(fresh('usr-auditor'), 'cus-001', 'MARKETING', true), 'DENIED');
  });

  it('unlink needs a reason and ends the link', () => {
    const s = fresh('usr-mgr-service');
    expectError(() => svc.unlinkProfile(s, 'pl-001', ''));
    const s2 = svc.unlinkProfile(s, 'pl-001', 'ลูกค้าขอแยกข้อมูล');
    expect(link(s2, 'pl-001')).toMatchObject({ status: 'UNLINKED', endReason: 'ลูกค้าขอแยกข้อมูล' });
  });
});

describe('segments', () => {
  it('renewal segment = active policies expiring within 30 days of the demo clock', () => {
    const s = fresh();
    const ids = segmentMembers(s.data, user(s, 'usr-admin'), 'seg-001', s.now).map((c) => c.id).sort();
    expect(ids).toEqual(['cus-002', 'cus-003', 'cus-006', 'cus-010', 'cus-026']);
  });

  it('members are limited by the viewer’s scope', () => {
    const s = fresh();
    const all = segmentMembers(s.data, user(s, 'usr-admin'), 'seg-001', s.now);
    const sales = segmentMembers(s.data, user(s, 'usr-mgr-sales'), 'seg-001', s.now);
    expect(sales.length).toBeLessThan(all.length);
    expect(sales.every((c) => c.channelId === 'ch-sales' || s.data.cases.some((k) => k.originalCustomerId === c.id))).toBe(true);
  });

  it('create validates; delete is limited to own department', () => {
    expectError(() => svc.createSegment(fresh(), { name: '', rules: [{ kind: 'TAG', tag: 'VIP' }] }));
    expectError(() => svc.createSegment(fresh(), { name: 'x', rules: [] }));
    expectError(() => svc.createSegment(fresh('usr-pic-1'), { name: 'x', rules: [{ kind: 'TAG', tag: 'VIP' }] }), 'DENIED');
    const r = svc.createSegment(fresh('usr-manager'), { name: 'VIP Claims', rules: [{ kind: 'CUSTOM_FIELD', key: 'vip', value: true }] });
    expect(segmentMembers(r.state.data, user(r.state, 'usr-manager'), r.segmentId, r.state.now).map((c) => c.id)).toEqual(['cus-006']);
    expectError(() => svc.deleteSegment(as(r.state, 'usr-mgr-sales'), r.segmentId), 'DENIED');
    expect(svc.deleteSegment(r.state, r.segmentId).data.segments.some((x) => x.id === r.segmentId)).toBe(false);
  });
});

describe('custom field definitions', () => {
  const base = { label: 'เลขทะเบียนรถ', key: 'plateNo', type: 'TEXT' as const, channelIds: ['ch-claims'], editableByRoles: ['PIC_AGENT' as const], isPII: true, required: false };

  it('Dept Admin manages fields only for own-department OAs', () => {
    const s = fresh('usr-depadmin-claims');
    const r = svc.saveCustomFieldDef(s, base);
    expect(r.state.data.customFieldDefs.find((f) => f.id === r.fieldId)?.key).toBe('plateNo');
    expectError(() => svc.saveCustomFieldDef(s, { ...base, key: 'x2', channelIds: ['ch-sales'] }), 'DENIED');
    expectError(() => svc.saveCustomFieldDef(s, { ...base, key: 'x3', channelIds: 'ALL' }), 'DENIED');
    expectError(() => svc.saveCustomFieldDef(fresh('usr-manager'), base), 'DENIED');
  });

  it('validates key, options and clashes; key/type are immutable on edit', () => {
    const s = fresh();
    expectError(() => svc.saveCustomFieldDef(s, { ...base, key: '1bad' }));
    expectError(() => svc.saveCustomFieldDef(s, { ...base, key: 'contactPref' }));
    expectError(() => svc.saveCustomFieldDef(s, { ...base, type: 'SELECT', options: ['a'] }));
    expectError(() => svc.saveCustomFieldDef(s, { ...base, id: 'cf-vip', key: 'vip', type: 'TEXT' }));
  });

  it('deactivating keeps stored values', () => {
    const s = svc.setCustomFieldActive(fresh(), 'cf-vip', false);
    expect(s.data.customFieldDefs.find((f) => f.id === 'cf-vip')?.active).toBe(false);
    expect(cus(s, 'cus-006').customFields?.vip).toBe(true);
    expectError(() => svc.updateCustomerProfile(s, 'cus-006', { customFields: { vip: false } }));
  });
});
