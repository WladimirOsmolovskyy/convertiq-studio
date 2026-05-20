# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Convertiq Studio — a multi-tool marketing suite. Two distinct sub-apps live inside one Next.js app:

1. **Questionnaire builder** (`/dashboard` + `/dashboard/questionnaire/[id]`) — branching logic, scoring, custom design. Published at `https://{customer-domain}/{slug}` via host-header routing.
2. **Static Ad Editor** (`/dashboard/ads`) — Konva-based design canvas with Framer-style sizing modes, auto-layout, PNG export.

Multi-tenant model: **User → Projects → Questionnaires + Domains.** A user owns N projects; each project owns N questionnaires and N custom domains. Each published questionnaire is attached to exactly one of its project's verified domains plus a slug.

## Stack

- Next.js 16.2.4 (Turbopack) + React 19
- Supabase (auth + Postgres + RLS)
- Zustand (+ Immer) for client state
- Konva / react-konva for the ad editor canvas
- `lucide-react` for icons
- `@dnd-kit` for drag-and-drop
- **No Tailwind** — CSS Modules + a single `globals.css` design system
- TypeScript strict

## Commands

```bash
npm run dev    # localhost:3000, Turbopack
npm run build  # production build
npm run start  # serve the build
npm run lint   # eslint
npx tsc --noEmit -p .   # type check
```

No test framework is set up.

## Architecture notes that span files

**Two Supabase clients.** `src/lib/supabase/client.ts` for browser; `src/lib/supabase/server.ts` for server components and Route Handlers. RLS policies are the authoritative authorization layer. **Questionnaire ownership flows through `project_id`** (see migration 003): policies check `project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())`. Domain ownership flows through `project_id` the same way (migration 004). Public reads of published questionnaires and verified domains are explicitly allowed by separate policies.

**Auth callback.** `/auth/callback` exchanges the Supabase code for a session. OAuth redirect URLs must be registered per environment in Supabase Auth → URL Configuration.

**Proxy, not middleware.** Next 16 renamed middleware → proxy. The file is `src/proxy.ts` exporting a `proxy()` function. Don't recreate `middleware.ts`. **The proxy also handles host-header rewriting** — non-studio hosts (custom domains) get `/{slug}` rewritten to `/q/{slug}` so the public render path resolves.

**Projects + active project.** `src/lib/projects.ts` is the single source of truth: `getActiveProject(supabase, userId)` reads the `active_project_id` httpOnly cookie, falls back to the user's first project, and auto-creates a "Default" project for brand-new users. The cookie is set only via `POST /api/projects/active`. The dashboard layout is a server-component shell that fetches `{ projects, activeProjectId, userEmail }` and renders the client `SidebarInner` with a `ProjectSwitcher`.

**Custom domains.** `src/lib/vercel.ts` wraps the Vercel REST API (`/v10/projects/.../domains` to attach, `/v6/domains/.../config` to detect DNS misconfiguration, `/v9/...` to refresh + remove). Reads `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, optional `VERCEL_TEAM_ID`. **Mocks every call when `VERCEL_TOKEN` is unset** so local dev works. `VERCEL_ENV === 'preview'` auto-passes `gitBranch: 'staging'` on attach so staging-side adds don't hit prod. **A domain is `verified` only when both ownership-verified AND DNS-configured** — Vercel's `verified:true` flag alone is misleading (it auto-passes for subdomains of owned apex domains, even with no DNS set).

**Public render path.** `src/app/q/[slug]/page.tsx` reads `headers().get('host')`, finds `project_domains` by host with `verification_status='verified'`, then looks up the questionnaire by `(domain_id, slug)`. Studio hosts (`studio.convertiq.de`, `staging.studio.convertiq.de`, `localhost:*`, `*.vercel.app`) always `notFound()` on `/q/*` — there is no fallback canonical URL. Slug uniqueness is per-domain (partial unique index `WHERE domain_id IS NOT NULL`); drafts without a domain can share slugs freely.

**Design system.** Defined entirely in `src/app/globals.css` — CSS custom properties for Apple-style palette, fill levels, button styles (`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-bordered`), light + dark via `prefers-color-scheme`. Many CSS Modules consume these vars — don't rename them.

**Ad editor internals** (`src/app/dashboard/ads/_*`):
- `_model/nodes.ts` — discriminated union `frame | text | shape | image | icon`. Every node has `transform` with optional `widthMode` / `heightMode` (`'fixed' | 'fill' | 'relative' | 'fit'`).
- `_model/autolayout.ts` — layout solver. `resolveAxis()` handles all 4 sizing modes; `layoutAutoChildren` positions auto-layout participants.
- `_store/editor.ts` — Zustand + Immer with past/future doc stacks for undo/redo.
- `_components/Stage.tsx` + `Renderer.tsx` — Konva stage + recursive node renderer.
- `_export/png.ts` — offscreen Konva stage → dataURL for PNG export.

**Questionnaire renderer split.** `/dashboard/questionnaire/[id]` is the editor (themed by us). `QuestionnaireRenderer.tsx` (used by both the public page and `PreviewRenderer`) is user-themed via `published.module.css`. **Don't restyle these** — the user controls their look.

**Publish flow.** Toggling publish in the editor requires picking a verified project domain + a unique slug. Saving writes `domain_id`, `slug`, `is_published` to `questionnaires`. A unique-constraint violation (PG `23505`) on save = slug already taken on that domain; surface it cleanly. The public URL is `https://{domain}/{slug}`.

## Conventions

- **No emojis in UI.** Use Lucide icons.
- **No hover-lift / shadow-grow animations** on cards.
- **No dashed "create new" placeholder cards.** Creation lives in toolbars.
- **Buttons:** `.btn-primary` filled pill, `.btn-secondary` tinted pill — both `--accent`. No bouncy hover.
- **Same-level items:** white bg + `--separator` border. **Elevated chrome** (sidebar, toolbars): light grey.
- **Keep CSS variable names stable** — many modules consume them.

## Don't-touch zones

- Design editor + `PreviewRenderer` + `QuestionnaireRenderer` + `published.module.css` — user-themed.

## Gotchas

- **Server-only utils** (`createClient` from `src/lib/supabase/server.ts`, `getActiveProject`, `listProjects`, the Vercel wrapper) — don't import from client components.
- **Server components can't reliably set cookies** — the supabase server.ts has a try/catch for this. Cookie writes happen only from route handlers / server actions.
- **Per-domain slug uniqueness is a partial unique index** (`WHERE domain_id IS NOT NULL`). Drafts without a domain can share slugs.
- **Vercel `verified:true` alone is misleading** — always combine with `misconfigured` from `/v6/domains/.../config`.
- **The Vercel wrapper logs `[vercel.ts] Running in MOCK mode...`** to Vercel logs when env vars are missing on a deploy — diagnostic for silent mock fallback.
- **Next.js install has breaking changes from training data.** When unsure about an API, read `node_modules/next/dist/docs/` instead of assuming.

## Environment + deploy flow

Three environments, gated by `process.env.NEXT_PUBLIC_VERCEL_ENV`:

| env | URL | Supabase | Badge |
|---|---|---|---|
| local | `localhost:3000` | staging project | red border + "LOCAL" |
| preview/staging | `staging.studio.convertiq.de` | staging project | orange border + "STAGING" |
| production | `studio.convertiq.de` | prod project | none |

The env banner lives in `src/app/layout.tsx`.

**Git flow:**
- `staging` is the default working branch. `git push` from `staging` auto-deploys staging.
- Prod deploys only on PR merge into `main`. Branch protection is configured as a ruleset (currently non-enforcing on free GitHub plan, but the workflow is the actual protection).

**Local env (`.env.local`)** points at the **staging** Supabase project so dev work never touches prod data.

**Supabase migrations:** apply manually to both projects (Free tier, no branching). Workflow: `supabase link --project-ref <ref>` then `supabase db push`. Always test against staging first.

@AGENTS.md