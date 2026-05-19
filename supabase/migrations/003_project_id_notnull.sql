-- ============================================================
-- Finalize Projects migration.
-- Apply 002 first, verify, then apply this in the same deploy window.
-- ============================================================

-- All existing rows are backfilled by 002. Lock the column.
ALTER TABLE questionnaires
  ALTER COLUMN project_id SET NOT NULL;

-- Drop the safety trigger; the app now always supplies project_id.
DROP TRIGGER IF EXISTS trg_questionnaire_project ON questionnaires;
DROP FUNCTION IF EXISTS ensure_questionnaire_project();

-- Swap questionnaire ownership policy from user_id-based to project-based.
-- Project ownership becomes the single source of truth, so future
-- collaboration (project_members) plugs in here without further migration.
DROP POLICY IF EXISTS "Users manage own questionnaires" ON questionnaires;

CREATE POLICY "Users manage questionnaires in own projects"
  ON questionnaires FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Nested tables (questions, branches, scoring_rules, score_results,
-- questionnaire_designs, responses, response_answers) all gate on
-- "questionnaire owned by user", which still works via the new policy.
-- The public "is_published = true" policies are unchanged.
