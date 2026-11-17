# 09 — Claude Code Master Build Prompt

You are the lead frontend engineer. Build a complete, polished, interactive frontend-only demo for **Jacky Central Communication & Case Management Platform** using the handover documents in this repository.

## First actions
1. Read `00_START_HERE.md` and all documents under `01_product`, `02_workflows`, `03_ui_ux`, `04_data`, `05_technical`.
2. Inspect the supplied wireframe image under `07_reference/wireframes`.
3. Inspect the OpenAPI and database references under `07_reference`; use them for naming and future compatibility only.
4. Summarize your implementation plan briefly, then implement the application. Do not stop after writing another plan.

## Build requirements
- Vite + React + TypeScript.
- Desktop-first responsive SaaS interface.
- Use a consistent application shell and working navigation.
- Implement all nine screens in `03_ui_ux/03_SCREEN_SPEC.md`.
- Use the supplied seed data; add realistic mock records if needed.
- Use centralized state with localStorage persistence and Reset Demo.
- Build mock service functions behind a service boundary.
- Implement the end-to-end flow in `02_workflows/02_WORKFLOW_SPEC.md`.
- Implement PIC recommendation score using weights Skill 35%, Workload 30%, Availability 20%, Experience 15%.
- Implement role switcher with simulated permission visibility.
- Implement Case and Escalation lifecycle transitions.
- Show timeline history for important changes.
- Clearly label all simulated integration behavior.
- Ensure customer replies are visibly marked `SIMULATED — NOT SENT TO LINE`.
- Never add a real LINE API call, webhook, token, credential form, or external messaging action.
- No backend and no database connection.

## Design direction
Follow the low-fidelity wireframe as the information architecture reference. Create a clean enterprise SaaS interface with neutral backgrounds, navy sidebar, restrained blue primary actions, clear typography, compact but readable tables, status chips and well-spaced cards. Do not overdesign or use a marketing landing-page aesthetic.

## Must-have demo scenario
A stakeholder must be able to start from a seeded customer conversation, create a Case, assign a PIC, escalate internally to another department, create and complete an internal task, add a simulated reply, resolve the escalation and close the Case. The original LINE OA channel must remain unchanged throughout.

## Engineering standards
- TypeScript strict mode.
- No dead buttons or placeholder links.
- Validate forms and show useful feedback.
- Keep types and status enums centralized.
- Use stable IDs.
- Handle empty states and permission-restricted states.
- Ensure all screens work after browser refresh.
- Avoid overengineering and unnecessary dependencies.

## Validation before completion
Run `npm run build` and fix all build errors. If tests exist, run them. Confirm nested routes work on Netlify. Report:
1. What was implemented.
2. How to run locally.
3. How to deploy to Netlify.
4. Known limitations.
5. Confirmation that no LINE OA integration or external message delivery exists.

## Definition of done
The demo is navigable, interactive, persists local changes, demonstrates the full case workflow, and can be deployed as a static Netlify site from GitHub.
