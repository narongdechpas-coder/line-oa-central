# Jacky Central — Interactive Demo

Frontend-only demo of the **Jacky Central Communication & Case Management Platform**:
one workspace over several independent LINE OA inboxes, with cases, PIC assignment,
internal escalation, internal tasks, SLA and reports.

> **DEMO / NOT CONNECTED.** There is no LINE Messaging API, webhook, LINE Login, LINE SDK,
> backend or database. All data is fictional and lives only in your browser's localStorage.
> Replies are stored locally and labelled `SIMULATED — NOT SENT TO LINE`.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + service-level workflow tests (vitest)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

## Deploy to Netlify

1. Push this repository to GitHub.
2. Netlify → **Add new site → Import an existing project** → pick the repo.
3. Build command `npm run build`, publish directory `dist` (already in `netlify.toml`).
4. Deploy. Nested routes work through the SPA redirect in `netlify.toml` and `public/_redirects`.

No environment variables are needed. Anyone with the URL can open the demo; use Netlify
password protection if it should be restricted.

## 5-minute demo script

1. **Dashboard** — KPI cards link to filtered views.
2. **Inbox → Claims OA** → open *Rungnapa Customer* → **Create Case** (origin channel/customer are locked).
3. **Assign PIC** — ranked candidates with Skill 35 / Workload 30 / Availability 20 / Experience 15 breakdown.
4. **Change status → IN_PROGRESS**, then **Escalate** to *Legal & Compliance*.
5. Switch role (top right) to **Supaporn Legal Manager** → Escalation tab → **Accept** → **Start**.
6. **Create task for target team** → open it from *งานภายใน* → add internal comment → Start → Done.
7. **Resolve** the escalation — the case returns to Claims; origin channel never changed.
8. Switch to the case PIC → **การสื่อสาร** tab → reply (`SIMULATED — NOT SENT TO LINE`).
9. **Change status → RESOLVED → CLOSED** (confirmation). Check **Reports**.
10. **Reset demo data** (sidebar) restores the seed.

Other things to try: switch to **Demo Auditor** (read-only) or a **PIC** (only assigned work,
no Administration); press **+1 ชม.** on the demo clock to watch SLA states change.

## Structure

```text
src/
  app/            router, App
  components/     layout shell, common UI (chips, cards, fields), overlays (modal, toast)
  features/       dashboard, inbox, cases, assignment, escalation, tasks, channels, access-control, reports
  data/seed.ts    fictional seed (extends docs/handover/04_data/mock/seed.json, original IDs kept)
  services/mock/  mock service boundary — pure functions over demo state (swap for real API later)
  store/          Zustand store, localStorage persistence (key `jacky-central-demo-v1`)
  types/          domain types and enums (aligned with the OpenAPI reference)
  utils/          PIC scoring, lifecycle transitions, SLA, permissions, labels, time
  __tests__/      vitest suites
docs/
  handover/       original handover package (reference)
  ASSUMPTIONS.md  decisions taken where the handover was silent
```

See `docs/ASSUMPTIONS.md` for known limitations and demo assumptions.
