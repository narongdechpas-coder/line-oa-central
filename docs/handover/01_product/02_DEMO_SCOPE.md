# 02 — Demo Scope

## In scope — must be interactive

| Module | Demo capability |
|---|---|
| Dashboard | KPI cards, case status summary, channel volume, SLA alerts, recent activity |
| Unified Inbox | Channel filter, status filter, conversation list, message thread, customer panel |
| Channel Management | List simulated OAs, status, owning department; no credential setup |
| Case Workspace | Case details, priority, lifecycle, original channel, customer, timeline, attachments placeholders |
| PIC Assignment | Recommendation ranking, score breakdown, manual override, assignment history |
| Internal Escalation | Request, review, accept/reject, progress, resolve; target department/team |
| Internal Tasks | Create, assign, comment, update status and due date |
| Authority & Access | Demo role switcher and visible permission/scope behavior |
| SLA | Due-time indicators, breached/at-risk status, pause/resume simulation if feasible |
| Reports | Operational summary, workload by PIC/team, escalation and SLA summaries |
| Demo Controls | Reset data, change demo role, show simulation status |

## Out of scope
- Real LINE OA connection, LINE webhook, LINE Login, LINE message delivery.
- Real authentication / SSO / Entra ID.
- Backend API, database server, queues, Redis, file storage.
- Real notifications (email, LINE, push).
- Real attachment upload or malware scanning.
- Production RBAC/ABAC enforcement or audit guarantees.
- Actual SLA scheduler or background jobs.
- Production analytics or export pipeline.
- PDPA production controls, retention automation and encryption-at-rest configuration.

## Demo implementation strategy
- Seed data in `04_data/mock/seed.json`.
- Keep app state in a central store.
- Persist state in browser localStorage.
- Add a "Reset demo data" action.
- Simulate asynchronous operations with short UI feedback only; do not imply external delivery.
