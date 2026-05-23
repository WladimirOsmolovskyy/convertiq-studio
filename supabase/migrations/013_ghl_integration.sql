-- ============================================================
-- GoHighLevel integration: per-project OAuth connection + per-
-- questionnaire mapping config.
--
-- ghl_connections holds the OAuth tokens for a project. One row
-- per project; if the project owner re-installs, the row is
-- upserted (refresh_token rotates, expires_at moves forward).
--
-- questionnaire_integrations is generic by `provider` to leave
-- room for future CRMs without a new table. Config is a JSONB
-- envelope so the shape can evolve per provider without
-- migrations. For provider='ghl' the config shape is:
--   {
--     finished_tag: string | null,  -- tag NAME (GHL upsert takes names)
--     field_map: Array<{ source: string, target: string }>
--   }
-- where `source` is one of:
--   - `lead_field:<lead_field_id>` (from questionnaire.lead_fields)
--   - `system:host` | `system:user_agent`
-- and `target` is a GHL field key, either a standard contact key
-- ('email','firstName','lastName','phone',...) or 'custom:<id>'.
-- ============================================================

CREATE TABLE IF NOT EXISTS ghl_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL UNIQUE,
  location_id TEXT NOT NULL,
  company_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  token_type TEXT,
  user_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ghl_connections_project_id
  ON ghl_connections(project_id);

ALTER TABLE ghl_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own ghl connections"
  ON ghl_connections FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS questionnaire_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('ghl')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_attempt_at TIMESTAMPTZ,
  last_status INT,
  last_error TEXT,
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (questionnaire_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_integrations_questionnaire_id
  ON questionnaire_integrations(questionnaire_id);

ALTER TABLE questionnaire_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own questionnaire integrations"
  ON questionnaire_integrations FOR ALL
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
