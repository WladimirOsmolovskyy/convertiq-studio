-- ============================================================
-- Project Brand palette (project-level shared design tokens)
-- Adds a JSONB `brand` column holding the project's color palette
-- (Background / UI / Texts / Brand groups). Questionnaire color
-- variables default from this palette; it is the most-global color
-- layer, shared across all questionnaires in the project.
--
-- Default '{}' — the app merges in `defaultBrandPalette` when a key
-- is missing, so existing projects need no backfill.
--
-- No new RLS policy required: the existing "Users manage own
-- projects" FOR ALL policy already covers this column.
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS brand JSONB NOT NULL DEFAULT '{}'::jsonb;
