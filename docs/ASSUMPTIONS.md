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

## Customer Management / CDP-lite
- **No merge.** Customer identity stays `(channelId, lineUserId)`. Cross-OA views use governed links only.
- **Consent per OA (example text, not legal wording).** Each notice lists purposes (required vs. optional)
  and data categories. Linking needs the optional purpose `CROSS_SERVICE_LINKING` on **both** profiles.
- **Purpose limitation in Customer 360.** A linked profile shows only the data categories in its own
  notice (e.g. a Sales OA profile never exposes policy or claim data). Only APPROVED links count.
- **Approver:** Manager of the department owning either OA, or Super Admin; never the requester.
  Consent is re-checked at approval.
- **Withdrawal:** withdrawing the linking purpose suspends approved links and auto-rejects pending ones.
  Re-granting does not restore a link — a new request and approval are needed.
- **Demo limits:** only optional purposes can be toggled, through a "simulate customer action" control
  (staff never change consent for a customer). Full withdrawal of required purposes is not modelled.
- **Customer Owner** (relationship, long-term) is separate from case **PIC**. The owner must be in the
  department that owns the customer's OA. In PIC assignment the owner gets a badge only — the score keeps
  the spec weights (35/30/20/15).
- **PII:** phone numbers and PII custom fields are masked; every reveal is audited. Auditor may reveal
  (audited) but cannot edit. System Admin cannot reveal.
- **Custom fields:** Department Admins manage fields for their own OA only. Key and type cannot change
  after creation; deactivating hides a field but keeps stored values.
- **Segments** are evaluated live, limited to the viewer's scope, and are view-only (no broadcast).
  PII fields cannot be used as segment rules.
- LINE display name and LINE User ID are read-only (they come from LINE).
- Persisted state version is 2; older saved demo state resets to the seed.

## For Legal / DPO review
- Legal basis for processing for service delivery (consent or another PDPA basis).
- Wording of consent notices, purposes and retention periods.
- Whether withdrawing consent should affect open cases.
- Which policy data customer service may see.

## Known limitations
- No backend, no multi-user sync: each browser has its own state.
- Attachments are placeholders; no upload/download.
- Notifications are in-app only (bell); nothing is sent externally.
- Global search searches cases only.
- Reports have no export or scheduling. Charts cover the seeded week; 30-day range shows mostly empty days.
- Desktop-first (1440×900). Tablet layout works; phone layout is not targeted.
- Thai labels with English module names; strings are not externalised for i18n.
