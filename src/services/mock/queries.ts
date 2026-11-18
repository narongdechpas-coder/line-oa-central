// Read-side mock services. Pure functions over DemoData, scoped to the acting demo user.
import type { Case, Conversation, ConversationStatus, Customer, DataCategory, DemoData, DemoUser, Message, ProfileLink } from '../../types/domain';
import { canSeeCase, canSeeConversation, canSeeCustomer } from '../../utils/permissions';
import { shareableCategories } from '../../utils/consent';
import { matchesAll } from '../../utils/segments';

export interface ConversationFilters {
  channelId?: string | 'ALL';
  status?: ConversationStatus | 'ALL';
  assignedUserId?: string | 'ALL' | 'UNASSIGNED';
  departmentId?: string | 'ALL';
  search?: string;
}

export function listConversations(data: DemoData, user: DemoUser, f: ConversationFilters = {}): Conversation[] {
  const q = f.search?.trim().toLowerCase();
  return data.conversations
    .filter((c) => canSeeConversation(data, user, c))
    .filter((c) => !f.channelId || f.channelId === 'ALL' || c.channelId === f.channelId)
    .filter((c) => !f.status || f.status === 'ALL' || c.status === f.status)
    .filter((c) => {
      if (!f.assignedUserId || f.assignedUserId === 'ALL') return true;
      if (f.assignedUserId === 'UNASSIGNED') return !c.assignedUserId;
      return c.assignedUserId === f.assignedUserId;
    })
    .filter((c) => {
      if (!f.departmentId || f.departmentId === 'ALL') return true;
      return data.channels.find((ch) => ch.id === c.channelId)?.departmentId === f.departmentId;
    })
    .filter((c) => {
      if (!q) return true;
      const cus = data.customers.find((x) => x.id === c.customerId);
      const lastText = lastMessage(data, c.id)?.text ?? '';
      return `${cus?.displayName ?? ''} ${cus?.lineUserId ?? ''} ${lastText}`.toLowerCase().includes(q);
    })
    .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
}

export function getConversation(data: DemoData, id: string) {
  const conversation = data.conversations.find((c) => c.id === id);
  if (!conversation) return null;
  return {
    conversation,
    customer: data.customers.find((c) => c.id === conversation.customerId) ?? null,
    channel: data.channels.find((c) => c.id === conversation.channelId) ?? null,
    messages: messagesOf(data, id),
    cases: data.cases.filter((c) => c.conversationId === id),
  };
}

/** Customer-facing thread only: messages. Internal comments/tasks are never part of it. */
export const messagesOf = (data: DemoData, conversationId: string): Message[] =>
  data.messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

export const lastMessage = (data: DemoData, conversationId: string): Message | undefined => {
  const all = messagesOf(data, conversationId);
  return all[all.length - 1];
};

export const visibleCases = (data: DemoData, user: DemoUser): Case[] =>
  data.cases.filter((c) => canSeeCase(data, user, c));

export const activePrimaryPic = (data: DemoData, caseId: string) =>
  data.assignments.find((a) => a.caseId === caseId && a.assignmentType === 'PRIMARY_PIC' && a.isActive) ?? null;

export const assignmentHistory = (data: DemoData, caseId: string) =>
  data.assignments
    .filter((a) => a.caseId === caseId)
    .sort((a, b) => Date.parse(b.assignedAt) - Date.parse(a.assignedAt));

export const caseTimeline = (data: DemoData, caseId: string) =>
  data.timeline
    .filter((t) => t.caseId === caseId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

// ---- Customers (CDP-lite) ----------------------------------------------------------------

export const visibleCustomers = (data: DemoData, user: DemoUser): Customer[] =>
  data.customers.filter((c) => canSeeCustomer(data, user, c));

export const policiesOf = (data: DemoData, customerId: string) =>
  data.policies.filter((p) => p.customerId === customerId).sort((a, b) => Date.parse(b.expiryDate) - Date.parse(a.expiryDate));

export const customerNotesOf = (data: DemoData, customerId: string) =>
  data.customerNotes
    .filter((n) => n.customerId === customerId)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.createdAt) - Date.parse(a.createdAt));

export const ownerHistoryOf = (data: DemoData, customerId: string) =>
  data.ownerAssignments.filter((a) => a.customerId === customerId).sort((a, b) => Date.parse(b.assignedAt) - Date.parse(a.assignedAt));

export const linksOf = (data: DemoData, customerId: string): ProfileLink[] =>
  data.profileLinks
    .filter((l) => l.customerAId === customerId || l.customerBId === customerId)
    .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));

export interface LinkedProfileView {
  customer: Customer;
  viaLinkId: string;
  /** Categories of this linked profile that may be displayed (from its consent notice). */
  allowed: DataCategory[];
}

/**
 * Customer 360: every profile reachable through APPROVED links (transitively).
 * Each linked profile only exposes the categories its own consent notice covers.
 */
export function customer360(data: DemoData, customerId: string): LinkedProfileView[] {
  const approved = data.profileLinks.filter((l) => l.status === 'APPROVED');
  const seen = new Map<string, string>([[customerId, '']]);
  const queue = [customerId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const l of approved) {
      const other = l.customerAId === cur ? l.customerBId : l.customerBId === cur ? l.customerAId : null;
      if (other && !seen.has(other)) {
        seen.set(other, l.id);
        queue.push(other);
      }
    }
  }
  seen.delete(customerId);
  return [...seen.entries()].flatMap(([id, linkId]) => {
    const customer = data.customers.find((c) => c.id === id);
    return customer ? [{ customer, viaLinkId: linkId, allowed: shareableCategories(data, id) }] : [];
  });
}

export const segmentMembers = (data: DemoData, user: DemoUser, segmentId: string, nowIso: string): Customer[] => {
  const seg = data.segments.find((s) => s.id === segmentId);
  if (!seg) return [];
  return visibleCustomers(data, user).filter((c) => matchesAll(data, c, seg.rules, nowIso));
};

/**
 * Active conversations of customers this user owns that the user cannot open in the Inbox.
 * Metadata only (no message text): the owner knows the customer is in contact, but reading
 * the chat requires a role on it (assigned PIC, or a case worker / OBSERVER) — purpose limitation.
 */
export function ownedHiddenConversations(data: DemoData, user: DemoUser): Conversation[] {
  const owned = new Set(data.customers.filter((c) => c.ownerUserId === user.id).map((c) => c.id));
  return data.conversations
    .filter((v) => owned.has(v.customerId) && v.status !== 'CLOSED' && !canSeeConversation(data, user, v))
    .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
}
