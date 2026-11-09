# Implementation assumptions and known limitations

Decisions taken where the handover did not define behaviour. Items marked **(open)** map to
`docs/handover/05_technical/07_ASSUMPTIONS_AND_OPEN_DECISIONS.md` and need stakeholder review.

## Data
- Seed extended from 3 to 25 cases and 4 to 34 conversations so Dashboard/Reports have data.
  All original IDs are kept. All names, LINE IDs (`U-DEMO-xxxx`) and phones (`08X-XXX-xxxx`) are fictional.
- `slaState` was removed from seeded cases; SLA is derived from `dueAt` and the demo clock.
  The derived values match the original seed for case-0001..0003.
- Added users: System Admin, Department Admin, managers for Service/Sales/Legal/Underwriting, more PICs.
- *Mali Customer* exists on both Service OA and Claims OA as two separate customers, to show the
  "no merge across OAs" rule.

## Demo clock and SLA (simulated)
- Fixed start 2026-11-09 10:00 (Bangkok). Every mutation advances the clock 1 minute so timeline
  order is stable; **+1 ชม.** advances it one hour.
- SLA targets by priority, calendar hours (no business calendar): URGENT 4h, HIGH 8h, NORMAL 24h, LOW 72h.
- AT RISK = 2 hours or less remaining. PENDING pauses SLA; resuming extends `dueAt` by the paused time.
- REOPENED restarts SLA from the reopen time. Changing priority does not change `dueAt`.
- Closed cases are judged at resolution time (met / breached).

## PIC recommendation (illustrative demo logic)
- Factors 0–100: skill = matched / required skills; workload = 100 − workload%;
  availability AVAILABLE 100, BUSY 50, AWAY 20, OFFLINE 0 (excluded); experience = years / 10, capped.
- Candidates: PIC and Supervisor roles in the case's **current** department only. Moving work across
  departments must go through Escalation.
- Assigning adds +5% to the new PIC's workload and −5% to the previous one.

## Case lifecycle
- Manual transitions: NEW→TRIAGED/CLOSED, TRIAGED→CLOSED, ASSIGNED→IN_PROGRESS/PENDING,
  IN_PROGRESS→PENDING/RESOLVED, PENDING→IN_PROGRESS/RESOLVED, RESOLVED→CLOSED/REOPENED,
  CLOSED→REOPENED, REOPENED→IN_PROGRESS/PENDING.
- ASSIGNED is set by Assign PIC; ESCALATED is set while an escalation is active.
- No manual status change while an escalation is active. Working/resolving needs a PIC.

## Escalation **(open: when ownership moves)**
- REQUESTED: case shows ESCALATED; ownership unchanged.
- ACCEPT: current department/team move to the target; if a requested owner was given, they become PIC.
- RESOLVE: blocked while linked tasks are open; ownership returns to the source department and
  previous PIC; case returns to its status before escalation.
- REJECT (reason required) / CANCEL: case returns to its previous status; ownership restored if accepted.
- Review/Accept/Reject: Manager/Supervisor of the **target** department or Super Admin.
  Start/Resolve: target department Manager/Supervisor, or the case's PIC. Cancel: requester or source manager.
- `originalChannelId`, `originalCustomerId` and the conversation are never touched.

## Roles (simulated, not a security boundary)
- Scope: Super Admin / System Admin / Auditor = all; Department Admin / Manager / Supervisor =
  own department (including cases escalated to or from it); PIC = assigned resources only.
- PIC may reply only on conversations assigned to them, and change only cases they own.
- System Admin and Auditor are read-only for case work. Reports hidden from PIC.

## Known limitations
- No backend, no multi-user sync: each browser has its own state.
- Attachments are placeholders; no upload/download.
- Notifications are in-app only (bell); nothing is sent externally.
- Global search searches cases only.
- Reports have no export or scheduling. Charts cover the seeded week; 30-day range shows mostly empty days.
- Desktop-first (1440×900). Tablet layout works; phone layout is not targeted.
- Thai labels with English module names; strings are not externalised for i18n.
