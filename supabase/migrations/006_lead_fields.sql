-- ============================================================
-- Lead Fields
-- Each questionnaire can define a list of custom fields that get
-- silently captured from URL query parameters when a visitor lands
-- on the published page (e.g. ?utm_campaign=foo).
-- Captured values are stored on `responses.metadata.lead_fields`.
-- ============================================================

ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS lead_fields JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Shape: [{ id: uuid, label: string, urlParam: string }]
