-- ============================================================
-- Lead Field Templates
-- Reusable named bundles of lead fields, scoped to a project.
-- A questionnaire opts into a template via lead_field_template_id.
-- Editing the template propagates to every questionnaire that
-- references it; per-questionnaire lead_fields stay local.
--
-- Migrates any existing project-level lead_fields into a "Default"
-- template per project and back-links existing questionnaires.
-- projects.lead_fields is left intact but unused going forward.
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_field_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled template',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_field_templates_project_id
  ON lead_field_templates(project_id);

ALTER TABLE lead_field_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lead field templates"
  ON lead_field_templates FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Allow anonymous reads of templates referenced by a published questionnaire,
-- so the public renderer can fetch the fields.
CREATE POLICY "Public can view templates of published questionnaires"
  ON lead_field_templates FOR SELECT
  USING (id IN (
    SELECT lead_field_template_id FROM questionnaires
    WHERE is_published = true AND lead_field_template_id IS NOT NULL
  ));

-- Questionnaire -> template link
ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS lead_field_template_id UUID
    REFERENCES lead_field_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_questionnaires_lead_field_template_id
  ON questionnaires(lead_field_template_id);

-- Backfill: turn existing project-level lead_fields into a per-project
-- "Default" template and link every questionnaire in that project that
-- doesn't already have one assigned.
DO $$
DECLARE
  p RECORD;
  new_template_id UUID;
BEGIN
  FOR p IN
    SELECT id, lead_fields FROM projects
    WHERE jsonb_array_length(COALESCE(lead_fields, '[]'::jsonb)) > 0
  LOOP
    INSERT INTO lead_field_templates(project_id, name, fields)
    VALUES (p.id, 'Default', p.lead_fields)
    RETURNING id INTO new_template_id;

    UPDATE questionnaires
    SET lead_field_template_id = new_template_id
    WHERE project_id = p.id AND lead_field_template_id IS NULL;
  END LOOP;
END $$;
