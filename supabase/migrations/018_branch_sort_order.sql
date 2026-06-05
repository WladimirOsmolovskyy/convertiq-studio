-- ============================================================
-- Add per-question evaluation order to question_branches.
--
-- Branch precedence (first match wins) was previously implicit in
-- row/insert order. The Logic editor now lets authors drag-reorder
-- branches, so we persist an explicit sort_order. RLS is inherited
-- from the existing question_branches policies (no new policy needed).
-- ============================================================

ALTER TABLE question_branches
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- One-time backfill: assign a stable 0-based order per question for any
-- existing rows that are all still at the default 0.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY question_id ORDER BY id) - 1 AS rn
  FROM question_branches
)
UPDATE question_branches b
SET sort_order = ranked.rn
FROM ranked
WHERE b.id = ranked.id
  AND b.sort_order = 0;
