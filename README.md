# OpenSeer

Graph-based operational intelligence MVP (Next.js App Router, React Flow, TypeScript, Tailwind).

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The **graph workspace** lives at `/workspace/graph`.

## Source control, build, and deployment

- **GitHub** is the system of record for application code, configuration, and version history.
- **Vercel** connects to the GitHub repository: pushes to the configured branch trigger builds and deployments; pull requests can produce preview deployments; production is promoted from the approved branch.

Connect the repo in the Vercel dashboard, select the production branch, and deploy. No custom build command is required beyond `next build`.

## Storage (MVP vs production)

The current MVP persists the **graph document** and a **display name** (Settings → Profile) in **browser `localStorage`**, which is appropriate for local demos only.

For **cloud persistence** on Vercel, plan to add one or more Vercel-supported services and keep user data out of the app bundle, for example:

- **Vercel Blob** — uploads for screenshots, attachments, and large artifacts (with metadata in your database).
- **Vercel Postgres** or **Neon** — relational records for workspaces, graph versions, nodes, edges, documents, and audit fields.
- **Vercel KV** — optional cache, sessions, or lightweight feature flags.

Implement a small storage layer (e.g. `GraphRepository` / API routes) that mirrors the existing `OpenSeerGraphDocument` shape so the UI can swap `localStorage` for HTTP calls with minimal churn.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js deployment](https://nextjs.org/docs/app/building-your-application/deploying)
