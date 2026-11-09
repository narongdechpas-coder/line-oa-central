# 03 — Screen-by-Screen UI/UX Specification

## Global application shell
- Desktop-first layout, target viewport 1440 × 900; responsive down to tablet.
- Left sidebar navigation with product identity and role indicator.
- Top bar: page title, global search (visual/demo behavior), notifications icon, demo role switcher, `DEMO MODE` indicator.
- Main content area with consistent spacing and reusable cards/tables/modals.
- Visual direction: clean enterprise SaaS; low-fidelity first, neutral grayscale with restrained blue accent.
- Use Thai labels for primary UI if practical, with familiar English module names where appropriate. Keep wording consistent.

## 1. Dashboard
Purpose: operational overview.
Components:
- KPI cards: New Messages, Open Cases, At-risk/Breached SLA, Resolved Cases.
- Case trend chart or simple bar chart.
- Case status distribution.
- Channel workload summary by LINE OA.
- Recent activity timeline.
- Quick actions: Open Inbox, View Cases, View SLA.
Interactions:
- KPI cards navigate to relevant filtered views.
- Channel cards filter Inbox/Cases.
- Date range selector can change a small set of seeded report views.

## 2. Unified Inbox
Purpose: manage conversations from multiple independent LINE OAs.
Layout: three columns.
- Left: channel selector, conversation filters and conversation list.
- Center: message thread and simulated reply composer.
- Right: customer profile, channel badge, related Case(s).
Interactions:
- Filter by OA, status, assigned PIC, department.
- Select conversation to load thread.
- Create Case from conversation.
- Add simulated reply; display `NOT SENT`.
- Open related Case.
Important: the message composer must not offer a channel switcher.

## 3. Case Workspace
Purpose: complete case handling workspace.
Header:
- Case number, title, status, priority.
- Actions: Assign PIC, Escalate, Create Internal Task, Change Status.
Tabs:
- Overview
- Conversation
- Assignment
- Escalation
- Internal Tasks
- Timeline
Overview panels:
- Customer and original channel (read-only origin fields).
- Case details/category/priority.
- Current department/team/PIC.
- SLA indicator and due time.
- Related attachments placeholders.
Timeline:
- Case created, assigned, reassigned, escalated, task created/completed, status changes.
Interactions:
- All state-changing actions update local demo state and timeline.
- Origin channel/customer are visually marked as immutable.

## 4. PIC Assignment modal/page
- Candidate list with avatar initials, team, availability, workload, experience.
- Total recommendation score and factor breakdown.
- Recommended badge for top score.
- Manual candidate selection.
- Optional override reason.
- Confirm assignment.
- Show assignment history in Case Workspace.
Scoring display: Skill 35%, Workload 30%, Availability 20%, Experience 15%.

## 5. Internal Escalation modal/page
- Current department/team and target department/team.
- Reason field (required).
- Requested owner (optional).
- Status and activity history.
- Actions depend on role/status: Submit, Accept, Reject, Start Work, Resolve.
- Prominent note: `Internal handoff only — customer remains on original LINE OA`.

## 6. Internal Tasks
- Table/list of tasks with Case, title, target team, assignee, due date and status.
- Filters: status, department, team, due date.
- Create task modal.
- Task detail drawer with internal comments.
- Actions: Assign, Start, Block, Complete, Cancel.
- Internal-only label on comments.

## 7. Authority & Access Control
- Demo roles and permission matrix.
- Department/team/channel scope examples.
- Demo role switcher.
- Read-only explanatory panel describing RBAC + ABAC.
- Do not implement actual user provisioning or authentication.

## 8. Channel Management
- Cards/table for simulated LINE OA accounts.
- Example channels: Claims OA, Service OA, Sales OA.
- Show owner department, status, conversation count.
- Show connection state as `SIMULATED — NOT CONNECTED`.
- No credential forms or token fields.

## 9. Reports & Analytics
- Operational summary: conversation count, cases opened/resolved, SLA, escalations.
- Workload by department/team/PIC.
- Escalation aging.
- SLA performance.
- Use seeded data and filters; charts need not be analytically sophisticated.

## 10. Empty/error states
- Empty inbox, no cases, no tasks, no search result.
- Permission-restricted state for demo roles.
- Confirmation before reset or destructive actions.
- Toast feedback after simulated actions.
