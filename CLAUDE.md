# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Convertiq Studio — a multi-tool marketing suite. Two distinct sub-apps live inside one Next.js app:

1. **Questionnaire builder** (`/dashboard` + `/dashboard/questionnaire/[id]`) — mature: branching logic, scoring, custom design, public renderer at `/q/[slug]`.
2. **Static Ad Editor** (`/dashboard/ads`) — newer: Konva-based design canvas with Framer-style sizing modes, auto-layout, PNG export.

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

**Two Supabase clients.** `src/lib/supabase/client.ts` for browser; `src/lib/supabase/server.ts` for server components and Route Handlers. RLS policies (see `supabase/migrations/001_initial_schema.sql`) are the authoritative authorization layer — server checks rely on `auth.uid()` matching `user_id`.

**Auth callback.** `/auth/callback` exchanges the Supabase code for a session. OAuth redirect URLs must be registered per environment in Supabase Auth → URL Configuration.

**Proxy, not middleware.** Next 16 renamed middleware → proxy. The file is `src/proxy.ts` exporting a `proxy()` function. Don't recreate `middleware.ts`.

**Design system.** Defined entirely in `src/app/globals.css` — CSS custom properties for Apple-style palette, fill levels, button styles (`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-bordered`), light + dark via `prefers-color-scheme`. Many CSS Modules consume these vars — don't rename them.

**Ad editor internals** (`src/app/dashboard/ads/_*`):
- `_model/nodes.ts` — discriminated union `frame | text | shape | image | icon`. Every node has `transform` with optional `widthMode` / `heightMode` (`'fixed' | 'fill' | 'relative' | 'fit'`).
- `_model/autolayout.ts` — layout solver. `resolveAxis()` handles all 4 sizing modes; `layoutAutoChildren` positions auto-layout participants.
- `_store/editor.ts` — Zustand + Immer with past/future doc stacks for undo/redo.
- `_components/Stage.tsx` + `Renderer.tsx` — Konva stage + recursive node renderer.
- `_export/png.ts` — offscreen Konva stage → dataURL for PNG export.

**Questionnaire renderer split.** `/dashboard/questionnaire/[id]` is the editor (themed by us). `/q/[slug]` and `PreviewRenderer` are user-themed via `published.module.css`. **Don't restyle these** — the user controls their look.

## Conventions

- **No emojis in UI.** Use Lucide icons.
- **No hover-lift / shadow-grow animations** on cards.
- **No dashed "create new" placeholder cards.** Creation lives in toolbars.
- **Buttons:** `.btn-primary` filled pill, `.btn-secondary` tinted pill — both `--accent`. No bouncy hover.
- **Same-level items:** white bg + `--separator` border. **Elevated chrome** (sidebar, toolbars): light grey.
- **Keep CSS variable names stable** — many modules consume them.

## Don't-touch zones

- Design editor + `PreviewRenderer` + public `/q/[slug]` + `published.module.css` — user-themed.

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