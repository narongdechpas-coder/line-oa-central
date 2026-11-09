# 04 — Interaction and UI Rules

## Required interactions
- Sidebar navigation changes route.
- Inbox filters update conversation list.
- Selecting a conversation updates message thread and customer panel.
- Create Case creates a persistent local Case.
- Assign PIC updates active owner, assignment history and timeline.
- Escalation actions update escalation status and relevant internal ownership/task.
- Internal Task create/update/comment persists locally.
- Case status/priority changes persist and append timeline events.
- Role switcher changes visible permissions and scoped data.
- Reset Demo restores seed data.

## Visual feedback
- Use toasts for successful simulated operations.
- Use inline validation for required fields.
- Disable actions not permitted for current demo role.
- Use confirmation modal for reset, close case, reject escalation.
- Mark all mock integrations visibly: `DEMO`, `SIMULATED`, `NOT CONNECTED`, or `NOT SENT`.

## Data integrity in the browser demo
- Do not allow originalChannelId or originalCustomerId to be edited.
- Do not allow reply channel selection.
- Do not allow multiple active PRIMARY_PIC assignments for one case.
- Do not show internal notes/tasks as customer messages.
- Preserve history entries after reassignments and escalations.
- Use stable IDs in mock state, not array index keys.

## Accessibility
- Keyboard-accessible controls and modal close behavior.
- Visible focus states.
- Form labels and helpful validation messages.
- Sufficient text contrast.
- Avoid communicating status by color alone; include text labels.
