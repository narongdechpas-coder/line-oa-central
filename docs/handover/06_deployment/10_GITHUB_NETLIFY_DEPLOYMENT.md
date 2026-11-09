# 10 — GitHub and Netlify Deployment

## Local development
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
npm run preview
```

## GitHub
1. Create a private or internal repository named `jacky-central-demo`.
2. Open the project folder in Claude Code.
3. Ask Claude Code to implement the app using `09_CLAUDE_CODE_MASTER_PROMPT.md`.
4. Review the generated source and run the local acceptance scenario.
5. Commit and push to GitHub.

Suggested initial commit:
```bash
git init
git add .
git commit -m "chore: initialize Jacky Central demo handover"
git branch -M main
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

## Netlify
1. Sign in to Netlify.
2. Select **Add new site → Import an existing project**.
3. Connect GitHub and select `jacky-central-demo`.
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Deploy.
7. Every push to the connected branch triggers a new deployment.

## SPA routing
Add `public/_redirects`:
```text
/* /index.html 200
```

Or use `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Environment variables
No environment variables are required for the mock-only demo. Do not add LINE secrets, access tokens, channel secrets or production API credentials.

## Operational note
Anyone with the deployed URL may be able to access the demo. Do not load real customer data or confidential company information. Use Netlify access controls/password protection if the demo should be restricted.
