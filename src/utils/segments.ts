// Segment rule evaluation. Membership is computed live from demo state (no stored lists).
import type { Customer, DemoData, SegmentRule } from '../types/domain';
import { hasPurpose, PURPOSE_LABEL } from './consent';
import { isCaseOpen } from './transitions';
import { ms } from './time';

const DAY = 86_400_000;

export function matchesRule(data: DemoData, c: Customer, rule: SegmentRule, nowIso: string): boolean {
  switch (rule.kind) {
    case 'CHANNEL':
      return c.channelId === rule.channelId;
    case 'TAG':
      return c.tags.includes(rule.tag);
    case 'OWNER':
      return (c.ownerUserId ?? null) === rule.ownerUserId;
    case 'HAS_OPEN_CASE':
      return data.cases.some((k) => k.originalCustomerId === c.id && isCaseOpen(k.status)) === rule.value;
    case 'POLICY_EXPIRES_WITHIN': {
      const now = ms(nowIso);
      return data.policies.some(
        (p) => p.customerId === c.id && p.status === 'ACTIVE' && ms(p.expiryDate) >= now && ms(p.expiryDate) <= now + rule.days * DAY,
      );
    }
    case 'POLICY_PRODUCT':
      return data.policies.some((p) => p.customerId === c.id && p.status === 'ACTIVE' && p.product === rule.product);
    case 'CONSENT_PURPOSE':
      return hasPurpose(data, c.id, rule.purpose);
    case 'CUSTOM_FIELD':
      return (c.customFields?.[rule.key] ?? null) === rule.value;
  }
}

export const matchesAll = (data: DemoData, c: Customer, rules: SegmentRule[], nowIso: string) =>
  rules.every((r) => matchesRule(data, c, r, nowIso));

export function describeRule(data: DemoData, rule: SegmentRule): string {
  switch (rule.kind) {
    case 'CHANNEL':
      return `LINE OA = ${data.channels.find((x) => x.id === rule.channelId)?.name ?? rule.channelId}`;
    case 'TAG':
      return `มีแท็ก “${rule.tag}”`;
    case 'OWNER':
      return rule.ownerUserId ? `ผู้ดูแลหลัก = ${data.users.find((u) => u.id === rule.ownerUserId)?.name ?? rule.ownerUserId}` : 'ยังไม่มีผู้ดูแลหลัก';
    case 'HAS_OPEN_CASE':
      return rule.value ? 'มี Case เปิดอยู่' : 'ไม่มี Case เปิดอยู่';
    case 'POLICY_EXPIRES_WITHIN':
      return `กรมธรรม์หมดอายุภายใน ${rule.days} วัน`;
    case 'POLICY_PRODUCT':
      return `มีกรมธรรม์ ${rule.product}`;
    case 'CONSENT_PURPOSE':
      return `ยินยอม: ${PURPOSE_LABEL[rule.purpose]}`;
    case 'CUSTOM_FIELD': {
      const def = data.customFieldDefs.find((f) => f.key === rule.key);
      return `${def?.label ?? rule.key} = ${String(rule.value)}`;
    }
  }
}
