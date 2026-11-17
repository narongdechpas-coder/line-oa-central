// Read-side mock services. Pure functions over DemoData, scoped to the acting demo user.
import type { Case, Conversation, ConversationStatus, DemoData, DemoUser, Message } from '../../types/domain';
import { canSeeCase, canSeeConversation } from '../../utils/permissions';

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
