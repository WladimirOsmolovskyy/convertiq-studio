-- A "default branch" stores where a question's fall-through (no-condition)
-- path leads, so authors can drag it instead of it always being the next
-- question by order. is_default branches carry no condition; only their
-- target_question_id / is_end is meaningful, evaluated last in branchFlow.
ALTER TABLE question_branches
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;
