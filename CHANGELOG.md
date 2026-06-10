## 2026-06-10 14:43

- chore(config): allow land command in agent permissions
- feat: add undo/redo to the questionnaire editor
- feat(design): switch letter-spacing to pixels
- feat(design): show the padding controls in pixels
- feat(logic): add draggable port to redirect a question's default path
- feat(logic): center flow tree evenly + drag cards to reorder branches
- feat(design): make the selected-answer fill + border designable
- feat(design): default the progress fill to the brand accent color
- fix(design): collapse the two back-button toggles into one
- feat(result): delete the selected block with the delete key
- feat(result): add a full-screen result-page preview
- feat(result): show + edit the real page background in the designer

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
