-- ============================================================
-- Ad Templates & Generations
-- Database schemas to support saving ad designs as templates,
-- defining dynamic variables, and recording generation instances.
-- ============================================================

CREATE TABLE IF NOT EXISTS ad_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Ad Template',
  document JSONB NOT NULL, -- Full AdDocument JSON containing size, root frame node, variables list, etc.
  variables JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of variable definitions
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES ad_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Ad Generation',
  values JSONB NOT NULL DEFAULT '{}'::jsonb, -- Key-value map of variable ID -> user input value
  selected_sizes JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of selected size names for export
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for fast project queries and template joins
CREATE INDEX IF NOT EXISTS idx_ad_templates_project_id ON ad_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_ad_generations_project_id ON ad_generations(project_id);
CREATE INDEX IF NOT EXISTS idx_ad_generations_template_id ON ad_generations(template_id);

-- Enable RLS
ALTER TABLE ad_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_generations ENABLE ROW LEVEL SECURITY;

-- Security Policies scoped to project access
CREATE POLICY "Users manage own ad templates"
  ON ad_templates FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own ad generations"
  ON ad_generations FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
