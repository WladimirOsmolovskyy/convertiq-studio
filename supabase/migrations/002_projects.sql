-- ============================================================
-- Projects (multi-tenancy foundation)
-- Adds a Projects layer between users and questionnaires.
-- This migration is paired with 003_project_id_notnull.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own projects"
  ON projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add nullable project_id to questionnaires. ON DELETE RESTRICT prevents
-- accidental orphan questionnaires — deletion goes through app logic
-- which either blocks or moves the questionnaires first.
ALTER TABLE questionnaires
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_questionnaires_project_id ON questionnaires(project_id);

-- Backfill: one 'Default' project per user that has questionnaires.
-- Existing questionnaires get linked to their owner's new project.
WITH new_projects AS (
  INSERT INTO projects (user_id, name)
  SELECT DISTINCT user_id, 'Default' FROM questionnaires
  WHERE user_id NOT IN (SELECT user_id FROM projects)
  RETURNING id, user_id
)
UPDATE questionnaires q
   SET project_id = np.id
  FROM new_projects np
 WHERE q.user_id = np.user_id
   AND q.project_id IS NULL;

-- Temporary safety net: between 002 and 003 the column is nullable, so
-- if the app inserts a questionnaire without project_id, this trigger
-- fills it from the user's earliest project. Dropped in 003.
CREATE OR REPLACE FUNCTION ensure_questionnaire_project()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
    SELECT id INTO NEW.project_id
      FROM projects
     WHERE user_id = NEW.user_id
     ORDER BY created_at
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_questionnaire_project ON questionnaires;
CREATE TRIGGER trg_questionnaire_project
  BEFORE INSERT ON questionnaires
  FOR EACH ROW
  EXECUTE FUNCTION ensure_questionnaire_project();
