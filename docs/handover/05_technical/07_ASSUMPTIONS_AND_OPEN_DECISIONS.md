# 07 — Assumptions and Open Decisions

## Assumptions for the first demo
- Desktop-first, 1440px target.
- Thai-first labels with English product/module names where familiar.
- Three simulated LINE OAs.
- One seeded organization with multiple departments and teams.
- One primary PIC per Case.
- Internal escalation can update current department/team/owner but never original channel/customer.
- localStorage is sufficient for stakeholder demonstration.
- No multi-user collaboration; each browser has independent demo state.

## Decisions to revisit after stakeholder review
- Exact department and team hierarchy.
- Whether escalation acceptance changes Case owner immediately or only after a task is accepted.
- SLA pause conditions and business calendar.
- Required approval steps for high-priority or sensitive cases.
- Detailed permission matrix and resource-scope inheritance.
- Attachment preview and retention behavior.
- Exact LINE message types and template support for production.
- API pagination, filtering and error contract.
- Whether reports need export or scheduled delivery.
