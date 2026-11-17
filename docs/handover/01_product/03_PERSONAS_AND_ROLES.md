# 03 — Personas and Demo Roles

## Demo personas

| Role | Primary goal | Typical actions |
|---|---|---|
| Super Admin | See and configure the whole demo organization | All screens, role switcher, channel/organization overview |
| System Admin | Manage platform setup | View channels, users, roles and permissions |
| Department Admin | Manage a department's operation | View department cases, teams and workload |
| Manager | Control service delivery | Confirm/override PIC, review escalations, monitor SLA |
| Supervisor | Coordinate daily work | Assign/reassign PIC, manage tasks, review handoffs |
| PIC / Agent | Resolve assigned work | Reply in simulated thread, update cases, complete tasks |
| Auditor | Inspect records | Read-only views of cases, timeline and audit activity |

## Role-switcher behavior
- Provide a persistent Demo Role selector in the application shell.
- Switching roles changes the visible navigation and available actions.
- Add a visible label: `DEMO ROLE — permissions are simulated`.
- Do not describe this as secure authentication.
- The Auditor role is read-only.
- PIC users see assigned cases/tasks by default.
- Manager and Supervisor can assign/reassign and act on escalations.
- Super Admin can view all seeded demo resources.

## Access model concept
Use RBAC + resource scopes:
- RBAC: what action a role may perform.
- ABAC/resource scope: which department, team, channel or assigned resource the user may access.
The prototype only demonstrates this concept in UI behavior. It is not a security boundary.
