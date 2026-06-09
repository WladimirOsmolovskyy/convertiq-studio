-- ============================================================
-- Allow questionnaire owners to UPDATE their responses so the
-- editor can recompute audience_id when the audience config
-- changes.
--
-- Extracted from a late edit to 014_audiences.sql so this RLS
-- policy actually reaches the staging/prod Supabase projects
-- (014 was already applied; modifying it post-apply is a no-op).
-- ============================================================

DROP POLICY IF EXISTS "Owners can update responses" ON responses;
CREATE POLICY "Owners can update responses"
  ON responses FOR UPDATE
  USING (
    questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid())
  )
  WITH CHECK (
    questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid())
  );
