// DEMO ROLE — permissions are simulated. This is UI behaviour only, not a security boundary.
// Model: RBAC (what a role may do) + resource scope (which records it may touch).
import type { Case, Conversation, DemoData, DemoUser, Escalation, InternalTask, RoleCode } from '../types/domain';
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
  | 'audit.view';

const ALL_WORK: Permission[] = [
  'case.create',
  'case.update',
  'conversation.reply',
  'escalation.request',
  'task.create',
  'task.update',
];

export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  SUPER_ADMIN: [...ALL_WORK, 'case.assign', 'escalation.decide', 'escalation.work', 'admin.view', 'reports.view', 'audit.view'],
  SYSTEM_ADMIN: ['admin.view', 'reports.view', 'audit.view'],
  DEPARTMENT_ADMIN: ['case.update', 'task.create', 'task.update', 'admin.view', 'reports.view'],
  MANAGER: [...ALL_WORK, 'case.assign', 'escalation.decide', 'escalation.work', 'reports.view'],
  SUPERVISOR: [...ALL_WORK, 'case.assign', 'escalation.decide', 'escalation.work', 'reports.view'],
  PIC_AGENT: [...ALL_WORK, 'escalation.work'],
  AUDITOR: ['admin.view', 'reports.view', 'audit.view'],
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
