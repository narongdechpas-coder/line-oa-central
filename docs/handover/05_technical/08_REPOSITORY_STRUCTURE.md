# 08 — Suggested Repository Structure

```text
jacky-central-demo/
├── public/
│   └── _redirects
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── router.tsx
│   ├── components/
│   │   ├── layout/
│   │   ├── common/
│   │   ├── data-display/
│   │   └── overlays/
│   ├── features/
│   │   ├── dashboard/
│   │   ├── inbox/
│   │   ├── cases/
│   │   ├── assignment/
│   │   ├── escalation/
│   │   ├── tasks/
│   │   ├── channels/
│   │   ├── access-control/
│   │   └── reports/
│   ├── data/
│   │   └── seed.ts
│   ├── services/
│   │   └── mock/
│   ├── store/
│   ├── types/
│   ├── utils/
│   ├── styles/
│   └── main.tsx
├── docs/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── netlify.toml
└── README.md
```

Claude Code may adjust the structure if it improves maintainability, but preserve feature separation and the mock-service boundary.
