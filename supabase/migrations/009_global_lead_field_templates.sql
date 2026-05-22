-- ============================================================
-- Make lead_field_templates global per user
-- Templates are now scoped to the user, not to a single project,
-- so the same template (e.g. "Meta tracking") can be applied to
-- any questionnaire across any of the user's projects.
--
-- Safe to re-run: every step guards with IF [NOT] EXISTS.
-- ============================================================

-- 1. Add user_id column (nullable until backfilled).
ALTER TABLE lead_field_templates
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Backfill user_id from the owning project. This only matters while
--    project_id still exists; on a re-run after the column was dropped the
--    join simply produces zero rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_field_templates' AND column_name = 'project_id'
  ) THEN
    EXECUTE $sql$
      UPDATE lead_field_templates t
      SET user_id = p.user_id
      FROM projects p
      WHERE t.project_id = p.id AND t.user_id IS NULL
    $sql$;
  END IF;
END $$;

-- 3. Enforce NOT NULL going forward.
ALTER TABLE lead_field_templates
  ALTER COLUMN user_id SET NOT NULL;

-- 4. Drop the old owner policy BEFORE the column it depends on. The policy
--    from migration 008 references project_id; PG refuses to drop the column
--    while any policy still mentions it.
DROP POLICY IF EXISTS "Users manage own lead field templates" ON lead_field_templates;

-- 5. Drop the project link — templates are no longer project-scoped.
DROP INDEX IF EXISTS idx_lead_field_templates_project_id;
ALTER TABLE lead_field_templates
  DROP COLUMN IF EXISTS project_id;

-- 6. Recreate the owner policy gated on user_id.
CREATE POLICY "Users manage own lead field templates"
  ON lead_field_templates FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_lead_field_templates_user_id
  ON lead_field_templates(user_id);

-- The "Public can view templates of published questionnaires" policy from
-- migration 008 doesn't reference project_id, so it stays as-is.
