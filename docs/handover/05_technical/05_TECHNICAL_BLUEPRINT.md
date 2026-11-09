# 05 — Technical Blueprint for Demo

## Recommended stack
- Vite
- React
- TypeScript
- React Router
- Zustand (or Context + reducer if preferred)
- Lucide React
- Recharts (optional)
- CSS Modules or Tailwind CSS (choose one approach)
- localStorage for persistence

## Why this stack
A Vite SPA is straightforward to build, fast to preview, and deployable to Netlify as a static site. No server-side runtime is required for this demo.

## Architecture
Use a simple layered frontend structure:
1. `pages/` — route-level screens.
2. `components/` — shared UI components.
3. `features/` — inbox, cases, assignment, escalation, tasks, admin, reports.
4. `data/` — seed data and demo fixtures.
5. `store/` — centralized state and persistence.
6. `services/` — mock service functions; keep a boundary that could later be replaced by real API calls.
7. `types/` — shared TypeScript domain types.
8. `utils/` — scoring, status transitions, dates and formatting.

## State and persistence
- Initialize from seed JSON on first run.
- Persist changes to localStorage.
- Provide `Reset Demo` to clear localStorage and reload seed.
- Use a versioned storage key, e.g. `jacky-central-demo-v1`.
- Keep demo actions deterministic and reproducible.

## Mock service boundary
Create functions such as:
- `listConversations(filters)`
- `getConversation(id)`
- `sendSimulatedMessage(conversationId, payload)`
- `createCaseFromConversation(conversationId, payload)`
- `recommendPic(caseId)`
- `assignPic(caseId, userId, reason)`
- `createEscalation(caseId, payload)`
- `transitionEscalation(escalationId, action)`
- `createInternalTask(caseId, payload)`
- `updateInternalTask(taskId, patch)`
- `addInternalComment(taskId, body)`
- `transitionCase(caseId, nextStatus)`
All functions operate on local demo state only.

## Future backend compatibility
Keep domain object names aligned with the supplied OpenAPI and PostgreSQL reference artifacts. Do not implement API calls in this demo. The existing OpenAPI YAML and SQL migration are future implementation references, not active dependencies.

## Quality requirements
- TypeScript strict mode.
- Reusable components and consistent status enums.
- No dead navigation links.
- No fake controls that appear interactive but do nothing.
- Add basic unit tests for PIC score calculation and lifecycle transition rules if time permits.
