# 02 — Workflow Specification

## A. Customer conversation to case
1. A customer message appears in one simulated LINE OA inbox.
2. User selects a channel or "All Channels".
3. User opens a conversation.
4. User reviews customer profile and message history.
5. User selects `Create Case`.
6. System creates a Case using the conversation's customer and original channel.
7. Case opens in Case Workspace with status `NEW` or `TRIAGED`.

**Invariant:** Case origin channel and customer are copied from the conversation and cannot be edited.

## B. PIC recommendation and assignment
1. User opens the Case and selects `Assign PIC`.
2. Demo engine ranks eligible PIC candidates.
3. Display total score and factor breakdown:
   - Skill match: 35%
   - Workload: 30%
   - Availability: 20%
   - Experience: 15%
4. Manager/Supervisor selects recommended PIC or manually overrides.
5. User confirms assignment and enters an optional reason.
6. Case timeline and assignment history record the change.
7. One active `PRIMARY_PIC` per Case.

Recommendation score is illustrative demo logic, not a validated production model.

## C. Internal escalation
1. User selects `Escalate`.
2. Select target department and optional target team.
3. Enter reason and optional requested owner.
4. Submit escalation with status `REQUESTED`.
5. Target manager reviews and accepts or rejects.
6. If accepted, status moves to `ACCEPTED`, then `IN_PROGRESS`.
7. Target department works through internal task(s).
8. Escalation is marked `RESOLVED`.
9. Case ownership/team may be updated as part of internal handoff.

**Critical invariant:** Escalation never changes the Case's original channel, original customer, or source conversation. Customer remains on the original LINE OA.

## D. Internal task handoff
1. Create task from Case or Escalation.
2. Set title, description, assigned department/team/user and due date.
3. Task status: `OPEN` → `IN_PROGRESS` → `DONE`; optional `BLOCKED` or `CANCELLED`.
4. Add internal comments.
5. Task updates appear in the Case timeline.
6. Internal task comments are never shown in the customer conversation.

## E. Customer reply simulation
1. User enters text in the conversation composer.
2. Submit adds an outbound message to local demo state.
3. UI displays `SIMULATED — NOT SENT TO LINE`.
4. Message is associated with the original conversation and channel.
5. There is no channel selector in the reply composer.

## F. Case lifecycle
Suggested states:
`NEW` → `TRIAGED` → `ASSIGNED` → `IN_PROGRESS` → `PENDING` → `RESOLVED` → `CLOSED`
Additional transitions: `REOPENED`; `ESCALATED` may be displayed when an active escalation exists.
Do not allow arbitrary invalid transitions; implement a clear transition map and disable unavailable actions.

## G. Escalation lifecycle
`REQUESTED` → `UNDER_REVIEW` → `ACCEPTED` → `IN_PROGRESS` → `RESOLVED`
Alternative terminal states: `REJECTED`, `CANCELLED`.

## H. SLA simulation
- Use seeded due timestamps relative to a fixed demo dataset or a deterministic demo clock.
- Show `ON TRACK`, `AT RISK`, `BREACHED`, `PAUSED`.
- A simple seeded status is sufficient; optional "Advance demo time" control may simulate time progression.
- Clearly label all SLA values as simulated.
