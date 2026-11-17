// Customer Management / CDP-lite seed. ALL RECORDS ARE FICTIONAL.
// Policy numbers, dates and consent texts are examples for the demo, not real products or legal text.

import type {
  ConsentNotice,
  ConsentPurpose,
  ConsentRecord,
  Conversation,
  Customer,
  CustomerNote,
  CustomerOwnerAssignment,
  CustomFieldDefinition,
  CustomFieldValue,
  Message,
  Policy,
  ProfileLink,
  Segment,
} from '../types/domain';

const t = (mdhm: string, year = 2026): string => {
  const [md, hm] = mdhm.split(' ');
  return `${year}-${md}T${hm ?? '00:00'}:00+07:00`;
};
const d = (ymd: string) => `${ymd}T00:00:00+07:00`;

// ---- Custom fields ---------------------------------------------------------------
const WORKERS = ['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'MANAGER', 'SUPERVISOR', 'PIC_AGENT'] as const;

export const customFieldDefs: CustomFieldDefinition[] = [
  { id: 'cf-contact-pref', key: 'contactPref', label: 'ช่องทางติดต่อที่สะดวก', type: 'SELECT', options: ['LINE', 'โทรศัพท์', 'อีเมล'], channelIds: 'ALL', editableByRoles: [...WORKERS], isPII: false, required: false, active: true },
  { id: 'cf-vip', key: 'vip', label: 'ลูกค้า VIP', type: 'BOOLEAN', channelIds: 'ALL', editableByRoles: ['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'MANAGER'], isPII: false, required: false, active: true },
  { id: 'cf-language', key: 'language', label: 'ภาษาที่ใช้สื่อสาร', type: 'SELECT', options: ['ไทย', 'English', '日本語'], channelIds: 'ALL', editableByRoles: [...WORKERS], isPII: false, required: false, active: true },
  { id: 'cf-birthdate', key: 'birthDate', label: 'วันเกิด', type: 'DATE', channelIds: 'ALL', editableByRoles: ['SUPER_ADMIN', 'MANAGER', 'SUPERVISOR', 'PIC_AGENT'], isPII: true, required: false, active: true },
  { id: 'cf-garage', key: 'preferredGarage', label: 'อู่ที่ลูกค้าเลือก', type: 'TEXT', channelIds: ['ch-claims'], editableByRoles: [...WORKERS], isPII: false, required: false, active: true },
  { id: 'cf-budget', key: 'premiumBudget', label: 'งบเบี้ยที่สนใจ (ตัวเลือกสมมติ)', type: 'SELECT', options: ['ต่ำกว่า 10,000', '10,000–20,000', 'มากกว่า 20,000'], channelIds: ['ch-sales'], editableByRoles: [...WORKERS], isPII: false, required: false, active: true },
];

/** customerId → field values */
export const customFieldValues: Record<string, Record<string, CustomFieldValue>> = {
  'cus-001': { contactPref: 'LINE', language: 'ไทย', preferredGarage: 'อู่ตัวอย่าง A' },
  'cus-002': { contactPref: 'โทรศัพท์', vip: true, birthDate: '1985-04-12' },
  'cus-006': { contactPref: 'LINE', vip: true, preferredGarage: 'อู่ตัวอย่าง B' },
  'cus-009': { contactPref: 'โทรศัพท์', language: 'ไทย' },
  'cus-016': { contactPref: 'โทรศัพท์', language: 'ไทย' },
  'cus-020': { premiumBudget: '10,000–20,000', contactPref: 'LINE' },
  'cus-024': { vip: true, language: 'English', premiumBudget: 'มากกว่า 20,000' },
  'cus-030': { premiumBudget: 'ต่ำกว่า 10,000' },
};

// ---- Extra customers (no conversation yet: followed the OA and accepted consent) ----------
export const extraCustomers: Customer[] = [
  // Same person as cus-001 (Claims OA), different LINE display name on Sales OA.
  { id: 'cus-035', channelId: 'ch-sales', lineUserId: 'U-DEMO-3010', displayName: 'Krit K.', phone: '08X-XXX-3010', tags: ['Prospect'], firstSeenAt: t('11-08 18:00') },
  // Same person as cus-004 (Claims OA) on Service OA. Withdrew the linking purpose.
  { id: 'cus-036', channelId: 'ch-service', lineUserId: 'U-DEMO-2012', displayName: 'Nicha N.', phone: '08X-XXX-2012', tags: ['Policy'], firstSeenAt: t('10-20 11:00') },
];

// ---- Customer owners ------------------------------------------------------------------
// [customerId, userId, assignedAt]
const ownerRows: [string, string, string][] = [
  ['cus-001', 'usr-pic-1', '09-01 10:00'],
  ['cus-004', 'usr-pic-2', '09-01 10:00'],
  ['cus-006', 'usr-pic-1', '09-15 10:00'],
  ['cus-007', 'usr-pic-5', '10-01 10:00'],
  ['cus-008', 'usr-pic-1', '10-01 10:00'],
  ['cus-009', 'usr-pic-1', '10-05 10:00'],
  ['cus-012', 'usr-pic-5', '10-05 10:00'],
  ['cus-027', 'usr-pic-2', '10-10 10:00'],
  ['cus-031', 'usr-pic-5', '10-10 10:00'],
  ['cus-002', 'usr-pic-3', '09-01 10:00'],
  ['cus-013', 'usr-pic-6', '09-20 10:00'],
  ['cus-014', 'usr-pic-7', '10-01 10:00'],
  ['cus-015', 'usr-pic-6', '10-01 10:00'],
  ['cus-016', 'usr-pic-3', '11-09 07:40'],
  ['cus-018', 'usr-pic-7', '10-15 10:00'],
  ['cus-003', 'usr-pic-9', '09-01 10:00'],
  ['cus-020', 'usr-pic-8', '11-08 16:10'],
  ['cus-022', 'usr-pic-9', '09-01 10:00'],
  ['cus-024', 'usr-pic-9', '11-07 09:10'],
  ['cus-026', 'usr-pic-9', '10-20 10:00'],
  // Owners in Marketing although the customer contacted Claims / Sales OA (owner may be in any department)
  ['cus-033', 'usr-mkt-1', '10-15 10:00'],
  ['cus-030', 'usr-mkt-2', '10-15 10:00'],
];

export const ownerAssignments: CustomerOwnerAssignment[] = [
  // history: cus-016 was owned by Kanokwan before the complaint was handed to Siriporn
  { id: 'ow-001', customerId: 'cus-016', userId: 'usr-pic-7', isActive: false, assignedAt: t('10-01 10:00'), assignedBy: 'usr-mgr-service', endedAt: t('11-09 07:40') },
  ...ownerRows.map(([customerId, userId, at], i) => ({
    id: `ow-${String(i + 2).padStart(3, '0')}`,
    customerId,
    userId,
    isActive: true,
    assignedAt: t(at),
    assignedBy: null,
    reason: customerId === 'cus-016' ? 'ย้ายให้ผู้ดูแลเรื่องร้องเรียน' : null,
  })),
];

export const ownerOf = new Map(ownerRows.map(([c, u]) => [c, u]));

// ---- Internal notes ----------------------------------------------------------------------
export const customerNotes: CustomerNote[] = [
  { id: 'cn-001', customerId: 'cus-016', authorId: 'usr-mgr-service', body: 'ลูกค้าเคยร้องเรียนเรื่องติดต่อกลับช้า ควรโทรกลับภายในวันเดียวกัน', pinned: true, createdAt: t('11-09 07:45') },
  { id: 'cn-002', customerId: 'cus-024', authorId: 'usr-pic-9', body: 'ลูกค้า SME ทุนสูง ต้องประสาน Underwriting ทุกครั้งก่อนเสนอราคา', pinned: true, createdAt: t('11-07 09:20') },
  { id: 'cn-003', customerId: 'cus-006', authorId: 'usr-pic-1', body: 'ลูกค้ามีทั้งประกันรถและประกันบ้าน', pinned: false, createdAt: t('10-02 14:00') },
  { id: 'cn-004', customerId: 'cus-001', authorId: 'usr-pic-1', body: 'ชอบให้ติดต่อทาง LINE มากกว่าโทร', pinned: false, createdAt: t('09-10 11:00') },
];

// ---- Policies (mock) ---------------------------------------------------------------------
const PRODUCT: Record<string, string> = {
  MTR: 'ประกันรถยนต์ (ตัวอย่าง)',
  HOM: 'ประกันบ้าน (ตัวอย่าง)',
  TRV: 'ประกันเดินทาง (ตัวอย่าง)',
  PA: 'ประกันอุบัติเหตุส่วนบุคคล (ตัวอย่าง)',
};
// [customerId, product code, status, effective, expiry]
const policyRows: [string, keyof typeof PRODUCT, Policy['status'], string, string][] = [
  ['cus-001', 'MTR', 'ACTIVE', '2026-03-01', '2027-03-01'],
  ['cus-002', 'MTR', 'ACTIVE', '2025-11-30', '2026-11-30'],
  ['cus-003', 'MTR', 'ACTIVE', '2025-11-28', '2026-11-28'],
  ['cus-004', 'MTR', 'ACTIVE', '2026-06-15', '2027-06-15'],
  ['cus-005', 'MTR', 'ACTIVE', '2026-02-10', '2027-02-10'],
  ['cus-006', 'MTR', 'ACTIVE', '2026-05-01', '2027-05-01'],
  ['cus-006', 'HOM', 'ACTIVE', '2025-12-01', '2026-12-01'],
  ['cus-007', 'HOM', 'ACTIVE', '2026-01-20', '2027-01-20'],
  ['cus-008', 'MTR', 'ACTIVE', '2026-04-05', '2027-04-05'],
  ['cus-009', 'MTR', 'ACTIVE', '2026-07-01', '2027-07-01'],
  ['cus-010', 'TRV', 'ACTIVE', '2026-11-01', '2026-11-15'],
  ['cus-011', 'MTR', 'ACTIVE', '2026-08-20', '2027-08-20'],
  ['cus-012', 'HOM', 'ACTIVE', '2026-02-01', '2027-02-01'],
  ['cus-013', 'MTR', 'ACTIVE', '2026-09-01', '2027-09-01'],
  ['cus-014', 'MTR', 'ACTIVE', '2026-10-15', '2027-10-15'],
  ['cus-015', 'MTR', 'ACTIVE', '2026-11-04', '2027-11-04'],
  ['cus-016', 'MTR', 'ACTIVE', '2026-01-10', '2027-01-10'],
  ['cus-017', 'MTR', 'CANCELLED', '2026-03-15', '2027-03-15'],
  ['cus-018', 'HOM', 'ACTIVE', '2026-04-01', '2027-04-01'],
  ['cus-019', 'PA', 'ACTIVE', '2026-06-01', '2027-06-01'],
  ['cus-022', 'HOM', 'EXPIRED', '2025-11-06', '2026-11-06'],
  ['cus-022', 'HOM', 'ACTIVE', '2026-11-06', '2027-11-06'],
  ['cus-026', 'MTR', 'ACTIVE', '2025-12-05', '2026-12-05'],
  ['cus-027', 'MTR', 'ACTIVE', '2026-05-20', '2027-05-20'],
  ['cus-028', 'HOM', 'ACTIVE', '2026-02-14', '2027-02-14'],
  ['cus-029', 'MTR', 'ACTIVE', '2026-07-07', '2027-07-07'],
  ['cus-031', 'HOM', 'ACTIVE', '2026-03-30', '2027-03-30'],
  ['cus-032', 'PA', 'ACTIVE', '2025-12-10', '2026-12-10'],
  ['cus-033', 'MTR', 'ACTIVE', '2026-01-25', '2027-01-25'],
  ['cus-034', 'MTR', 'ACTIVE', '2026-08-08', '2027-08-08'],
];

export const policies: Policy[] = policyRows.map(([customerId, code, status, eff, exp], i) => ({
  id: `pol-${String(i + 1).padStart(3, '0')}`,
  customerId,
  policyNo: `DEMO-${code}-${String(i + 1).padStart(4, '0')}`,
  product: PRODUCT[code]!,
  status,
  effectiveDate: d(eff),
  expiryDate: d(exp),
}));

// ---- Consent notices (EXAMPLE TEXT — not legal wording) ---------------------------------
const commonBody = (service: string) =>
  `ตัวอย่างข้อความ (ไม่ใช่ข้อความทางกฎหมาย)\n\nบริษัทจะเก็บและใช้ข้อมูลของท่านเท่าที่จำเป็นเพื่อ${service}ตามที่ท่านขอรับบริการผ่าน LINE OA นี้ ` +
  'ท่านเลือกได้ว่าจะยินยอมให้เชื่อมข้อมูลกับบริการอื่นของบริษัทเพื่อให้บริการต่อเนื่องหรือไม่ ' +
  'และถอนความยินยอมได้ทุกเมื่อผ่านเมนูใน LINE OA';

export const consentNotices: ConsentNotice[] = [
  {
    id: 'cnt-claims-v1',
    channelId: 'ch-claims',
    version: '1.0',
    title: 'ความยินยอมการใช้ข้อมูล — บริการเคลม',
    body: commonBody('พิจารณาและติดตามการเคลม'),
    purposes: [
      { purpose: 'SERVICE_DELIVERY', required: true },
      { purpose: 'CLAIMS_PROCESSING', required: true },
      { purpose: 'CROSS_SERVICE_LINKING', required: false },
      { purpose: 'MARKETING', required: false },
    ],
    dataCategories: ['IDENTITY', 'CONTACT', 'POLICY', 'CLAIM_DETAIL', 'CONVERSATION'],
    retentionText: 'ตัวอย่าง: เก็บตลอดอายุกรมธรรม์และตามระยะเวลาที่กฎหมายกำหนด',
    effectiveFrom: d('2026-01-01'),
  },
  {
    id: 'cnt-service-v1',
    channelId: 'ch-service',
    version: '1.0',
    title: 'ความยินยอมการใช้ข้อมูล — บริการลูกค้า',
    body: commonBody('ให้บริการเกี่ยวกับกรมธรรม์'),
    purposes: [
      { purpose: 'SERVICE_DELIVERY', required: true },
      { purpose: 'POLICY_SERVICING', required: true },
      { purpose: 'CROSS_SERVICE_LINKING', required: false },
      { purpose: 'MARKETING', required: false },
    ],
    dataCategories: ['IDENTITY', 'CONTACT', 'POLICY', 'CONVERSATION'],
    retentionText: 'ตัวอย่าง: เก็บตลอดอายุกรมธรรม์และตามระยะเวลาที่กฎหมายกำหนด',
    effectiveFrom: d('2026-01-01'),
  },
  {
    id: 'cnt-sales-v1',
    channelId: 'ch-sales',
    version: '1.0',
    title: 'ความยินยอมการใช้ข้อมูล — ขอใบเสนอราคา',
    body: commonBody('จัดทำใบเสนอราคา'),
    purposes: [
      { purpose: 'SERVICE_DELIVERY', required: true },
      { purpose: 'SALES_QUOTATION', required: true },
      { purpose: 'CROSS_SERVICE_LINKING', required: false },
      { purpose: 'MARKETING', required: false },
    ],
    // Sales does not collect policy or claim data — a linked profile seen from here shows none.
    dataCategories: ['IDENTITY', 'CONTACT', 'CONVERSATION'],
    retentionText: 'ตัวอย่าง: เก็บ 1 ปีนับจากวันที่ขอใบเสนอราคา',
    effectiveFrom: d('2026-01-01'),
  },
];

// ---- Consent records --------------------------------------------------------------------
const CROSS = new Set(['cus-001', 'cus-002', 'cus-004', 'cus-006', 'cus-008', 'cus-012', 'cus-013', 'cus-015', 'cus-022', 'cus-035', 'cus-036']);
const MARKETING = new Set(['cus-002', 'cus-020', 'cus-022']);
/** Withdrew CROSS_SERVICE_LINKING after granting it. */
const WITHDREW_CROSS: Record<string, string> = { 'cus-036': '11-07 15:00' };

export function buildConsentRecords(customers: Customer[], conversations: Conversation[], messages: Message[]): ConsentRecord[] {
  return customers.map((c, i) => {
    const notice = consentNotices.find((n) => n.channelId === c.channelId)!;
    const conv = conversations.find((x) => x.customerId === c.id);
    const firstMsg = conv
      ? messages.filter((m) => m.conversationId === conv.id).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0]
      : undefined;
    const grantedAt = firstMsg ? new Date(Date.parse(firstMsg.createdAt) - 2 * 60_000).toISOString() : (c.firstSeenAt ?? t('10-01 10:00'));
    const required = notice.purposes.filter((p) => p.required).map((p) => p.purpose);
    const optional: ConsentPurpose[] = [];
    if (CROSS.has(c.id)) optional.push('CROSS_SERVICE_LINKING');
    if (MARKETING.has(c.id)) optional.push('MARKETING');
    const history: ConsentRecord['history'] = [{ at: grantedAt, action: 'GRANTED', purposes: [...required, ...optional], source: 'SIMULATED_CUSTOMER_ACTION' }];
    let granted = [...required, ...optional];
    const withdrewAt = WITHDREW_CROSS[c.id];
    if (withdrewAt) {
      granted = granted.filter((p) => p !== 'CROSS_SERVICE_LINKING');
      history.push({ at: t(withdrewAt), action: 'WITHDRAWN', purposes: ['CROSS_SERVICE_LINKING'], source: 'SIMULATED_CUSTOMER_ACTION' });
    }
    return {
      id: `cr-${String(i + 1).padStart(3, '0')}`,
      customerId: c.id,
      noticeId: notice.id,
      noticeVersion: notice.version,
      status: 'GRANTED',
      grantedPurposes: granted,
      grantedAt,
      evidenceConversationId: conv?.id ?? null,
      history,
    };
  });
}

// ---- Profile links ------------------------------------------------------------------------
export function buildProfileLinks(records: ConsentRecord[]): ProfileLink[] {
  const rec = (cid: string) => records.find((r) => r.customerId === cid)!.id;
  return [
    {
      id: 'pl-001',
      customerAId: 'cus-002',
      customerBId: 'cus-006',
      status: 'APPROVED',
      reason: 'ลูกค้ายืนยันทางโทรศัพท์ว่าเป็นคนเดียวกัน มีทั้งงานบริการกรมธรรม์และงานเคลม',
      requestedBy: 'usr-mgr-service',
      requestedAt: t('11-05 10:00'),
      consentRecordIds: [rec('cus-002'), rec('cus-006')],
      decidedBy: 'usr-manager',
      decidedAt: t('11-05 14:00'),
      decisionNote: 'ตรวจ consent ทั้งสองฝั่งครบ',
    },
    {
      id: 'pl-002',
      customerAId: 'cus-001',
      customerBId: 'cus-035',
      status: 'REQUESTED',
      reason: 'ลูกค้าแจ้งในแชทว่าเพิ่งทัก Sales OA เพื่อขอราคาประกันคันที่สอง',
      requestedBy: 'usr-sup-claims',
      requestedAt: t('11-08 18:30'),
      consentRecordIds: [rec('cus-001'), rec('cus-035')],
    },
    {
      id: 'pl-003',
      customerAId: 'cus-004',
      customerBId: 'cus-036',
      status: 'SUSPENDED',
      reason: 'ลูกค้าคนเดียวกันติดต่อทั้งเรื่องซ่อมรถและเรื่องกรมธรรม์',
      requestedBy: 'usr-sup-claims',
      requestedAt: t('11-02 10:00'),
      consentRecordIds: [rec('cus-004'), rec('cus-036')],
      decidedBy: 'usr-mgr-service',
      decidedAt: t('11-03 09:00'),
      endedAt: t('11-07 15:00'),
      endReason: 'ระงับอัตโนมัติ: ลูกค้าถอนความยินยอมการเชื่อมข้อมูล',
    },
  ];
}

// ---- Segments -------------------------------------------------------------------------------
export const segments: Segment[] = [
  { id: 'seg-001', name: 'กรมธรรม์หมดอายุใน 30 วัน', description: 'ใช้วางแผนติดตามการต่ออายุ', rules: [{ kind: 'POLICY_EXPIRES_WITHIN', days: 30 }], ownerDepartmentId: null, createdBy: 'usr-admin', createdAt: t('11-01 09:00') },
  { id: 'seg-002', name: 'ลูกค้า Claims OA ที่มี Case เปิดอยู่', rules: [{ kind: 'CHANNEL', channelId: 'ch-claims' }, { kind: 'HAS_OPEN_CASE', value: true }], ownerDepartmentId: 'dep-claims', createdBy: 'usr-manager', createdAt: t('11-01 09:00') },
  { id: 'seg-003', name: 'ลูกค้าที่ยังไม่มีผู้ดูแลหลัก', rules: [{ kind: 'OWNER', ownerUserId: null }], ownerDepartmentId: null, createdBy: 'usr-admin', createdAt: t('11-01 09:00') },
];
