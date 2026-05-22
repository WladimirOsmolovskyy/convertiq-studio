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

- **Two Supabase clients.** `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (server components, route handlers). RLS is the auth layer.
- **Ownership chain.** Questionnaires + domains both authorize through `project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())`. Public reads of published questionnaires and verified domains are explicit policies.
- **Proxy, not middleware.** Next 16 renamed middleware → proxy. File: `src/proxy.ts` exporting `proxy()`. Also rewrites custom-domain `/{slug}` → `/q/{slug}` so the public page resolves.
- **Auth callback** at `/auth/callback`. OAuth redirect URLs are registered per environment in Supabase URL Configuration.
- **Active project.** `src/lib/projects.ts` — `getActiveProject(supabase, userId)` reads the `active_project_id` httpOnly cookie, falls back to the user's first project, and auto-creates a "Default" project for new users. Cookie is set only via `POST /api/projects/active`.
- **Custom domains.** `src/lib/vercel.ts` wraps the Vercel REST API. Mocks all calls when `VERCEL_TOKEN` is unset (local dev). A domain counts as `verified` only when **ownership-verified AND DNS-configured** — Vercel's `verified:true` flag alone is misleading.
- **Public render path** (`src/app/q/[slug]/page.tsx`): reads `headers().get('host')`, looks up `project_domains` by host (must be `verified`), then finds the questionnaire by `(domain_id, slug)`. Studio hosts (`studio.*`, `localhost:*`, `*.vercel.app`) `notFound()` on `/q/*`. Slug uniqueness is per-domain (partial unique index `WHERE domain_id IS NOT NULL`); drafts without a domain can share slugs.
- **Design system** lives in `src/app/globals.css` — CSS variables for Apple palette, fill levels, button styles (`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-bordered`), light + dark via `prefers-color-scheme`. Many CSS Modules consume these vars — don't rename them.
- **Questionnaire renderer** is shared: `QuestionnaireRenderer.tsx` powers both the public page and the editor preview, styled at runtime via `published.module.css` through the design editor. Don't bake colors/spacing/fonts here — those are user-controlled.
- **Ad editor internals** (`src/app/dashboard/ads/_*`):
  - `_model/nodes.ts` — discriminated union `frame | text | shape | image | icon`; each node has `transform` with `widthMode`/`heightMode` (`fixed | fill | relative | fit`)
  - `_model/autolayout.ts` — layout solver (`resolveAxis`, `layoutAutoChildren`)
  - `_store/editor.ts` — Zustand + Immer with past/future stacks for undo/redo
  - `_components/Stage.tsx` + `Renderer.tsx` — Konva stage + recursive renderer
  - `_export/png.ts` — offscreen Konva stage → dataURL

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
- **Vercel mock mode** logs `[vercel.ts] Running in MOCK mode...` when env vars are missing on a deploy. Diagnostic for silent fallback.
- **Publish save** returning PG `23505` = slug taken on that domain. Surface it cleanly.

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

@AGENTS.md
