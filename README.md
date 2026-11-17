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

## Landing page and presentation

- `/` is the landing page (InsureFlow style); the app starts at `/dashboard`.
- `/presentation/` is the 13-slide sales deck for insurance companies (with a cost calculator that uses the
  audience's own numbers), built from `presentation/deck.html` by
  `npm run deck` (also run automatically by `npm run dev` and `npm run build`). Arrow keys or swipe to move,
  **N** for speaker notes, `#s3` in the URL opens slide 3.
- Screenshots used in the deck live in `presentation/img/*.webp`.
- **AI images**: generate them in ChatGPT, then save as
  `presentation/img/ai-cover.webp`, `ai-problem.webp`, `ai-cta.webp` (deck) and
  `public/landing/hero.webp` (landing background). Missing files show a "waiting for image" frame.
- Fonts are bundled (`@fontsource`), so the app makes no external requests. The deck page loads
  Google Fonts.

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

### Customer Management / CDP-lite

1. **Customers** → filter *กรมธรรม์หมดใน 30 วัน* → open *Mali Customer (Claims OA)*.
2. Phone is masked — **แสดง** reveals it and writes an audit entry. Edit custom fields and tags; change the **Customer Owner**.
3. **Customer 360** — the linked *Mali (Service OA)* profile shows only the data categories covered by
   that OA's consent notice (claim detail is out of scope). Records are never merged.
4. As **Krit Supervisor**, open *Wanida Customer* → Customer 360 → **ขอเชื่อมโปรไฟล์** → pick *Boonmee (Service OA)*.
   Profiles without linking consent cannot be selected.
5. As **Orawan Manager** → Customers → *คำขอเชื่อมโปรไฟล์* → approve. The requester cannot approve their own request.
6. Wanida → **Consent** tab → *จำลอง: ลูกค้าถอนความยินยอม* → the link is suspended automatically.
7. **Segments** — create a rule-based group with a live member count (view only, nothing is sent).
8. **Admin → Custom Fields** — Department Admins manage fields only for their own OA.

### Topic routing (Department → Topic → PIC)

1. **Admin → แผนกและหัวข้อ** — each topic has ONE receiving department with an ordered PIC list, plus
   departments that can only see the log (e.g. *Repair Coordination*: Claims receives, Marketing sees the log).
2. **Inbox → Rungnapa (Claims OA)** → Create Case → topic *Motor Claim*: her owner (Phakamas, Marketing) is not on
   the topic list, so she follows the case as **OBSERVER**; the top-ranked Claims PIC is preselected.
3. **Inbox → Kanya (Sales OA)** → topic *Campaign Inquiry → Marketing*: her owner Tanakrit is on the list and is
   **priority 1**. The case is created at Sales and **escalated automatically** to Marketing (reason required).
4. Switch to **Chanida Marketing Manager** → accept the escalation. Open *JC-2026-0003* to see the read-only
   observer view.

Other things to try: switch to **Demo Auditor** (read-only) or a **PIC** (only assigned work,
no Administration); press **+1 ชม.** on the demo clock to watch SLA states change.

## Structure

```text
src/
  app/            router, App
  components/     layout shell, common UI (chips, cards, fields), overlays (modal, toast)
  features/       dashboard, inbox, customers, segments, custom-fields, cases, assignment, escalation,
                  tasks, channels, access-control, reports
  data/seed.ts    fictional seed (extends docs/handover/04_data/mock/seed.json, original IDs kept)
  data/seedCustomers.ts  fictional custom fields, policies, consent notices/records, links, segments
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
