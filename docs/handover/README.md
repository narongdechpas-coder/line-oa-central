# Jacky Central — Claude Code Demo Handover

**Purpose:** Build an interactive, frontend-only product demo that demonstrates the intended workflow and scope of Jacky Central without connecting to LINE OA or any production backend.

## Read this first
1. `00_START_HERE.md`
2. `01_product/01_PRODUCT_BRIEF.md`
3. `02_workflows/02_WORKFLOW_SPEC.md`
4. `03_ui_ux/03_SCREEN_SPEC.md`
5. `05_technical/05_TECHNICAL_BLUEPRINT.md`
6. `05_technical/09_CLAUDE_CODE_MASTER_PROMPT.md`

## Package contents
- Product vision, demo objectives, scope boundaries and roles.
- Workflow definitions for inbox, case, PIC assignment, internal escalation, tasks and SLA.
- Screen-by-screen UI/UX specification and interaction rules.
- Mock data seed file and business rules.
- Frontend architecture, GitHub/Netlify deployment guidance and acceptance tests.
- Existing OpenAPI, PostgreSQL migration, ERD and low-fidelity wireframe supplied as reference only.

## Important demo boundary
This package is a **prototype handover**, not a production-ready system. The demo must not connect to a real LINE OA, send external messages, store real customer data, or expose secrets. All interactions are simulated in the browser and persisted only in localStorage.

## Suggested implementation
- Vite + React + TypeScript
- React Router
- Zustand or React Context for demo state
- Plain CSS / CSS Modules or Tailwind (choose one; avoid unnecessary UI framework complexity)
- Lucide React icons
- Recharts only if charts materially improve the demo
- Netlify static hosting with SPA redirect

## Expected deliverable from Claude Code
A complete working repository that can be run locally with `npm install && npm run dev`, built with `npm run build`, and deployed to Netlify from GitHub.
