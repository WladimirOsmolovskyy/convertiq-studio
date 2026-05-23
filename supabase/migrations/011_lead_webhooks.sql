-- ============================================================
-- Lead webhooks: per-questionnaire outbound destinations.
--
-- A completed lead fires a POST to each enabled row's URL. The
-- payload is the stable LeadPayload shape (src/lib/leadPayload.ts)
-- so consumers like GoHighLevel can configure mapping once.
--
-- Reliability model: fire-and-forget per delivery, but the last
-- attempt's outcome is summarized on the row itself (last_status,
-- last_error, last_attempt_at, last_success_at) so users can spot
-- broken destinations from the dashboard.
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE CASCADE NOT NULL,
  label TEXT,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_attempt_at TIMESTAMPTZ,
  last_status INT,
  last_error TEXT,
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_webhooks_questionnaire_id
  ON lead_webhooks(questionnaire_id);

ALTER TABLE lead_webhooks ENABLE ROW LEVEL SECURITY;

-- Owners (via questionnaires.user_id) fully manage their webhooks.
CREATE POLICY "Owners manage own lead webhooks"
  ON lead_webhooks FOR ALL
  USING (
    questionnaire_id IN (
      SELECT id FROM questionnaires WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    questionnaire_id IN (
      SELECT id FROM questionnaires WHERE user_id = auth.uid()
    )
  );
