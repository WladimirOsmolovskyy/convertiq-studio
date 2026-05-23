-- ============================================================
-- Audiences: per-questionnaire lead buckets routed by red-flag
-- count or score range.
--
-- Two rule types:
--   1. Red-flag rule (one per questionnaire, on questionnaires
--      itself): if a response's red-flag count >= threshold, the
--      lead is placed in red_flag_audience_id.
--   2. Score ranges (questionnaire_audience_score_ranges): the
--      first range whose [min_score, max_score] (inclusive,
--      either bound nullable for unbounded) contains the response
--      total_score wins.
--
-- Red-flag wins over score range. responses.audience_id is the
-- assigned bucket, persisted at save time.
--
-- Integration filters (allow-lists) live on:
--   - lead_webhooks.audience_ids (uuid[])
--   - questionnaire_integrations.config.audience_ids (JSONB)
-- NULL means "no filter, deliver all". Empty array means
-- "deliver none". Populated array means "deliver only these".
-- ============================================================

CREATE TABLE IF NOT EXISTS questionnaire_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_audiences_questionnaire_id
  ON questionnaire_audiences(questionnaire_id);

ALTER TABLE questionnaire_audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own audiences"
  ON questionnaire_audiences FOR ALL
  USING (
    questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid())
  )
  WITH CHECK (
    questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid())
  );

-- Public read so the published renderer can compute audience
-- assignment client-side from the questionnaire's config.
CREATE POLICY "Public can view audiences of published questionnaires"
  ON questionnaire_audiences FOR SELECT
  USING (
    questionnaire_id IN (SELECT id FROM questionnaires WHERE is_published = true)
  );

CREATE TABLE IF NOT EXISTS questionnaire_audience_score_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id UUID REFERENCES questionnaire_audiences(id) ON DELETE CASCADE NOT NULL,
  min_score INT,
  max_score INT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audience_score_ranges_audience_id
  ON questionnaire_audience_score_ranges(audience_id);

ALTER TABLE questionnaire_audience_score_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own audience ranges"
  ON questionnaire_audience_score_ranges FOR ALL
  USING (
    audience_id IN (
      SELECT id FROM questionnaire_audiences
      WHERE questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    audience_id IN (
      SELECT id FROM questionnaire_audiences
      WHERE questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Public can view audience ranges of published questionnaires"
  ON questionnaire_audience_score_ranges FOR SELECT
  USING (
    audience_id IN (
      SELECT id FROM questionnaire_audiences
      WHERE questionnaire_id IN (SELECT id FROM questionnaires WHERE is_published = true)
    )
  );

ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS red_flag_threshold INT,
  ADD COLUMN IF NOT EXISTS red_flag_audience_id UUID REFERENCES questionnaire_audiences(id) ON DELETE SET NULL;

ALTER TABLE responses
  ADD COLUMN IF NOT EXISTS audience_id UUID REFERENCES questionnaire_audiences(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_responses_audience_id ON responses(audience_id);

ALTER TABLE lead_webhooks
  ADD COLUMN IF NOT EXISTS audience_ids UUID[];

-- Allow questionnaire owners to UPDATE their responses so the editor
-- can recompute audience_id when the audience config changes.
DROP POLICY IF EXISTS "Owners can update responses" ON responses;
CREATE POLICY "Owners can update responses"
  ON responses FOR UPDATE
  USING (
    questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid())
  )
  WITH CHECK (
    questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid())
  );
