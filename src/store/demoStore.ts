// Central demo state. Persisted to localStorage under a versioned key; Reset restores the seed.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEMO_START, cloneSeed } from '../data/seed';
import * as svc from '../services/mock/operations';
import { DemoError } from '../services/mock/operations';
import type { CaseStatus, DemoState, Priority } from '../types/domain';
import type { EscalationAction } from '../utils/transitions';

export const STORAGE_KEY = 'jacky-central-demo-v1';
export const DEFAULT_ACTING_USER = 'usr-admin';

export function initialDemoState(): DemoState {
  return { data: cloneSeed(), now: new Date(DEMO_START).toISOString(), seq: 0, actingUserId: DEFAULT_ACTING_USER };
}

/** Result of a store action: UI shows `error` as inline validation or a toast. */
export type ActionResult<T = void> = { ok: true; value: T } | { ok: false; error: string; kind: DemoError['kind'] };

interface DemoActions {
  resetDemo: () => void;
  switchUser: (userId: string) => ActionResult;
  advanceTime: (minutes: number) => ActionResult;
  markRead: (conversationId: string) => void;
  sendReply: (conversationId: string, text: string) => ActionResult;
  createCase: (conversationId: string, payload: svc.CreateCasePayload) => ActionResult<string>;
  transitionCase: (caseId: string, next: CaseStatus) => ActionResult;
  changePriority: (caseId: string, priority: Priority) => ActionResult;
  assignPic: (caseId: string, userId: string, reason?: string) => ActionResult;
  createEscalation: (caseId: string, payload: svc.CreateEscalationPayload) => ActionResult<string>;
  escalationAction: (escalationId: string, action: EscalationAction, note?: string) => ActionResult;
  createTask: (caseId: string, payload: svc.CreateTaskPayload) => ActionResult<string>;
  updateTask: (taskId: string, patch: svc.TaskPatch) => ActionResult;
  addComment: (taskId: string, body: string) => ActionResult;
}

export type DemoStore = DemoState & DemoActions;

const pick = (s: DemoStore): DemoState => ({ data: s.data, now: s.now, seq: s.seq, actingUserId: s.actingUserId });

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => {
      /** Runs a pure service op; commits on success, converts DemoError into a result. */
      function run<T>(op: (s: DemoState) => { state: DemoState; value: T }): ActionResult<T> {
        try {
          const { state, value } = op(pick(get()));
          set(state);
          return { ok: true, value };
        } catch (err) {
          if (err instanceof DemoError) return { ok: false, error: err.message, kind: err.kind };
          throw err;
        }
      }
      const plain = (f: (s: DemoState) => DemoState) => run((s) => ({ state: f(s), value: undefined }));

      return {
        ...initialDemoState(),
        resetDemo: () => set(initialDemoState()),
        switchUser: (userId) => plain((s) => svc.switchActingUser(s, userId)),
        advanceTime: (minutes) => plain((s) => svc.advanceDemoTime(s, minutes)),
        markRead: (conversationId) => set(svc.markConversationRead(pick(get()), conversationId)),
        sendReply: (conversationId, text) => plain((s) => svc.sendSimulatedMessage(s, conversationId, { text })),
        createCase: (conversationId, payload) =>
          run((s) => {
            const r = svc.createCaseFromConversation(s, conversationId, payload);
            return { state: r.state, value: r.caseId };
          }),
        transitionCase: (caseId, next) => plain((s) => svc.transitionCase(s, caseId, next)),
        changePriority: (caseId, priority) => plain((s) => svc.changeCasePriority(s, caseId, priority)),
        assignPic: (caseId, userId, reason) => plain((s) => svc.assignPic(s, caseId, userId, reason)),
        createEscalation: (caseId, payload) =>
          run((s) => {
            const r = svc.createEscalation(s, caseId, payload);
            return { state: r.state, value: r.escalationId };
          }),
        escalationAction: (escalationId, action, note) =>
          plain((s) => svc.transitionEscalation(s, escalationId, action, note)),
        createTask: (caseId, payload) =>
          run((s) => {
            const r = svc.createInternalTask(s, caseId, payload);
            return { state: r.state, value: r.taskId };
          }),
        updateTask: (taskId, patch) => plain((s) => svc.updateInternalTask(s, taskId, patch)),
        addComment: (taskId, body) => plain((s) => svc.addInternalComment(s, taskId, body)),
      };
    },
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => pick(s),
      // Unknown or older stored shape → start again from the seed rather than crash.
      migrate: () => initialDemoState(),
    },
  ),
);

/** The demo user the app is currently acting as. */
export const useActingUser = () =>
  useDemoStore((s) => s.data.users.find((u) => u.id === s.actingUserId) ?? s.data.users[0]!);
