# 06 — Demo Acceptance Tests

## Core end-to-end scenario
1. Open Dashboard and confirm KPIs render.
2. Open Inbox and filter to `Claims OA`.
3. Select a conversation and inspect customer details.
4. Create a Case.
5. Confirm original channel/customer are visible and read-only.
6. Open PIC Assignment and inspect candidate scores.
7. Assign a PIC; verify current owner and assignment history update.
8. Escalate Case to Legal or Underwriting.
9. Accept escalation using Manager role.
10. Create an internal task for target team.
11. Add internal comment and complete task.
12. Resolve escalation.
13. Return to Case and confirm original channel is unchanged.
14. Add a simulated customer reply and confirm `NOT SENT` is visible.
15. Resolve and close Case.
16. Open Reports and confirm seeded counts reflect changed demo state.

## Role tests
- PIC cannot see admin configuration controls.
- Auditor cannot mutate case, assignment, escalation or task records.
- Manager/Supervisor can assign PIC and act on escalations.
- Super Admin can view all demo channels and departments.
- Role change is visible in the app shell.

## Integrity tests
- No reply channel selector.
- Original channel/customer cannot be edited.
- Escalation does not change conversation.channelId.
- Internal comments never appear in customer message thread.
- At most one active PRIMARY_PIC per Case.
- Reset Demo restores initial seed.

## Deployment tests
- `npm run build` succeeds.
- Netlify direct navigation to nested routes works (SPA redirect).
- No environment secrets required.
- No network request to LINE endpoints.
