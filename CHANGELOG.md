# Changelog

Staging deploys are documented here. New entries are prepended automatically
by the `stage` alias; the entry below is a curated backfill of the prototyping
sprint up to 2026-06-08.

## 2026-06-08 — prototyping sprint (backfill)

### Lead integrations
- GoHighLevel OAuth connection with per-questionnaire field mapping (custom fields + tags)
- Outbound webhook delivery + inbound fetch endpoint for lead data
- Webhook + GHL config split into dedicated Integrations sub-pages

### Audiences
- Audiences tab with score-range buckets and per-integration audience filtering
- Mid-flow audience assignment via branches + per-audience logic view tabs
- Automatic audience recompute on save (also refreshes total score)

### Result pages
- New result-page editor: canvas, inspector, layers panel, page list
- Drag-and-drop layer reordering with cross-parent moves
- Framer-style sectioned inspector; result page renders without wrapper card
- Replaced score_results with result_pages; per-question scoring moved into Content cards
- Result-page image storage bucket + variable picker chips

### Design editor
- Variables / Inspector two-tab layout; canvas element selection with per-element overrides (fill, radius, padding)
- Project-level shared brand color palette + brand inheritance with per-field override/restore
- Image background option; mobile viewport toggle (container queries); resizable sidebar

### Tools
- Background remover (Photoroom proxy) with brush refinement
- Image grid slicer

### Leads
- Lead search + chip filter toolbar

### Settings / infra
- Per-user OpenAI API key in Settings (replaces OPENAI_API_KEY env var)
- Projects multi-tenancy foundation
- Ad templates + variable bindings

### Env vars introduced this sprint
- `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET` — GoHighLevel OAuth
- `PHOTOROOM_API_KEY` — background remover
