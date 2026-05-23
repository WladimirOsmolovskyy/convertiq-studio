# CLAUDE.md

Convertiq Studio: a Next.js 16 + Supabase multi-tool marketing suite. Two sub-apps in one app:

1. **Questionnaire builder** (`/dashboard/questionnaire/[id]`) — branching, scoring, custom design. Published at `https://{customer-domain}/{slug}` via host-header routing.
2. **Static Ad Editor** (`/dashboard/ads`) — Konva canvas, Framer-style sizing, PNG export.

**Multi-tenant:** User → Projects → Questionnaires + Domains. A user owns N projects; each project owns N questionnaires and N custom domains.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Supabase (auth + Postgres + RLS) · Zustand + Immer · Konva (ad editor) · lucide-react · @dnd-kit · **No Tailwind** — CSS Modules + `src/app/globals.css` design system · TypeScript strict.

## Commands

```bash
npm run dev              # localhost:3000 (Turbopack)
npm run build
npm run lint
npx tsc --noEmit -p .
```

No tests.

## Architecture you'll hit

- **Two Supabase clients.** `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (server components, route handlers). RLS is the auth layer. For server code that needs to bypass RLS (e.g. anonymous responder resolving questionnaire owner), use `src/lib/supabase/admin.ts` (service-role).
- **Ownership chain.** Questionnaires + domains authorize through `project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())`. Public reads of published questionnaires and verified domains are explicit policies.
- **Proxy, not middleware.** Next 16 renamed middleware → proxy. File: `src/proxy.ts` exporting `proxy()`. Also rewrites custom-domain `/{slug}` → `/q/{slug}`.
- **Active project.** `src/lib/projects.ts` — `getActiveProject(supabase, userId)` reads the `active_project_id` httpOnly cookie, falls back to the user's first project, auto-creates a "Default" for new users.
- **Design system** lives in `src/app/globals.css` — CSS variables for Apple palette, fill levels, button styles (`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-bordered`), light + dark via `prefers-color-scheme`. Many CSS Modules consume these vars — don't rename them.
- **Questionnaire renderer** is shared: `src/components/QuestionnaireRenderer.tsx` powers both the public page and the editor preview, styled at runtime via `published.module.css` through the design editor. Don't bake colors/spacing/fonts here — those are user-controlled.

## UI conventions

- No emojis. Use Lucide icons.
- No hover-lift / shadow-grow animations on cards.
- No dashed "create new" placeholder cards — creation lives in toolbars.
- Buttons: `.btn-primary` filled pill, `.btn-secondary` tinted pill — both `--accent`.
- Same-level items: white bg + `--separator` border. Elevated chrome (sidebar, toolbars): light grey.
- Keep CSS variable names stable.

## Gotchas

- **Server-only utils** (`createClient` from `server.ts`, `getActiveProject`, the Vercel wrapper): don't import from client components.
- **Server components can't reliably set cookies** — `server.ts` has a try/catch. Cookie writes happen only from route handlers / server actions.

## Workflow rules

- **Commits:** Conventional Commits format — `type: short description`, `type ∈ {feat, fix, docs, refactor, chore}`. No empty messages.
- **Env vars:** When you introduce a new one, add it to `.env.local.example` with a placeholder value + one-line comment. Mention it in the commit message under a `## Env vars` section.
- **Migrations:** Write as `supabase/migrations/NNN_name.sql` with idempotent SQL (`CREATE TABLE IF NOT EXISTS`, etc.). Don't run them — the orchestrator applies via `stage`.
- **Don't commit:** `.claude/settings.local.json` or other local-only config.

## Environments + deploy

| env | URL | Supabase | Banner |
|---|---|---|---|
| local | `localhost:3000` | staging | red "LOCAL" |
| preview/staging | `staging.studio.convertiq.de` | staging | orange "STAGING" |
| production | `studio.convertiq.de` | prod | none |

- `staging` is the default working branch. `git push` from `staging` auto-deploys staging.
- Prod deploys on PR merge into `main`.
- `.env.local` points at staging — local dev never touches prod data.
- **Migrations** are applied manually (no Supabase branching on Free tier). Aliases: `stage` (staging), `ship` (prod). Test against staging first.

<!-- AGENTS.md is read by agent sessions (via their kickoff prompt), not auto-included here. -->

