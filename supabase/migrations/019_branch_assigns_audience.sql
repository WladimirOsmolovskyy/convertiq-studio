-- ============================================================
-- Let a branch assign the visitor to an audience mid-flow.
--
-- Audiences were previously assigned only post-hoc (score range or
-- red-flag threshold). This adds an explicit per-branch assignment that
-- wins over those rules at submit. ON DELETE SET NULL mirrors the
-- existing questionnaires.red_flag_audience_id behaviour, so deleting an
-- audience leaves dangling branches harmless. RLS is inherited from the
-- existing question_branches policies (the new column needs no new policy).
-- ============================================================

ALTER TABLE question_branches
  ADD COLUMN IF NOT EXISTS assign_audience_id UUID
  REFERENCES questionnaire_audiences(id) ON DELETE SET NULL;
