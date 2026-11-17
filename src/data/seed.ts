// Demo seed data. ALL RECORDS ARE FICTIONAL — no real customers, phone numbers or LINE IDs.
//
// Based on docs/handover/04_data/mock/seed.json (every original ID is kept) and
// extended with more records so the Dashboard and Reports have something to show.
// Changes to the original records:
//   - `slaState` removed from cases: it is now derived from dueAt and the demo clock (utils/sla.ts)
//   - `requiredSkills` added to cases (used by PIC recommendation)
//   - escalation esc-001 gains fromTeamId / requestedOwnerId / previousOwnerId
//   - an inactive assignment shows case-0003 was handled by Thanawat before the Legal handoff

import type {
  Assignment,
  Case,
  CaseStatus,
  Channel,
  Conversation,
  Customer,
  DemoData,
  DemoUser,
  Department,
  Escalation,
  InternalComment,
  InternalTask,
  Message,
  Priority,
  Team,
  TimelineEvent,
} from '../types/domain';

/** Fixed starting point of the deterministic demo clock. */
export const DEMO_START = '2026-11-09T10:00:00+07:00';

/** '11-09 09:40' -> '2026-11-09T09:40:00+07:00' (Bangkok time). */
const t = (mdhm: string): string => {
  const [md, hm] = mdhm.split(' ');
  return `2026-${md}T${hm}:00+07:00`;
};

const departments: Department[] = [
  { id: 'dep-claims', code: 'CLAIMS', name: 'Claims' },
  { id: 'dep-service', code: 'SERVICE', name: 'Customer Service' },
  { id: 'dep-sales', code: 'SALES', name: 'Sales' },
  { id: 'dep-legal', code: 'LEGAL', name: 'Legal & Compliance' },
  { id: 'dep-underwriting', code: 'UW', name: 'Underwriting' },
];

const teams: Team[] = [
  { id: 'team-claims', departmentId: 'dep-claims', name: 'Claims Team' },
  { id: 'team-service', departmentId: 'dep-service', name: 'Service Team' },
  { id: 'team-sales', departmentId: 'dep-sales', name: 'Sales Support' },
  { id: 'team-legal', departmentId: 'dep-legal', name: 'Legal Advisory' },
  { id: 'team-uw', departmentId: 'dep-underwriting', name: 'Underwriting Review' },
];

const u = (
  id: string,
  name: string,
  role: DemoUser['role'],
  departmentId: string | null,
  teamId: string | null,
  skills: string[],
  availability: DemoUser['availability'],
  workload: number,
  experienceYears: number,
): DemoUser => ({ id, name, role, departmentId, teamId, skills, availability, workload, experienceYears });

const users: DemoUser[] = [
  // original
  u('usr-admin', 'Demo Admin', 'SUPER_ADMIN', null, null, ['admin', 'operations'], 'AVAILABLE', 20, 10),
  u('usr-manager', 'Nattaya Manager', 'MANAGER', 'dep-claims', 'team-claims', ['claims', 'customer'], 'AVAILABLE', 45, 9),
  u('usr-sup-claims', 'Krit Supervisor', 'SUPERVISOR', 'dep-claims', 'team-claims', ['claims', 'motor'], 'AVAILABLE', 55, 7),
  u('usr-pic-1', 'Pimchanok', 'PIC_AGENT', 'dep-claims', 'team-claims', ['claims', 'motor', 'repair'], 'AVAILABLE', 35, 6),
  u('usr-pic-2', 'Thanawat', 'PIC_AGENT', 'dep-claims', 'team-claims', ['claims', 'customer'], 'BUSY', 78, 4),
  u('usr-pic-3', 'Siriporn', 'PIC_AGENT', 'dep-service', 'team-service', ['customer', 'service'], 'AVAILABLE', 25, 5),
  u('usr-legal', 'Kamon Legal', 'PIC_AGENT', 'dep-legal', 'team-legal', ['legal', 'compliance'], 'AVAILABLE', 40, 8),
  u('usr-auditor', 'Demo Auditor', 'AUDITOR', null, null, ['audit'], 'AVAILABLE', 10, 12),
  // extension
  u('usr-sysadmin', 'Somkiat SysAdmin', 'SYSTEM_ADMIN', null, null, ['admin'], 'AVAILABLE', 15, 6),
  u('usr-depadmin-claims', 'Ratchanee DeptAdmin', 'DEPARTMENT_ADMIN', 'dep-claims', null, ['admin', 'claims'], 'AVAILABLE', 30, 8),
  u('usr-pic-4', 'Warut', 'PIC_AGENT', 'dep-claims', 'team-claims', ['claims', 'documents', 'travel'], 'AWAY', 30, 3),
  u('usr-pic-5', 'Jiraporn', 'PIC_AGENT', 'dep-claims', 'team-claims', ['claims', 'property'], 'AVAILABLE', 50, 8),
  u('usr-mgr-service', 'Orawan Manager', 'MANAGER', 'dep-service', 'team-service', ['service', 'customer'], 'AVAILABLE', 40, 10),
  u('usr-pic-6', 'Nattapong', 'PIC_AGENT', 'dep-service', 'team-service', ['service', 'policy', 'renewal'], 'BUSY', 65, 3),
  u('usr-pic-7', 'Kanokwan', 'PIC_AGENT', 'dep-service', 'team-service', ['service', 'billing', 'customer'], 'AVAILABLE', 45, 2),
  u('usr-mgr-sales', 'Prasert Manager', 'MANAGER', 'dep-sales', 'team-sales', ['sales'], 'AVAILABLE', 35, 11),
  u('usr-pic-8', 'Apinya', 'PIC_AGENT', 'dep-sales', 'team-sales', ['sales', 'motor', 'quotation'], 'AVAILABLE', 30, 4),
  u('usr-pic-9', 'Teerapat', 'PIC_AGENT', 'dep-sales', 'team-sales', ['sales', 'renewal', 'property'], 'AVAILABLE', 55, 6),
  u('usr-mgr-legal', 'Supaporn Legal Manager', 'MANAGER', 'dep-legal', 'team-legal', ['legal', 'compliance'], 'AVAILABLE', 35, 12),
  u('usr-legal-2', 'Wichai Legal', 'PIC_AGENT', 'dep-legal', 'team-legal', ['legal', 'contract'], 'AVAILABLE', 20, 3),
  u('usr-mgr-uw', 'Chatchai UW Manager', 'MANAGER', 'dep-underwriting', 'team-uw', ['underwriting', 'risk'], 'AVAILABLE', 40, 14),
  u('usr-uw-1', 'Pornthip UW', 'PIC_AGENT', 'dep-underwriting', 'team-uw', ['underwriting', 'motor', 'property'], 'AVAILABLE', 35, 7),
  u('usr-uw-2', 'Yuttana UW', 'PIC_AGENT', 'dep-underwriting', 'team-uw', ['underwriting', 'property', 'risk'], 'BUSY', 70, 5),
];

const channels: Channel[] = [
  { id: 'ch-claims', name: 'Claims OA', departmentId: 'dep-claims', status: 'SIMULATED', connection: 'NOT_CONNECTED', color: '#16A36A' },
  { id: 'ch-service', name: 'Service OA', departmentId: 'dep-service', status: 'SIMULATED', connection: 'NOT_CONNECTED', color: '#2878D0' },
  { id: 'ch-sales', name: 'Sales OA', departmentId: 'dep-sales', status: 'SIMULATED', connection: 'NOT_CONNECTED', color: '#D68A2D' },
];

// [customerId, channelId, lineUserId suffix, displayName, tags]
const customerRows: [string, string, string, string, string[]][] = [
  ['cus-001', 'ch-claims', '1001', 'Krit Customer', ['Motor', 'Claim']],
  ['cus-002', 'ch-service', '2001', 'Mali Customer', ['Policy', 'Service']],
  ['cus-003', 'ch-sales', '3001', 'Anan Customer', ['Renewal', 'Inquiry']],
  ['cus-004', 'ch-claims', '1002', 'Nicha Customer', ['Motor', 'Repair']],
  ['cus-005', 'ch-claims', '1003', 'Somsak Customer', ['Motor', 'Claim']],
  // Same display name as cus-002 on a different OA: a separate customer (identity = channel + lineUserId).
  ['cus-006', 'ch-claims', '1004', 'Mali Customer', ['Motor', 'Accident']],
  ['cus-007', 'ch-claims', '1005', 'Preecha Customer', ['Property', 'Claim']],
  ['cus-008', 'ch-claims', '1006', 'Wanida Customer', ['Motor', 'Repair']],
  ['cus-009', 'ch-claims', '1007', 'Chaiwat Customer', ['Motor', 'Total Loss']],
  ['cus-010', 'ch-claims', '1008', 'Duangjai Customer', ['Travel', 'Claim']],
  ['cus-011', 'ch-claims', '1009', 'Ekkachai Customer', ['Motor', 'Claim']],
  ['cus-012', 'ch-claims', '1010', 'Sunee Customer', ['Property', 'Flood']],
  ['cus-013', 'ch-service', '2002', 'Boonmee Customer', ['Policy', 'Endorsement']],
  ['cus-014', 'ch-service', '2003', 'Rattana Customer', ['Billing']],
  ['cus-015', 'ch-service', '2004', 'Pakorn Customer', ['Policy', 'Renewal']],
  ['cus-016', 'ch-service', '2005', 'Jintana Customer', ['Complaint']],
  ['cus-017', 'ch-service', '2006', 'Kittisak Customer', ['Policy', 'Cancellation']],
  ['cus-018', 'ch-service', '2007', 'Lamai Customer', ['Billing', 'Refund']],
  ['cus-019', 'ch-service', '2008', 'Nopparat Customer', ['Policy', 'Document']],
  ['cus-020', 'ch-sales', '3002', 'Supachai Customer', ['Quotation', 'Motor']],
  ['cus-021', 'ch-sales', '3003', 'Arunee Customer', ['Quotation', 'PA']],
  ['cus-022', 'ch-sales', '3004', 'Thanakorn Customer', ['Renewal']],
  ['cus-023', 'ch-sales', '3005', 'Pornpimol Customer', ['Quotation', 'Home']],
  ['cus-024', 'ch-sales', '3006', 'Weerapong Customer', ['SME', 'Property']],
  ['cus-025', 'ch-sales', '3007', 'Saowalak Customer', ['Quotation', 'Travel']],
  ['cus-026', 'ch-sales', '3008', 'Manop Customer', ['Renewal', 'Motor']],
  ['cus-027', 'ch-claims', '1011', 'Anucha Customer', ['Motor', 'Glass']],
  ['cus-028', 'ch-service', '2009', 'Siriwan Customer', ['Policy', 'Address']],
  ['cus-029', 'ch-service', '2010', 'Thawatchai Customer', ['Billing', 'Tax Invoice']],
  ['cus-030', 'ch-sales', '3009', 'Kanya Customer', ['Quotation', 'Motor']],
  ['cus-031', 'ch-claims', '1012', 'Pichit Customer', ['Property', 'Fire']],
  ['cus-032', 'ch-service', '2011', 'Ubon Customer', ['Policy']],
  ['cus-033', 'ch-claims', '1013', 'Rungnapa Customer', ['Motor', 'Hit and Run']],
  ['cus-034', 'ch-claims', '1014', 'Phairoj Customer', ['Motor', 'Claim']],
];

const customers: Customer[] = customerRows.map(([id, channelId, n, displayName, tags]) => ({
  id,
  channelId,
  lineUserId: `U-DEMO-${n}`,
  displayName,
  phone: `08X-XXX-${n}`,
  tags,
}));

// Messages per conversation: [direction, 'MM-DD HH:mm', text]. 'O' = simulated outbound.
type MsgRow = ['I' | 'O', string, string];

// [conversationId, customerId, status, assignedUserId, unread, messages]
const conversationRows: [string, string, Conversation['status'], string | null, number, MsgRow[]][] = [
  ['conv-001', 'cus-001', 'OPEN', 'usr-pic-1', 2, [
    ['I', '11-09 09:35', 'สอบถามสถานะการเคลมรถยนต์ครับ ต้องใช้เอกสารอะไรเพิ่มเติมไหม'],
    ['O', '11-09 09:37', 'รับเรื่องแล้วครับ กำลังตรวจสอบเอกสารให้'],
    ['I', '11-09 09:40', 'ขอบคุณครับ รอข่าวนะครับ'],
  ]],
  ['conv-002', 'cus-002', 'OPEN', 'usr-pic-3', 1, [
    ['I', '11-09 09:12', 'ขอรายละเอียดการต่ออายุกรมธรรม์ค่ะ'],
  ]],
  ['conv-003', 'cus-003', 'PENDING', null, 0, [
    ['I', '11-09 08:50', 'สนใจประกันรถยนต์ อยากทราบเบี้ยประกันครับ'],
  ]],
  ['conv-004', 'cus-004', 'OPEN', 'usr-pic-2', 0, [
    ['I', '11-08 16:20', 'ขอติดตามความคืบหน้าการนำรถเข้าซ่อมค่ะ'],
  ]],
  ['conv-005', 'cus-005', 'OPEN', null, 1, [
    ['I', '11-09 09:15', 'รถโดนชนท้ายที่แยกไฟแดงครับ คู่กรณียอมรับผิดแล้ว ต้องทำอะไรต่อครับ'],
  ]],
  ['conv-006', 'cus-006', 'OPEN', null, 1, [
    ['I', '11-09 08:25', 'อยากทราบขั้นตอนเคลมอุบัติเหตุรถยนต์ค่ะ ต้องเตรียมอะไรบ้าง'],
  ]],
  ['conv-007', 'cus-007', 'OPEN', 'usr-pic-5', 0, [
    ['I', '11-08 13:50', 'ไฟฟ้าลัดวงจรที่บ้าน เครื่องใช้ไฟฟ้าเสียหายหลายชิ้น เคลมได้ไหมครับ'],
    ['O', '11-08 14:10', 'รับเรื่องแล้วครับ ขอรูปถ่ายความเสียหายและใบเสร็จเครื่องใช้ไฟฟ้าด้วยครับ'],
  ]],
  ['conv-008', 'cus-008', 'OPEN', 'usr-pic-1', 1, [
    ['I', '11-07 09:55', 'อู่แจ้งว่ารออะไหล่ ไม่ทราบว่าจะได้รถคืนเมื่อไหร่คะ'],
    ['O', '11-07 10:30', 'กำลังประสานกับอู่ให้ค่ะ จะแจ้งกลับภายในวันนี้'],
    ['I', '11-09 08:10', 'ยังไม่มีใครติดต่อกลับเลยค่ะ'],
  ]],
  ['conv-009', 'cus-009', 'OPEN', 'usr-pic-1', 0, [
    ['I', '11-08 14:50', 'รถเสียหายหนักมาก อู่บอกว่าน่าจะซ่อมไม่คุ้ม ต้องทำอย่างไรครับ'],
    ['O', '11-08 15:20', 'รับเรื่องครับ ขอส่งให้ทีมพิจารณากรณีเสียหายสิ้นเชิงก่อนนะครับ'],
  ]],
  ['conv-010', 'cus-010', 'PENDING', 'usr-pic-4', 0, [
    ['I', '11-06 10:50', 'กระเป๋าเดินทางหายที่สนามบินปลายทางค่ะ เคลมได้ไหมคะ'],
    ['O', '11-06 15:00', 'เคลมได้ครับ รบกวนส่งใบแจ้งความและเอกสารจากสายการบินครับ'],
  ]],
  ['conv-011', 'cus-011', 'CLOSED', 'usr-pic-2', 0, [
    ['I', '11-05 08:55', 'รถถูกเฉี่ยวที่ลานจอด ไม่มีคู่กรณีครับ'],
    ['O', '11-05 17:00', 'ดำเนินการเรียบร้อยครับ อู่จะนัดเข้าซ่อมให้'],
  ]],
  ['conv-012', 'cus-012', 'CLOSED', 'usr-pic-5', 0, [
    ['I', '11-03 09:50', 'น้ำท่วมบ้าน ชั้นล่างเสียหายค่ะ'],
    ['O', '11-03 20:00', 'อนุมัติค่าสินไหมแล้วค่ะ เอกสารจะส่งทางอีเมล'],
  ]],
  ['conv-013', 'cus-013', 'OPEN', 'usr-pic-6', 0, [
    ['I', '11-08 12:55', 'ขอเพิ่มชื่อผู้ขับขี่ในกรมธรรม์ครับ'],
  ]],
  ['conv-014', 'cus-014', 'OPEN', 'usr-pic-7', 2, [
    ['I', '11-09 06:50', 'ตัดบัตรเครดิตค่าเบี้ยสองครั้งค่ะ'],
    ['I', '11-09 06:52', 'รบกวนตรวจสอบและคืนเงินด้วยค่ะ'],
  ]],
  ['conv-015', 'cus-015', 'OPEN', 'usr-pic-6', 1, [
    ['I', '11-04 09:55', 'ต่ออายุแล้วเงื่อนไขเปลี่ยนไหมครับ'],
    ['O', '11-04 15:00', 'เงื่อนไขเหมือนเดิมครับ'],
    ['I', '11-09 08:40', 'เอกสารที่ได้มาส่วนลดไม่ตรงกับที่แจ้งครับ'],
  ]],
  ['conv-016', 'cus-016', 'OPEN', 'usr-pic-3', 3, [
    ['I', '11-09 05:55', 'ติดต่อมาสามวันแล้วไม่มีใครตอบ'],
    ['I', '11-09 05:57', 'ถ้ายังไม่มีคำตอบจะร้องเรียนนะคะ'],
    ['I', '11-09 07:15', 'รอคำตอบอยู่ค่ะ'],
  ]],
  ['conv-017', 'cus-017', 'CLOSED', 'usr-pic-3', 0, [
    ['I', '11-06 08:55', 'ขอยกเลิกกรมธรรม์เพราะขายรถแล้วครับ'],
    ['O', '11-06 16:00', 'ยกเลิกเรียบร้อยครับ เบี้ยคืนจะโอนภายใน 14 วัน'],
  ]],
  ['conv-018', 'cus-018', 'CLOSED', 'usr-pic-7', 0, [
    ['I', '11-02 09:55', 'เงินคืนเบี้ยยังไม่เข้าบัญชีค่ะ'],
    ['O', '11-04 10:00', 'โอนคืนเรียบร้อยแล้วค่ะ'],
  ]],
  ['conv-019', 'cus-019', 'OPEN', null, 1, [
    ['I', '11-09 09:30', 'ขอสำเนากรมธรรม์ฉบับเต็มทางอีเมลได้ไหมคะ'],
  ]],
  ['conv-020', 'cus-020', 'OPEN', 'usr-pic-8', 0, [
    ['I', '11-08 15:55', 'ขอใบเสนอราคาประกันชั้น 1 สำหรับรถเก๋งปี 2024 ครับ'],
    ['O', '11-08 16:30', 'รับเรื่องครับ ขอข้อมูลรุ่นรถและทุนประกันที่ต้องการครับ'],
  ]],
  ['conv-021', 'cus-021', 'OPEN', null, 1, [
    ['I', '11-09 09:05', 'ประกันอุบัติเหตุส่วนบุคคลมีแบบไหนบ้างคะ'],
  ]],
  ['conv-022', 'cus-022', 'CLOSED', 'usr-pic-9', 0, [
    ['I', '11-05 12:55', 'อยากต่ออายุและเพิ่มความคุ้มครองน้ำท่วมครับ'],
    ['O', '11-06 10:00', 'ต่ออายุพร้อมเพิ่มความคุ้มครองเรียบร้อยครับ'],
  ]],
  ['conv-023', 'cus-023', 'CLOSED', 'usr-pic-8', 0, [
    ['I', '11-03 13:55', 'ประกันบ้านคุ้มครองโจรกรรมไหมคะ'],
    ['O', '11-04 11:00', 'คุ้มครองค่ะ ส่งรายละเอียดให้แล้วนะคะ'],
  ]],
  ['conv-024', 'cus-024', 'OPEN', 'usr-uw-1', 0, [
    ['I', '11-07 08:55', 'ต้องการประกันทรัพย์สินโรงงาน ทุนประกันสูงครับ'],
    ['O', '11-07 09:30', 'รับเรื่องครับ ขอส่งให้ทีมพิจารณารับประกันก่อนครับ'],
  ]],
  ['conv-025', 'cus-025', 'PENDING', 'usr-pic-8', 0, [
    ['I', '11-08 09:55', 'ขอราคาประกันเดินทางไปญี่ปุ่น 7 วันค่ะ'],
    ['O', '11-08 12:00', 'รบกวนแจ้งวันเดินทางและจำนวนผู้เดินทางค่ะ'],
  ]],
  ['conv-026', 'cus-026', 'OPEN', null, 1, [
    ['I', '11-09 07:45', 'กรมธรรม์จะหมดเดือนหน้า ต่ออายุได้ส่วนลดไหมครับ'],
  ]],
  ['conv-027', 'cus-027', 'OPEN', 'usr-pic-2', 0, [
    ['I', '11-09 07:55', 'กระจกหน้ารถร้าวจากหินกระเด็นครับ'],
  ]],
  ['conv-028', 'cus-028', 'OPEN', null, 1, [
    ['I', '11-09 09:25', 'ย้ายบ้านใหม่ ขอเปลี่ยนที่อยู่ในกรมธรรม์ค่ะ'],
  ]],
  ['conv-029', 'cus-029', 'OPEN', null, 1, [
    ['I', '11-09 08:55', 'ใบกำกับภาษีชื่อบริษัทไม่ถูกต้องครับ'],
  ]],
  ['conv-030', 'cus-030', 'OPEN', null, 2, [
    ['I', '11-09 09:48', 'สนใจประกันชั้น 2+ ครับ'],
    ['I', '11-09 09:49', 'รถกระบะปี 2022 ครับ'],
  ]],
  ['conv-031', 'cus-031', 'OPEN', null, 2, [
    ['I', '11-09 09:45', 'ไฟไหม้ห้องครัวเมื่อเช้าค่ะ ดับได้แล้วแต่เสียหายเยอะ'],
    ['I', '11-09 09:46', 'ต้องทำอย่างไรต่อคะ'],
  ]],
  ['conv-032', 'cus-032', 'OPEN', null, 1, [
    ['I', '11-09 08:15', 'ลืมรหัสเข้าระบบดูกรมธรรม์ค่ะ'],
  ]],
  ['conv-033', 'cus-033', 'OPEN', null, 2, [
    ['I', '11-09 09:52', 'รถถูกชนแล้วคู่กรณีขับหนีครับ'],
    ['I', '11-09 09:53', 'มีกล้องหน้ารถ ต้องทำอะไรบ้างครับ'],
  ]],
  ['conv-034', 'cus-034', 'OPEN', null, 1, [
    ['I', '11-09 09:20', 'แจ้งเคลมรถยนต์ครับ ชนเสากลางซอย'],
  ]],
];

const customerChannel = new Map(customers.map((c) => [c.id, c.channelId]));

const conversations: Conversation[] = [];
const messages: Message[] = [];
let msgSeq = 0;
for (const [id, customerId, status, assignedUserId, unread, rows] of conversationRows) {
  const channelId = customerChannel.get(customerId);
  if (!channelId) throw new Error(`seed: unknown customer ${customerId}`);
  for (const [dir, at, text] of rows) {
    msgSeq += 1;
    messages.push({
      id: `msg-${String(msgSeq).padStart(3, '0')}`,
      conversationId: id,
      direction: dir === 'I' ? 'INBOUND' : 'OUTBOUND',
      text,
      createdAt: t(at),
      ...(dir === 'O' ? { simulated: true } : {}),
    });
  }
  const last = rows[rows.length - 1];
  conversations.push({
    id,
    channelId,
    customerId,
    status,
    assignedUserId,
    lastMessageAt: last ? t(last[1]) : t('11-09 00:00'),
    unread,
  });
}

interface CaseRow {
  n: number;
  conv: string;
  title: string;
  category: string;
  skills: string[];
  priority: Priority;
  status: CaseStatus;
  dep: string;
  team: string;
  owner: string | null;
  created: string;
  due: string;
  resolved?: string;
  closed?: string;
  paused?: string;
  description?: string;
}

const caseRows: CaseRow[] = [
  // original three
  { n: 1, conv: 'conv-001', title: 'ติดตามสถานะการเคลมรถยนต์', category: 'Motor Claim', skills: ['claims', 'motor'], priority: 'HIGH', status: 'IN_PROGRESS', dep: 'dep-claims', team: 'team-claims', owner: 'usr-pic-1', created: '11-09 09:40', due: '11-09 12:00' },
  { n: 2, conv: 'conv-002', title: 'สอบถามการต่ออายุกรมธรรม์', category: 'Policy Service', skills: ['service', 'renewal'], priority: 'NORMAL', status: 'ASSIGNED', dep: 'dep-service', team: 'team-service', owner: 'usr-pic-3', created: '11-09 09:15', due: '11-10 12:00' },
  { n: 3, conv: 'conv-004', title: 'ประสานงานอู่ซ่อมรถ', category: 'Repair Coordination', skills: ['claims', 'repair'], priority: 'URGENT', status: 'ESCALATED', dep: 'dep-legal', team: 'team-legal', owner: 'usr-legal', created: '11-08 16:30', due: '11-08 18:00' },
  // extension
  { n: 4, conv: 'conv-005', title: 'แจ้งเคลมรถถูกชนท้าย', category: 'Motor Claim', skills: ['claims', 'motor'], priority: 'HIGH', status: 'NEW', dep: 'dep-claims', team: 'team-claims', owner: null, created: '11-09 09:20', due: '11-09 17:20' },
  { n: 5, conv: 'conv-006', title: 'สอบถามขั้นตอนเคลมอุบัติเหตุ', category: 'Motor Claim', skills: ['claims', 'customer'], priority: 'NORMAL', status: 'TRIAGED', dep: 'dep-claims', team: 'team-claims', owner: null, created: '11-09 08:30', due: '11-10 08:30' },
  { n: 6, conv: 'conv-007', title: 'เคลมทรัพย์สินเสียหายจากไฟฟ้าลัดวงจร', category: 'Property Claim', skills: ['claims', 'property'], priority: 'HIGH', status: 'ASSIGNED', dep: 'dep-claims', team: 'team-claims', owner: 'usr-pic-5', created: '11-08 14:00', due: '11-09 11:30' },
  { n: 7, conv: 'conv-008', title: 'ติดตามอะไหล่รถที่อู่', category: 'Repair Coordination', skills: ['claims', 'repair'], priority: 'NORMAL', status: 'IN_PROGRESS', dep: 'dep-claims', team: 'team-claims', owner: 'usr-pic-1', created: '11-07 10:00', due: '11-08 10:00' },
  { n: 8, conv: 'conv-009', title: 'พิจารณาเคลมรถเสียหายสิ้นเชิง', category: 'Motor Claim', skills: ['claims', 'motor'], priority: 'URGENT', status: 'ESCALATED', dep: 'dep-claims', team: 'team-claims', owner: 'usr-pic-1', created: '11-08 15:00', due: '11-09 15:00' },
  { n: 9, conv: 'conv-010', title: 'เคลมประกันเดินทาง กระเป๋าสูญหาย', category: 'Travel Claim', skills: ['claims', 'travel', 'documents'], priority: 'NORMAL', status: 'PENDING', dep: 'dep-claims', team: 'team-claims', owner: 'usr-pic-4', created: '11-06 11:00', due: '11-07 11:00', paused: '11-06 15:00', description: 'รอลูกค้าส่งใบแจ้งความและเอกสารจากสายการบิน' },
  { n: 10, conv: 'conv-011', title: 'แจ้งเคลมรถถูกเฉี่ยว', category: 'Motor Claim', skills: ['claims', 'motor'], priority: 'NORMAL', status: 'RESOLVED', dep: 'dep-claims', team: 'team-claims', owner: 'usr-pic-2', created: '11-05 09:00', due: '11-06 09:00', resolved: '11-05 17:00' },
  { n: 11, conv: 'conv-012', title: 'เคลมบ้านน้ำท่วม', category: 'Property Claim', skills: ['claims', 'property'], priority: 'HIGH', status: 'CLOSED', dep: 'dep-claims', team: 'team-claims', owner: 'usr-pic-5', created: '11-03 10:00', due: '11-03 18:00', resolved: '11-03 20:00', closed: '11-04 09:00' },
  { n: 12, conv: 'conv-013', title: 'ขอสลักหลังเพิ่มชื่อผู้ขับขี่', category: 'Policy Service', skills: ['service', 'policy'], priority: 'NORMAL', status: 'IN_PROGRESS', dep: 'dep-service', team: 'team-service', owner: 'usr-pic-6', created: '11-08 13:00', due: '11-09 13:00' },
  { n: 13, conv: 'conv-014', title: 'ตัดเบี้ยซ้ำ ขอคืนเงิน', category: 'Billing', skills: ['service', 'billing'], priority: 'HIGH', status: 'ASSIGNED', dep: 'dep-service', team: 'team-service', owner: 'usr-pic-7', created: '11-09 07:00', due: '11-09 15:00' },
  { n: 14, conv: 'conv-016', title: 'ร้องเรียนความล่าช้าในการติดต่อกลับ', category: 'Complaint', skills: ['service', 'customer'], priority: 'URGENT', status: 'ESCALATED', dep: 'dep-service', team: 'team-service', owner: 'usr-pic-3', created: '11-09 06:00', due: '11-09 09:30' },
  { n: 15, conv: 'conv-017', title: 'ขอยกเลิกกรมธรรม์และคืนเบี้ย', category: 'Policy Service', skills: ['service', 'policy'], priority: 'NORMAL', status: 'RESOLVED', dep: 'dep-service', team: 'team-service', owner: 'usr-pic-3', created: '11-06 09:00', due: '11-07 09:00', resolved: '11-06 16:00' },
  { n: 16, conv: 'conv-018', title: 'ติดตามเงินคืนเบี้ย', category: 'Billing', skills: ['service', 'billing'], priority: 'LOW', status: 'CLOSED', dep: 'dep-service', team: 'team-service', owner: 'usr-pic-7', created: '11-02 10:00', due: '11-05 10:00', resolved: '11-04 10:00', closed: '11-04 12:00' },
  { n: 17, conv: 'conv-015', title: 'ส่วนลดต่ออายุไม่ตรงกับที่แจ้ง', category: 'Renewal', skills: ['service', 'renewal'], priority: 'NORMAL', status: 'REOPENED', dep: 'dep-service', team: 'team-service', owner: 'usr-pic-6', created: '11-04 10:00', due: '11-09 16:00', resolved: '11-04 15:00' },
  { n: 18, conv: 'conv-020', title: 'ขอใบเสนอราคาประกันรถยนต์ชั้น 1', category: 'Quotation', skills: ['sales', 'motor', 'quotation'], priority: 'NORMAL', status: 'IN_PROGRESS', dep: 'dep-sales', team: 'team-sales', owner: 'usr-pic-8', created: '11-08 16:00', due: '11-09 16:00' },
  { n: 19, conv: 'conv-024', title: 'ประกันทรัพย์สินโรงงาน SME ทุนสูง', category: 'Commercial Property', skills: ['underwriting', 'property'], priority: 'HIGH', status: 'ESCALATED', dep: 'dep-underwriting', team: 'team-uw', owner: 'usr-uw-1', created: '11-07 09:00', due: '11-10 09:00' },
  { n: 20, conv: 'conv-022', title: 'ต่ออายุพร้อมเพิ่มความคุ้มครองน้ำท่วม', category: 'Renewal', skills: ['sales', 'renewal'], priority: 'NORMAL', status: 'RESOLVED', dep: 'dep-sales', team: 'team-sales', owner: 'usr-pic-9', created: '11-05 13:00', due: '11-06 13:00', resolved: '11-06 10:00' },
  { n: 21, conv: 'conv-023', title: 'สอบถามความคุ้มครองประกันบ้าน', category: 'Quotation', skills: ['sales', 'property'], priority: 'LOW', status: 'CLOSED', dep: 'dep-sales', team: 'team-sales', owner: 'usr-pic-8', created: '11-03 14:00', due: '11-06 14:00', resolved: '11-04 11:00', closed: '11-04 11:30' },
  { n: 22, conv: 'conv-025', title: 'ใบเสนอราคาประกันเดินทาง', category: 'Quotation', skills: ['sales', 'quotation'], priority: 'NORMAL', status: 'PENDING', dep: 'dep-sales', team: 'team-sales', owner: 'usr-pic-8', created: '11-08 10:00', due: '11-09 10:00', paused: '11-08 12:00', description: 'รอลูกค้าแจ้งวันเดินทางและจำนวนผู้เดินทาง' },
  { n: 23, conv: 'conv-027', title: 'เคลมเปลี่ยนกระจกหน้ารถ', category: 'Motor Claim', skills: ['claims', 'motor', 'repair'], priority: 'LOW', status: 'ASSIGNED', dep: 'dep-claims', team: 'team-claims', owner: 'usr-pic-2', created: '11-09 08:00', due: '11-12 08:00' },
  { n: 24, conv: 'conv-031', title: 'เคลมไฟไหม้ห้องครัว', category: 'Property Claim', skills: ['claims', 'property'], priority: 'URGENT', status: 'NEW', dep: 'dep-claims', team: 'team-claims', owner: null, created: '11-09 09:50', due: '11-09 13:50' },
  { n: 25, conv: 'conv-029', title: 'ใบกำกับภาษีชื่อไม่ถูกต้อง', category: 'Billing', skills: ['service', 'billing'], priority: 'NORMAL', status: 'TRIAGED', dep: 'dep-service', team: 'team-service', owner: null, created: '11-09 09:00', due: '11-10 09:00' },
];

const convById = new Map(conversations.map((c) => [c.id, c]));

const cases: Case[] = caseRows.map((r) => {
  const conv = convById.get(r.conv);
  if (!conv) throw new Error(`seed: unknown conversation ${r.conv}`);
  const id = `case-${String(r.n).padStart(4, '0')}`;
  return {
    id,
    caseNumber: `JC-2026-${String(r.n).padStart(4, '0')}`,
    conversationId: conv.id,
    originalChannelId: conv.channelId,
    originalCustomerId: conv.customerId,
    title: r.title,
    ...(r.description ? { description: r.description } : {}),
    category: r.category,
    requiredSkills: r.skills,
    priority: r.priority,
    status: r.status,
    statusBeforeEscalation: r.status === 'ESCALATED' ? 'IN_PROGRESS' : null,
    currentDepartmentId: r.dep,
    currentTeamId: r.team,
    currentOwnerId: r.owner,
    dueAt: t(r.due),
    slaPausedAt: r.paused ? t(r.paused) : null,
    resolvedAt: r.resolved && r.status !== 'REOPENED' ? t(r.resolved) : null,
    closedAt: r.closed ? t(r.closed) : null,
    createdAt: t(r.created),
  };
});

// Active PRIMARY_PIC for every owned case. as-001..as-003 are the original records.
const originalAssignments: Assignment[] = [
  { id: 'as-001', caseId: 'case-0001', userId: 'usr-pic-1', assignmentType: 'PRIMARY_PIC', isActive: true, assignedAt: t('11-09 09:45') },
  { id: 'as-002', caseId: 'case-0002', userId: 'usr-pic-3', assignmentType: 'PRIMARY_PIC', isActive: true, assignedAt: t('11-09 09:20') },
  { id: 'as-003', caseId: 'case-0003', userId: 'usr-legal', assignmentType: 'PRIMARY_PIC', isActive: true, assignedAt: t('11-08 17:10'), reason: 'รับงานจาก Escalation esc-001' },
];
// Earlier owners (history) — [caseId, userId, assignedAt, unassignedAt]
const pastAssignments: [string, string, string, string][] = [
  ['case-0003', 'usr-pic-2', '11-08 16:35', '11-08 17:10'],
  ['case-0007', 'usr-pic-4', '11-07 10:10', '11-08 09:00'],
  ['case-0019', 'usr-pic-9', '11-07 09:10', '11-07 15:00'],
];
// Assignment time for the active owner of extension cases (defaults to created + 10 min handled below)
const activeAssignedAt: Record<string, string> = {
  'case-0007': '11-08 09:00',
  'case-0019': '11-07 15:00',
};

let asSeq = 3;
const assignments: Assignment[] = [...originalAssignments];
for (const [caseId, userId, at, until] of pastAssignments) {
  asSeq += 1;
  assignments.push({
    id: `as-${String(asSeq).padStart(3, '0')}`,
    caseId,
    userId,
    assignmentType: 'PRIMARY_PIC',
    isActive: false,
    assignedAt: t(at),
    unassignedAt: t(until),
  });
}
for (const c of cases) {
  if (!c.currentOwnerId || originalAssignments.some((a) => a.caseId === c.id)) continue;
  asSeq += 1;
  const at = activeAssignedAt[c.id];
  assignments.push({
    id: `as-${String(asSeq).padStart(3, '0')}`,
    caseId: c.id,
    userId: c.currentOwnerId,
    assignmentType: 'PRIMARY_PIC',
    isActive: true,
    assignedAt: at ? t(at) : new Date(Date.parse(c.createdAt) + 10 * 60_000).toISOString(),
  });
}

const escalations: Escalation[] = [
  { id: 'esc-001', caseId: 'case-0003', fromDepartmentId: 'dep-claims', fromTeamId: 'team-claims', toDepartmentId: 'dep-legal', toTeamId: 'team-legal', requestedOwnerId: 'usr-legal', previousOwnerId: 'usr-pic-2', status: 'IN_PROGRESS', reason: 'ต้องตรวจสอบข้อกำหนดและความรับผิดในกรณีการซ่อม', requestedBy: 'usr-sup-claims', createdAt: t('11-08 16:45'), updatedAt: t('11-08 17:30') },
  { id: 'esc-002', caseId: 'case-0008', fromDepartmentId: 'dep-claims', fromTeamId: 'team-claims', toDepartmentId: 'dep-underwriting', toTeamId: 'team-uw', requestedOwnerId: null, previousOwnerId: 'usr-pic-1', status: 'REQUESTED', reason: 'ขอให้ Underwriting ยืนยันทุนประกันและเงื่อนไขก่อนพิจารณาเคลมเสียหายสิ้นเชิง', requestedBy: 'usr-sup-claims', createdAt: t('11-09 08:00') },
  { id: 'esc-003', caseId: 'case-0014', fromDepartmentId: 'dep-service', fromTeamId: 'team-service', toDepartmentId: 'dep-legal', toTeamId: 'team-legal', requestedOwnerId: null, previousOwnerId: 'usr-pic-3', status: 'UNDER_REVIEW', reason: 'ลูกค้าแจ้งว่าจะร้องเรียนต่อ ขอให้ Compliance ตรวจสอบการตอบกลับก่อนติดต่อลูกค้า', requestedBy: 'usr-mgr-service', createdAt: t('11-09 07:30'), updatedAt: t('11-09 08:15') },
  { id: 'esc-004', caseId: 'case-0019', fromDepartmentId: 'dep-sales', fromTeamId: 'team-sales', toDepartmentId: 'dep-underwriting', toTeamId: 'team-uw', requestedOwnerId: 'usr-uw-1', previousOwnerId: 'usr-pic-9', status: 'ACCEPTED', reason: 'ทุนประกันเกินอำนาจฝ่ายขาย ต้องให้ Underwriting พิจารณารับประกัน', requestedBy: 'usr-mgr-sales', createdAt: t('11-07 11:00'), updatedAt: t('11-07 15:00') },
  { id: 'esc-005', caseId: 'case-0020', fromDepartmentId: 'dep-sales', fromTeamId: 'team-sales', toDepartmentId: 'dep-underwriting', toTeamId: 'team-uw', requestedOwnerId: null, previousOwnerId: 'usr-pic-9', status: 'RESOLVED', reason: 'ขอประเมินความเสี่ยงก่อนเพิ่มความคุ้มครองน้ำท่วม', requestedBy: 'usr-pic-9', createdAt: t('11-05 15:00'), updatedAt: t('11-06 09:30') },
  { id: 'esc-006', caseId: 'case-0021', fromDepartmentId: 'dep-sales', fromTeamId: 'team-sales', toDepartmentId: 'dep-legal', toTeamId: 'team-legal', requestedOwnerId: null, previousOwnerId: 'usr-pic-8', status: 'REJECTED', reason: 'ขอให้ตรวจถ้อยคำความคุ้มครองโจรกรรม', requestedBy: 'usr-pic-8', createdAt: t('11-03 16:00'), updatedAt: t('11-04 09:00'), decisionNote: 'เป็นคำถามทั่วไปตามเงื่อนไขมาตรฐาน ฝ่ายขายตอบได้เอง' },
];

const task = (
  id: string,
  caseId: string,
  escalationId: string | null,
  title: string,
  dep: string,
  team: string,
  userId: string | null,
  status: InternalTask['status'],
  due: string,
  created: string,
): InternalTask => ({
  id,
  caseId,
  escalationId,
  title,
  assignedDepartmentId: dep,
  assignedTeamId: team,
  assignedUserId: userId,
  status,
  dueAt: t(due),
  createdAt: t(created),
});

const tasks: InternalTask[] = [
  task('task-001', 'case-0003', 'esc-001', 'ตรวจสอบเงื่อนไขความคุ้มครอง', 'dep-legal', 'team-legal', 'usr-legal', 'IN_PROGRESS', '11-10 17:00', '11-08 17:15'),
  task('task-002', 'case-0003', 'esc-001', 'ร่างหนังสือตอบอู่ซ่อมเรื่องความรับผิด', 'dep-legal', 'team-legal', 'usr-legal-2', 'OPEN', '11-10 12:00', '11-08 17:20'),
  task('task-003', 'case-0019', 'esc-004', 'ตรวจสอบรายงานสำรวจภัยโรงงาน', 'dep-underwriting', 'team-uw', 'usr-uw-1', 'IN_PROGRESS', '11-10 17:00', '11-07 15:10'),
  task('task-004', 'case-0019', 'esc-004', 'ขอข้อมูลงบการเงินลูกค้า', 'dep-underwriting', 'team-uw', 'usr-uw-2', 'BLOCKED', '11-09 17:00', '11-07 15:20'),
  task('task-005', 'case-0007', null, 'ติดตามกำหนดส่งอะไหล่กับอู่', 'dep-claims', 'team-claims', 'usr-pic-1', 'IN_PROGRESS', '11-09 12:00', '11-08 09:10'),
  task('task-006', 'case-0009', null, 'ขอสำเนาใบแจ้งความกระเป๋าหาย', 'dep-claims', 'team-claims', 'usr-pic-4', 'OPEN', '11-10 17:00', '11-06 15:05'),
  task('task-007', 'case-0013', null, 'ตรวจสอบรายการตัดเบี้ยซ้ำกับฝ่ายบัญชี', 'dep-service', 'team-service', 'usr-pic-7', 'OPEN', '11-09 14:00', '11-09 07:20'),
  task('task-008', 'case-0020', 'esc-005', 'ประเมินความเสี่ยงความคุ้มครองน้ำท่วม', 'dep-underwriting', 'team-uw', 'usr-uw-1', 'DONE', '11-06 09:00', '11-05 15:30'),
  task('task-009', 'case-0011', null, 'ส่งเอกสารปิดเคลมให้ลูกค้า', 'dep-claims', 'team-claims', 'usr-pic-5', 'DONE', '11-03 18:00', '11-03 12:00'),
  task('task-010', 'case-0012', null, 'ออกเอกสารสลักหลัง', 'dep-service', 'team-service', 'usr-pic-6', 'IN_PROGRESS', '11-09 12:00', '11-08 13:30'),
  task('task-011', 'case-0014', 'esc-003', 'รวบรวมประวัติการติดต่อลูกค้า', 'dep-service', 'team-service', 'usr-pic-3', 'DONE', '11-09 09:00', '11-09 07:35'),
  task('task-012', 'case-0021', 'esc-006', 'ตรวจถ้อยคำความคุ้มครองโจรกรรม', 'dep-legal', 'team-legal', null, 'CANCELLED', '11-04 17:00', '11-03 16:05'),
];

const comments: InternalComment[] = [
  { id: 'cm-001', taskId: 'task-001', authorId: 'usr-legal', body: 'ตรวจเงื่อนไขหมวดความรับผิดต่อบุคคลภายนอกแล้ว รอเอกสารจากอู่เพิ่ม', createdAt: t('11-08 18:00') },
  { id: 'cm-002', taskId: 'task-003', authorId: 'usr-uw-1', body: 'รายงานสำรวจภัยยังขาดผังระบบดับเพลิง ขอให้ฝ่ายขายประสานลูกค้า', createdAt: t('11-08 10:00') },
  { id: 'cm-003', taskId: 'task-004', authorId: 'usr-uw-2', body: 'ลูกค้ายังไม่ส่งงบการเงินปีล่าสุด งานติดอยู่', createdAt: t('11-08 15:00') },
  { id: 'cm-004', taskId: 'task-011', authorId: 'usr-pic-3', body: 'สรุปประวัติการติดต่อ 3 วันย้อนหลังแนบไว้ในเคสแล้ว', createdAt: t('11-09 08:50') },
];

// ---- Timeline -------------------------------------------------------------
const originalTimeline: TimelineEvent[] = [
  { id: 'tl-001', caseId: 'case-0001', type: 'CASE_CREATED', label: 'สร้าง Case จาก Claims OA', createdAt: t('11-09 09:40') },
  { id: 'tl-002', caseId: 'case-0001', type: 'ASSIGNED', label: 'มอบหมาย PIC: Pimchanok', createdAt: t('11-09 09:45') },
  { id: 'tl-003', caseId: 'case-0003', type: 'ESCALATED', label: 'ส่งต่อภายในไปยัง Legal & Compliance', createdAt: t('11-08 16:45') },
];

const userName = new Map(users.map((x) => [x.id, x.name]));
const depName = new Map(departments.map((x) => [x.id, x.name]));
const chName = new Map(channels.map((x) => [x.id, x.name]));

const ESC_LABEL: Record<string, string> = {
  UNDER_REVIEW: 'กำลังพิจารณา',
  ACCEPTED: 'รับเรื่องแล้ว',
  IN_PROGRESS: 'กำลังดำเนินการ',
  RESOLVED: 'แก้ไขเสร็จแล้ว',
  REJECTED: 'ปฏิเสธ',
};

function buildTimeline(): TimelineEvent[] {
  const generated: Omit<TimelineEvent, 'id'>[] = [];
  for (const c of cases) {
    generated.push({ caseId: c.id, type: 'CASE_CREATED', label: `สร้าง Case จาก ${chName.get(c.originalChannelId)}`, createdAt: c.createdAt });
    const caseAssignments = assignments
      .filter((a) => a.caseId === c.id)
      .sort((a, b) => Date.parse(a.assignedAt) - Date.parse(b.assignedAt));
    caseAssignments.forEach((a, i) =>
      generated.push({
        caseId: c.id,
        type: i === 0 ? 'ASSIGNED' : 'REASSIGNED',
        label: `${i === 0 ? 'มอบหมาย' : 'เปลี่ยน'} PIC: ${userName.get(a.userId)}`,
        createdAt: a.assignedAt,
      }),
    );
    for (const e of escalations.filter((x) => x.caseId === c.id)) {
      generated.push({ caseId: c.id, type: 'ESCALATED', label: `ส่งต่อภายในไปยัง ${depName.get(e.toDepartmentId)}`, createdAt: e.createdAt });
      if (e.status !== 'REQUESTED' && e.updatedAt) {
        generated.push({ caseId: c.id, type: 'ESCALATION_UPDATED', label: `Escalation ${ESC_LABEL[e.status] ?? e.status}`, createdAt: e.updatedAt });
      }
    }
    for (const tk of tasks.filter((x) => x.caseId === c.id)) {
      generated.push({ caseId: c.id, type: 'TASK_CREATED', label: `สร้างงานภายใน: ${tk.title}`, createdAt: tk.createdAt ?? c.createdAt });
    }
    const row = caseRows.find((r) => r.conv === c.conversationId);
    if (row?.paused) generated.push({ caseId: c.id, type: 'STATUS_CHANGED', label: 'เปลี่ยนสถานะเป็น PENDING (หยุดนับ SLA)', createdAt: t(row.paused) });
    if (row?.resolved) generated.push({ caseId: c.id, type: 'STATUS_CHANGED', label: 'เปลี่ยนสถานะเป็น RESOLVED', createdAt: t(row.resolved) });
    if (row?.closed) generated.push({ caseId: c.id, type: 'STATUS_CHANGED', label: 'เปลี่ยนสถานะเป็น CLOSED', createdAt: t(row.closed) });
    if (c.status === 'REOPENED') generated.push({ caseId: c.id, type: 'STATUS_CHANGED', label: 'เปิด Case ใหม่ (REOPENED) — ลูกค้าแจ้งข้อมูลไม่ตรง', createdAt: t('11-09 08:45') });
  }
  // Keep the original three events; skip generated duplicates of them.
  const dup = (g: Omit<TimelineEvent, 'id'>) =>
    originalTimeline.some((o) => o.caseId === g.caseId && o.type === g.type);
  const extra = generated
    .filter((g) => !dup(g))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((g, i) => ({ ...g, id: `tl-${String(i + 4).padStart(3, '0')}` }));
  return [...originalTimeline, ...extra];
}

export const SEED: DemoData = {
  meta: {
    demoName: 'Jacky Central',
    version: 1,
    mode: 'MOCK_ONLY',
    notice: 'All records are fictional. No LINE OA is connected.',
  },
  departments,
  teams,
  users,
  channels,
  customers,
  conversations,
  messages,
  cases,
  assignments,
  escalations,
  tasks,
  comments,
  timeline: buildTimeline(),
  audit: [],
};

/** Fresh deep copy of the seed so mutations never touch the original object. */
export function cloneSeed(): DemoData {
  return structuredClone(SEED);
}
