// Routing topics configured by Admin (fictional demo setup).
// RESPONSIBLE department receives the case; OBSERVER departments can read its log only.
import type { Topic } from '../types/domain';

const tp = (
  id: string,
  name: string,
  skills: string[],
  responsibleDepartmentId: string,
  observerDepartmentIds: string[],
  picUserIds: string[],
  description?: string,
): Topic => ({ id, name, skills, responsibleDepartmentId, observerDepartmentIds, picUserIds, active: true, ...(description ? { description } : {}) });

export const topics: Topic[] = [
  tp('tp-motor-claim', 'Motor Claim', ['claims', 'motor'], 'dep-claims', [], ['usr-pic-1', 'usr-pic-2', 'usr-pic-4', 'usr-sup-claims'], 'แจ้งเคลมและติดตามเคลมรถยนต์'),
  tp('tp-property-claim', 'Property Claim', ['claims', 'property'], 'dep-claims', [], ['usr-pic-5', 'usr-pic-1']),
  tp('tp-travel-claim', 'Travel Claim', ['claims', 'travel', 'documents'], 'dep-claims', [], ['usr-pic-4', 'usr-pic-5']),
  tp('tp-repair', 'Repair Coordination', ['claims', 'repair'], 'dep-claims', ['dep-marketing'], ['usr-pic-1', 'usr-pic-2'], 'ประสานงานอู่ซ่อม — Marketing ติดตาม log เพื่อดูแลประสบการณ์ลูกค้า'),
  tp('tp-policy-service', 'Policy Service', ['service', 'policy'], 'dep-service', [], ['usr-pic-3', 'usr-pic-6']),
  tp('tp-renewal', 'Renewal', ['renewal'], 'dep-service', ['dep-sales', 'dep-marketing'], ['usr-pic-6', 'usr-pic-3']),
  tp('tp-billing', 'Billing', ['service', 'billing'], 'dep-service', [], ['usr-pic-7', 'usr-pic-3']),
  tp('tp-complaint', 'Complaint', ['service', 'customer'], 'dep-service', ['dep-legal'], ['usr-pic-3', 'usr-pic-7']),
  tp('tp-quotation', 'Quotation', ['sales', 'quotation'], 'dep-sales', ['dep-marketing'], ['usr-pic-8', 'usr-pic-9']),
  tp('tp-commercial', 'Commercial Property', ['underwriting', 'property'], 'dep-underwriting', ['dep-sales'], ['usr-uw-1', 'usr-uw-2']),
  tp('tp-campaign', 'Campaign Inquiry', ['marketing', 'customer'], 'dep-marketing', ['dep-sales'], ['usr-mkt-1', 'usr-mkt-2', 'usr-mkt-3'], 'สอบถามโปรโมชันและแคมเปญ'),
  tp('tp-general', 'General Inquiry', ['customer'], 'dep-service', [], ['usr-pic-3', 'usr-pic-7']),
];
