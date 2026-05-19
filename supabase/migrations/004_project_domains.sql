-- ============================================================
-- Project Domains + per-domain slug uniqueness
-- Phase 2 of the multi-tenant rollout. Pairs with src/lib/vercel.ts
-- which programmatically attaches these domains to the Vercel project.
-- ============================================================

CREATE TABLE IF NOT EXISTS project_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verifying', 'verified', 'error')),
  vercel_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_domains_project_id ON project_domains(project_id);
CREATE INDEX IF NOT EXISTS idx_project_domains_domain ON project_domains(domain);

ALTER TABLE project_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage domains in own projects"
  ON project_domains FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Public read of verified domains so /q/[slug] can resolve host without auth.
CREATE POLICY "Public can read verified domains"
  ON project_domains FOR SELECT
  USING (verification_status = 'verified');

-- Link questionnaires to a domain. Nullable because a draft might not have one yet.
ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES project_domains(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_questionnaires_domain_id ON questionnaires(domain_id);

-- Replace global slug uniqueness with per-domain uniqueness (only for rows with a domain).
ALTER TABLE questionnaires DROP CONSTRAINT IF EXISTS questionnaires_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_questionnaires_domain_slug
  ON questionnaires(domain_id, slug)
  WHERE domain_id IS NOT NULL;

-- The custom_domain column on questionnaires was never wired up. project_domains.domain
-- is the source of truth from here on.
ALTER TABLE questionnaires DROP COLUMN IF EXISTS custom_domain;
