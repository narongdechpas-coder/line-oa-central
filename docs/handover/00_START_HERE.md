# 00 — Start Here

## What we are building
A desktop-first interactive web demo of **Jacky Central Communication & Case Management Platform**. It demonstrates how a centralized team manages multiple independent LINE OA inboxes and coordinates work through cases, PIC assignment, internal escalation, internal tasks and SLA monitoring.

## Demo principle
**Simulate the operational experience; do not integrate external systems.**

A user should be able to:
1. Switch between simulated LINE OA channels.
2. Browse incoming customer conversations.
3. Open a conversation and inspect customer context.
4. Create a Case from a conversation.
5. View system-recommended PIC candidates and their score breakdown.
6. Confirm or override a PIC assignment.
7. Escalate a Case to another department/team without changing its original LINE OA.
8. Create and complete internal tasks and comments.
9. Update Case status and observe SLA indicators.
10. Switch user roles to demonstrate access scopes.
11. View operational dashboard and reports.
12. Reset the demo to its original seeded state.

## Key product rule
**What moves is internal responsibility and work, not the customer's communication channel.**

## What Claude Code should do
Build the actual demo application from this handover. Do not merely generate another specification. If an implementation detail is not defined, choose the simplest coherent demo behavior and document the assumption.

## Non-negotiable restrictions
- No LINE Messaging API, LINE Login, webhook endpoint or LINE SDK.
- No real customer identifiers, phone numbers or personal information.
- No external message delivery. The composer creates a simulated outbound message only.
- No production secrets or `.env` credentials.
- No real authentication. Use a clearly labelled Demo Role Switcher.
- Use mock data and localStorage only.
- Every simulated external action must be visibly marked as **DEMO / NOT CONNECTED**.
