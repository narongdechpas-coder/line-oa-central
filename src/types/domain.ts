// Shared domain types for the Jacky Central demo.
// Names and enums follow docs/handover/07_reference/api/openapi.yaml so a real
// API can replace the mock services later without renaming the domain.

export type ISODate = string;

export const ROLES = [
  'SUPER_ADMIN',
  'SYSTEM_ADMIN',
  'DEPARTMENT_ADMIN',
  'MANAGER',
  'SUPERVISOR',
  'PIC_AGENT',
  'AUDITOR',
] as const;
export type RoleCode = (typeof ROLES)[number];

export const AVAILABILITY = ['AVAILABLE', 'BUSY', 'AWAY', 'OFFLINE'] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const CONVERSATION_STATUSES = ['OPEN', 'PENDING', 'CLOSED'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const CASE_STATUSES = [
  'NEW',
  'TRIAGED',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ASSIGNMENT_TYPES = ['PRIMARY_PIC', 'SUPPORT', 'OBSERVER'] as const;
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

export const ESCALATION_STATUSES = [
  'REQUESTED',
  'UNDER_REVIEW',
  'ACCEPTED',
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED',
  'CANCELLED',
] as const;
export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];

export const TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const SLA_STATES = ['ON_TRACK', 'AT_RISK', 'BREACHED', 'PAUSED'] as const;
export type SlaState = (typeof SLA_STATES)[number];

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface Team {
  id: string;
  departmentId: string;
  name: string;
}

export interface DemoUser {
  id: string;
  name: string;
  role: RoleCode;
  departmentId: string | null;
  teamId: string | null;
  skills: string[];
  availability: Availability;
  /** 0–100, share of capacity in use. */
  workload: number;
  experienceYears: number;
}

export interface Channel {
  id: string;
  name: string;
  departmentId: string;
  status: 'SIMULATED';
  connection: 'NOT_CONNECTED';
  color: string;
}

export interface Customer {
  id: string;
  /** Identity is (channelId, lineUserId). Never merged across channels. */
  channelId: string;
  lineUserId: string;
  displayName: string;
  phone: string;
  tags: string[];
  firstSeenAt?: ISODate;
}

export interface Conversation {
  id: string;
  channelId: string;
  customerId: string;
  status: ConversationStatus;
  assignedUserId: string | null;
  lastMessageAt: ISODate;
  unread: number;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  text: string;
  createdAt: ISODate;
  /** Outbound messages are always simulated — never delivered to LINE. */
  simulated?: boolean;
  sentByUserId?: string | null;
}

export interface Case {
  id: string;
  caseNumber: string;
  conversationId: string;
  /** Immutable: copied from the conversation at creation. */
  readonly originalChannelId: string;
  /** Immutable: copied from the conversation at creation. */
  readonly originalCustomerId: string;
  title: string;
  description?: string;
  category: string;
  requiredSkills: string[];
  priority: Priority;
  status: CaseStatus;
  /** Status to return to when an active escalation ends. */
  statusBeforeEscalation?: CaseStatus | null;
  currentDepartmentId: string;
  currentTeamId: string | null;
  currentOwnerId: string | null;
  dueAt: ISODate;
  /** Set while the SLA clock is paused (status PENDING). */
  slaPausedAt?: ISODate | null;
  resolvedAt?: ISODate | null;
  closedAt?: ISODate | null;
  createdAt: ISODate;
}

export interface Assignment {
  id: string;
  caseId: string;
  userId: string;
  assignmentType: AssignmentType;
  isActive: boolean;
  assignedAt: ISODate;
  assignedBy?: string | null;
  reason?: string | null;
  recommendationScore?: number | null;
  unassignedAt?: ISODate | null;
}

export interface Escalation {
  id: string;
  caseId: string;
  fromDepartmentId: string;
  fromTeamId?: string | null;
  toDepartmentId: string;
  toTeamId: string | null;
  requestedOwnerId?: string | null;
  /** PIC before the handoff, restored when the escalation is resolved. */
  previousOwnerId?: string | null;
  status: EscalationStatus;
  reason: string;
  requestedBy: string;
  createdAt: ISODate;
  updatedAt?: ISODate;
  decisionNote?: string | null;
}

export interface InternalTask {
  id: string;
  caseId: string;
  escalationId?: string | null;
  title: string;
  description?: string;
  assignedDepartmentId: string;
  assignedTeamId: string | null;
  assignedUserId: string | null;
  status: TaskStatus;
  dueAt: ISODate;
  createdAt?: ISODate;
  createdBy?: string | null;
}

/** Internal-only. Never rendered in a customer conversation thread. */
export interface InternalComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: ISODate;
}

export type TimelineEventType =
  | 'CASE_CREATED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'ASSIGNED'
  | 'REASSIGNED'
  | 'ESCALATED'
  | 'ESCALATION_UPDATED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_COMMENTED'
  | 'REPLY_SIMULATED';

export interface TimelineEvent {
  id: string;
  caseId: string;
  type: TimelineEventType;
  label: string;
  actorId?: string | null;
  createdAt: ISODate;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  resourceType: 'CASE' | 'CONVERSATION' | 'ASSIGNMENT' | 'ESCALATION' | 'TASK' | 'DEMO';
  resourceId: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILURE';
  createdAt: ISODate;
}

export interface DemoData {
  meta: { demoName: string; version: number; mode: 'MOCK_ONLY'; notice: string };
  departments: Department[];
  teams: Team[];
  users: DemoUser[];
  channels: Channel[];
  customers: Customer[];
  conversations: Conversation[];
  messages: Message[];
  cases: Case[];
  assignments: Assignment[];
  escalations: Escalation[];
  tasks: InternalTask[];
  comments: InternalComment[];
  timeline: TimelineEvent[];
  audit: AuditEvent[];
}

/** Full persisted demo state: records plus the deterministic demo clock and ID counters. */
export interface DemoState {
  data: DemoData;
  /** Deterministic demo clock. Advances 1 minute per mutation and via "Advance demo time". */
  now: ISODate;
  /** Monotonic counter used to build stable IDs. */
  seq: number;
  /** User the demo is currently acting as (Demo Role Switcher). */
  actingUserId: string;
}
