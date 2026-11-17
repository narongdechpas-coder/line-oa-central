// Consent rules (SIMULATED). Purpose limitation: data from one OA is usable elsewhere only
// when the customer granted CROSS_SERVICE_LINKING, and only for categories in that OA's notice.
import type { ConsentNotice, ConsentPurpose, ConsentRecord, DataCategory, DemoData } from '../types/domain';

export const PURPOSE_LABEL: Record<ConsentPurpose, string> = {
  SERVICE_DELIVERY: 'ให้บริการตามที่ลูกค้าขอ',
  CLAIMS_PROCESSING: 'พิจารณาและติดตามการเคลม',
  POLICY_SERVICING: 'บริการเกี่ยวกับกรมธรรม์',
  SALES_QUOTATION: 'จัดทำใบเสนอราคา',
  CROSS_SERVICE_LINKING: 'เชื่อมข้อมูลกับบริการอื่นของบริษัทเพื่อให้บริการต่อเนื่อง',
  MARKETING: 'การตลาด',
};

export const CATEGORY_LABEL: Record<DataCategory, string> = {
  IDENTITY: 'ตัวตน (ชื่อ, LINE ID)',
  CONTACT: 'ข้อมูลติดต่อ',
  POLICY: 'กรมธรรม์',
  CLAIM_DETAIL: 'รายละเอียดเคลม',
  CONVERSATION: 'ประวัติการสนทนา',
};

export const consentOf = (data: DemoData, customerId: string): ConsentRecord | undefined =>
  data.consentRecords.find((r) => r.customerId === customerId);

export const noticeOf = (data: DemoData, record?: ConsentRecord): ConsentNotice | undefined =>
  record ? data.consentNotices.find((n) => n.id === record.noticeId) : undefined;

export function hasPurpose(data: DemoData, customerId: string, purpose: ConsentPurpose): boolean {
  const r = consentOf(data, customerId);
  return !!r && r.status === 'GRANTED' && r.grantedPurposes.includes(purpose);
}

export const canBeLinked = (data: DemoData, customerId: string) => hasPurpose(data, customerId, 'CROSS_SERVICE_LINKING');

/** Categories of `customerId` that may be shown through a profile link. Empty when the customer did not consent. */
export function shareableCategories(data: DemoData, customerId: string): DataCategory[] {
  if (!canBeLinked(data, customerId)) return [];
  return noticeOf(data, consentOf(data, customerId))?.dataCategories ?? [];
}

export const optionalPurposes = (notice: ConsentNotice): ConsentPurpose[] =>
  notice.purposes.filter((p) => !p.required).map((p) => p.purpose);
