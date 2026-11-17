// Thai UI labels for centralized enums. Codes stay visible in tooltips for traceability.
import type { Availability, CaseStatus, ConversationStatus, EscalationStatus, Priority, SlaState, TaskStatus } from '../types/domain';

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  NEW: 'ใหม่',
  TRIAGED: 'คัดกรองแล้ว',
  ASSIGNED: 'มอบหมายแล้ว',
  IN_PROGRESS: 'กำลังดำเนินการ',
  PENDING: 'รอข้อมูล',
  ESCALATED: 'ส่งต่อภายใน',
  RESOLVED: 'แก้ไขแล้ว',
  CLOSED: 'ปิดแล้ว',
  REOPENED: 'เปิดใหม่',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'ต่ำ',
  NORMAL: 'ปกติ',
  HIGH: 'สูง',
  URGENT: 'ด่วนมาก',
};

export const ESCALATION_STATUS_LABEL: Record<EscalationStatus, string> = {
  REQUESTED: 'ส่งคำขอแล้ว',
  UNDER_REVIEW: 'กำลังพิจารณา',
  ACCEPTED: 'รับเรื่องแล้ว',
  IN_PROGRESS: 'กำลังดำเนินการ',
  RESOLVED: 'แก้ไขเสร็จ',
  REJECTED: 'ปฏิเสธ',
  CANCELLED: 'ยกเลิก',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  OPEN: 'เปิด',
  IN_PROGRESS: 'กำลังทำ',
  BLOCKED: 'ติดปัญหา',
  DONE: 'เสร็จแล้ว',
  CANCELLED: 'ยกเลิก',
};

export const SLA_LABEL: Record<SlaState, string> = {
  ON_TRACK: 'ON TRACK',
  AT_RISK: 'AT RISK',
  BREACHED: 'BREACHED',
  PAUSED: 'PAUSED',
};

export const CONVERSATION_STATUS_LABEL: Record<ConversationStatus, string> = {
  OPEN: 'เปิดอยู่',
  PENDING: 'รอลูกค้า',
  CLOSED: 'ปิดแล้ว',
};

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  AVAILABLE: 'ว่าง',
  BUSY: 'ยุ่ง',
  AWAY: 'ไม่อยู่',
  OFFLINE: 'ออฟไลน์',
};

/** Visual tone for chips. Tone is never the only signal — chips always carry text. */
export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'gray';

export const CASE_STATUS_TONE: Record<CaseStatus, Tone> = {
  NEW: 'blue',
  TRIAGED: 'blue',
  ASSIGNED: 'neutral',
  IN_PROGRESS: 'amber',
  PENDING: 'gray',
  ESCALATED: 'purple',
  RESOLVED: 'green',
  CLOSED: 'gray',
  REOPENED: 'red',
};
export const PRIORITY_TONE: Record<Priority, Tone> = { LOW: 'gray', NORMAL: 'neutral', HIGH: 'amber', URGENT: 'red' };
export const ESCALATION_TONE: Record<EscalationStatus, Tone> = {
  REQUESTED: 'blue',
  UNDER_REVIEW: 'amber',
  ACCEPTED: 'purple',
  IN_PROGRESS: 'amber',
  RESOLVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'gray',
};
export const TASK_TONE: Record<TaskStatus, Tone> = { OPEN: 'blue', IN_PROGRESS: 'amber', BLOCKED: 'red', DONE: 'green', CANCELLED: 'gray' };
export const SLA_TONE: Record<SlaState, Tone> = { ON_TRACK: 'green', AT_RISK: 'amber', BREACHED: 'red', PAUSED: 'gray' };
