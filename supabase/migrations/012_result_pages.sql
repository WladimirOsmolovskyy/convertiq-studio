-- ============================================================
-- Result Pages: rich, themable end-of-questionnaire pages.
--
-- Replaces score_results (min/max/title/description) with a richer
-- model that owns the score range AND a block-tree `content` JSONB
-- authored in the new Result tab. The block tree is a single root
-- frame containing text/image/frame children (autolayout, mirroring
-- the ad editor's node shape but rendered to the DOM with flexbox).
--
-- Existing score_results rows are migrated in-place: each row becomes
-- one result_pages row with the same UUID (so responses.result_id FK
-- can be repointed without breaking referential integrity). The old
-- title + description are seeded into the content tree as two
-- centered text blocks so existing questionnaires don't regress
-- visually before the block renderer is wired up.
-- ============================================================

CREATE TABLE IF NOT EXISTS result_pages (
  id UUID PRIMARY KEY,
  questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Result',
  min_score INT NOT NULL DEFAULT 0,
  max_score INT NOT NULL DEFAULT 10,
  sort_order INT NOT NULL DEFAULT 0,
  -- Root frame node (object, not array). See ResultPage in src/lib/types.ts.
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_result_pages_questionnaire_id ON result_pages(questionnaire_id);

-- ─── Migrate score_results → result_pages ─────────────────────
-- Keep the same UUID so we can repoint responses.result_id below.

INSERT INTO result_pages (id, questionnaire_id, name, min_score, max_score, sort_order, content, created_at, updated_at)
SELECT
  sr.id,
  sr.questionnaire_id,
  COALESCE(NULLIF(sr.title, ''), 'Result'),
  sr.min_score,
  sr.max_score,
  COALESCE(sr.sort_order, 0),
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'type', 'frame',
    'direction', 'column',
    'gap', 16,
    'padding', jsonb_build_object('top', 32, 'right', 24, 'bottom', 32, 'left', 24),
    'align', 'center',
    'justify', 'start',
    'children', jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'text',
        'spans', jsonb_build_array(
          jsonb_build_object('type', 'text', 'value', COALESCE(sr.title, ''))
        ),
        'fontSize', 28,
        'fontWeight', 700,
        'textAlign', 'center'
      ),
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'text',
        'spans', jsonb_build_array(
          jsonb_build_object('type', 'text', 'value', COALESCE(sr.description, ''))
        ),
        'fontSize', 16,
        'fontWeight', 400,
        'textAlign', 'center'
      )
    )
  ),
  NOW(),
  NOW()
FROM score_results sr
ON CONFLICT (id) DO NOTHING;

-- ─── Repoint responses.result_id FK from score_results → result_pages ───
-- The IDs are preserved by the INSERT above, so existing response rows
-- continue to point at the right page.

ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_result_id_fkey;
ALTER TABLE responses
  ADD CONSTRAINT responses_result_id_fkey
  FOREIGN KEY (result_id) REFERENCES result_pages(id) ON DELETE SET NULL;

-- ─── Drop old table ────────────────────────────────────────────
DROP TABLE IF EXISTS score_results;

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE result_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own result pages"
  ON result_pages FOR ALL
  USING (questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid()))
  WITH CHECK (questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid()));

CREATE POLICY "Public can view published result pages"
  ON result_pages FOR SELECT
  USING (questionnaire_id IN (SELECT id FROM questionnaires WHERE is_published = true));
