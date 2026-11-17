// DEMO ROLE — permissions are simulated. This is UI behaviour only, not a security boundary.
// Model: RBAC (what a role may do) + resource scope (which records it may touch).
import type {
  Case,
  Conversation,
  Customer,
  CustomFieldDefinition,
  DemoData,
  DemoUser,
  Escalation,
  InternalTask,
  ProfileLink,
  RoleCode,
} from '../types/domain';
import { isEscalationActive } from './transitions';

export type Permission =
  | 'case.create'
  | 'case.update'
  | 'case.assign'
  | 'conversation.reply'
  | 'escalation.request'
  | 'escalation.decide'
  | 'escalation.work'
  | 'task.create'
  | 'task.update'
  | 'admin.view'
  | 'reports.view'
  | 'audit.view'
  | 'customer.edit'
  | 'customer.assignOwner'
  | 'customer.note'
  | 'field.manage'
  | 'profile.link.request'
  | 'profile.link.approve'
  | 'segment.manage'
  | 'pii.reveal';

const ALL_WORK: Permission[] = [
  'case.create',
  'case.update',
  'conversation.reply',
  'escalation.request',
  'task.create',
  'task.update',
];

export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  SUPER_ADMIN: [
    ...ALL_WORK, 'case.assign', 'escalation.decide', 'escalation.work', 'admin.view', 'reports.view', 'audit.view',
    'customer.edit', 'customer.assignOwner', 'customer.note', 'field.manage', 'profile.link.request', 'profile.link.approve', 'segment.manage', 'pii.reveal',
  ],
  SYSTEM_ADMIN: ['admin.view', 'reports.view', 'audit.view', 'field.manage'],
  DEPARTMENT_ADMIN: ['case.update', 'task.create', 'task.update', 'admin.view', 'reports.view', 'customer.edit', 'customer.assignOwner', 'field.manage', 'segment.manage'],
  MANAGER: [
    ...ALL_WORK, 'case.assign', 'escalation.decide', 'escalation.work', 'reports.view',
    'customer.edit', 'customer.assignOwner', 'customer.note', 'profile.link.request', 'profile.link.approve', 'segment.manage', 'pii.reveal',
  ],
  SUPERVISOR: [
    ...ALL_WORK, 'case.assign', 'escalation.decide', 'escalation.work', 'reports.view',
    'customer.edit', 'customer.assignOwner', 'customer.note', 'profile.link.request', 'pii.reveal',
  ],
  PIC_AGENT: [...ALL_WORK, 'escalation.work', 'customer.edit', 'customer.note', 'pii.reveal'],
  // Auditor may reveal PII to inspect records (audited) but cannot change anything.
  AUDITOR: ['admin.view', 'reports.view', 'audit.view', 'pii.reveal'],
};

export type ScopeType = 'ALL' | 'DEPARTMENT' | 'ASSIGNED_RESOURCE';

export const ROLE_SCOPE: Record<RoleCode, ScopeType> = {
  SUPER_ADMIN: 'ALL',
  SYSTEM_ADMIN: 'ALL',
  AUDITOR: 'ALL',
  DEPARTMENT_ADMIN: 'DEPARTMENT',
  MANAGER: 'DEPARTMENT',
  SUPERVISOR: 'DEPARTMENT',
  PIC_AGENT: 'ASSIGNED_RESOURCE',
};

export const ROLE_LABEL: Record<RoleCode, string> = {
  SUPER_ADMIN: 'Super Admin',
  SYSTEM_ADMIN: 'System Admin',
  DEPARTMENT_ADMIN: 'Department Admin',
  MANAGER: 'Manager',
  SUPERVISOR: 'Supervisor',
  PIC_AGENT: 'PIC / Agent',
  AUDITOR: 'Auditor',
};

export const isReadOnlyRole = (role: RoleCode) => !ROLE_PERMISSIONS[role].some((p) => ALL_WORK.includes(p));

export const can = (user: DemoUser, p: Permission): boolean => ROLE_PERMISSIONS[user.role].includes(p);

// ---- Resource scope ---------------------------------------------------------

function caseTouchesDepartment(data: DemoData, c: Case, depId: string): boolean {
  if (c.currentDepartmentId === depId) return true;
  const ch = data.channels.find((x) => x.id === c.originalChannelId);
  if (ch?.departmentId === depId) return true;
  return data.escalations.some(
    (e) => e.caseId === c.id && (e.toDepartmentId === depId || e.fromDepartmentId === depId),
  );
}

function caseAssignedTo(data: DemoData, c: Case, userId: string): boolean {
  if (c.currentOwnerId === userId) return true;
  if (data.tasks.some((t) => t.caseId === c.id && t.assignedUserId === userId)) return true;
  return data.escalations.some((e) => e.caseId === c.id && e.requestedOwnerId === userId && isEscalationActive(e.status));
}

export function canSeeCase(data: DemoData, user: DemoUser, c: Case): boolean {
  switch (ROLE_SCOPE[user.role]) {
    case 'ALL':
      return true;
    case 'DEPARTMENT':
      return !!user.departmentId && caseTouchesDepartment(data, c, user.departmentId);
    case 'ASSIGNED_RESOURCE':
      return caseAssignedTo(data, c, user.id);
  }
}

export function canSeeConversation(data: DemoData, user: DemoUser, conv: Conversation): boolean {
  switch (ROLE_SCOPE[user.role]) {
    case 'ALL':
      return true;
    case 'DEPARTMENT': {
      const ch = data.channels.find((x) => x.id === conv.channelId);
      if (ch && ch.departmentId === user.departmentId) return true;
      break;
    }
    case 'ASSIGNED_RESOURCE':
      if (conv.assignedUserId === user.id) return true;
      break;
  }
  return data.cases.some((c) => c.conversationId === conv.id && canSeeCase(data, user, c));
}

export function canSeeTask(data: DemoData, user: DemoUser, t: InternalTask): boolean {
  if (ROLE_SCOPE[user.role] === 'ALL') return true;
  if (ROLE_SCOPE[user.role] === 'DEPARTMENT' && t.assignedDepartmentId === user.departmentId) return true;
  if (t.assignedUserId === user.id) return true;
  const c = data.cases.find((x) => x.id === t.caseId);
  return !!c && canSeeCase(data, user, c);
}

// ---- Action checks (permission + scope) ------------------------------------

/** Work on a case: PIC only on cases they own; department roles on cases in scope. */
export function canWorkOnCase(data: DemoData, user: DemoUser, c: Case, p: Permission): boolean {
  if (!can(user, p) || !canSeeCase(data, user, c)) return false;
  if (ROLE_SCOPE[user.role] === 'ASSIGNED_RESOURCE' && p !== 'task.update') return c.currentOwnerId === user.id;
  return true;
}

/** Review / accept / reject: manager or supervisor of the TARGET department (or Super Admin). */
export function canDecideEscalation(user: DemoUser, e: Escalation): boolean {
  if (!can(user, 'escalation.decide')) return false;
  return ROLE_SCOPE[user.role] === 'ALL' || user.departmentId === e.toDepartmentId;
}

/** Start / resolve: target department managers/supervisors, or the case owner working it. */
export function canWorkEscalation(data: DemoData, user: DemoUser, e: Escalation): boolean {
  if (!can(user, 'escalation.work')) return false;
  if (ROLE_SCOPE[user.role] === 'ALL') return true;
  if (user.role !== 'PIC_AGENT') return user.departmentId === e.toDepartmentId;
  const c = data.cases.find((x) => x.id === e.caseId);
  return c?.currentOwnerId === user.id;
}

/** Cancel: the requester, managers/supervisors of the source department, or Super Admin. */
export function canCancelEscalation(user: DemoUser, e: Escalation): boolean {
  if (ROLE_SCOPE[user.role] === 'ALL' && can(user, 'escalation.decide')) return true;
  if (e.requestedBy === user.id) return true;
  return can(user, 'escalation.decide') && user.departmentId === e.fromDepartmentId;
}

export function canUpdateTask(data: DemoData, user: DemoUser, t: InternalTask): boolean {
  if (!can(user, 'task.update') || !canSeeTask(data, user, t)) return false;
  if (ROLE_SCOPE[user.role] !== 'ASSIGNED_RESOURCE') return true;
  const c = data.cases.find((x) => x.id === t.caseId);
  return t.assignedUserId === user.id || c?.currentOwnerId === user.id;
}

// ---- Customers (CDP-lite) ----------------------------------------------------------

const channelDept = (data: DemoData, channelId: string) => data.channels.find((c) => c.id === channelId)?.departmentId ?? null;

/** PIC "own" customer: they are the Customer Owner, or handle the customer's conversation. */
function isOwnCustomer(data: DemoData, user: DemoUser, c: Customer): boolean {
  if (c.ownerUserId === user.id) return true;
  return data.conversations.some((v) => v.customerId === c.id && v.assignedUserId === user.id);
}

export function canSeeCustomer(data: DemoData, user: DemoUser, c: Customer): boolean {
  switch (ROLE_SCOPE[user.role]) {
    case 'ALL':
      return true;
    case 'DEPARTMENT':
      if (channelDept(data, c.channelId) === user.departmentId) return true;
      break;
    case 'ASSIGNED_RESOURCE':
      if (isOwnCustomer(data, user, c)) return true;
      break;
  }
  return data.cases.some((k) => k.originalCustomerId === c.id && canSeeCase(data, user, k));
}

/** Edit tags / custom fields. Each field is further limited by its editableByRoles. */
export function canEditCustomer(data: DemoData, user: DemoUser, c: Customer): boolean {
  if (!can(user, 'customer.edit') || !canSeeCustomer(data, user, c)) return false;
  if (ROLE_SCOPE[user.role] === 'ASSIGNED_RESOURCE') return isOwnCustomer(data, user, c);
  if (ROLE_SCOPE[user.role] === 'DEPARTMENT') return channelDept(data, c.channelId) === user.departmentId;
  return true;
}

export const canEditField = (user: DemoUser, def: CustomFieldDefinition) => def.active && def.editableByRoles.includes(user.role);

/** Customer Owner is assigned within the department that owns the customer's OA. */
export function canAssignCustomerOwner(data: DemoData, user: DemoUser, c: Customer): boolean {
  if (!can(user, 'customer.assignOwner')) return false;
  return ROLE_SCOPE[user.role] === 'ALL' || channelDept(data, c.channelId) === user.departmentId;
}

export function canAddCustomerNote(data: DemoData, user: DemoUser, c: Customer): boolean {
  if (!can(user, 'customer.note') || !canSeeCustomer(data, user, c)) return false;
  return ROLE_SCOPE[user.role] !== 'ASSIGNED_RESOURCE' || isOwnCustomer(data, user, c);
}

export function canRevealPii(data: DemoData, user: DemoUser, c: Customer): boolean {
  if (!can(user, 'pii.reveal') || !canSeeCustomer(data, user, c)) return false;
  return ROLE_SCOPE[user.role] !== 'ASSIGNED_RESOURCE' || isOwnCustomer(data, user, c);
}

/** Department Admins manage fields only for OAs of their own department; ALL-scope roles manage any. */
export function canManageField(data: DemoData, user: DemoUser, def?: Pick<CustomFieldDefinition, 'channelIds'>): boolean {
  if (!can(user, 'field.manage')) return false;
  if (ROLE_SCOPE[user.role] === 'ALL') return true;
  if (!def) return true;
  if (def.channelIds === 'ALL') return false;
  return def.channelIds.every((ch) => channelDept(data, ch) === user.departmentId);
}

export function canRequestLink(data: DemoData, user: DemoUser, c: Customer): boolean {
  return can(user, 'profile.link.request') && canSeeCustomer(data, user, c);
}

/** Approver: Manager of the department owning either OA, or Super Admin. Never the requester. */
export function canDecideLink(data: DemoData, user: DemoUser, link: ProfileLink): boolean {
  if (!can(user, 'profile.link.approve') || link.requestedBy === user.id) return false;
  if (ROLE_SCOPE[user.role] === 'ALL') return true;
  const a = data.customers.find((c) => c.id === link.customerAId);
  const b = data.customers.find((c) => c.id === link.customerBId);
  return [a, b].some((c) => c && channelDept(data, c.channelId) === user.departmentId);
}

/** Unlink: anyone who could request a link on either side. */
export function canUnlink(data: DemoData, user: DemoUser, link: ProfileLink): boolean {
  if (!can(user, 'profile.link.request')) return false;
  return [link.customerAId, link.customerBId].some((id) => {
    const c = data.customers.find((x) => x.id === id);
    return !!c && canSeeCustomer(data, user, c);
  });
}
