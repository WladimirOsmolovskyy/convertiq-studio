-- ============================================================
-- Project-level Lead Fields
-- Shared field definitions that apply to every questionnaire in
-- the project. Effective fields for a renderer/lead view are the
-- union of project.lead_fields + questionnaires.lead_fields,
-- deduplicated by urlParam (questionnaire-level wins).
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS lead_fields JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Shape: [{ id: uuid, label: string, urlParam: string }]
