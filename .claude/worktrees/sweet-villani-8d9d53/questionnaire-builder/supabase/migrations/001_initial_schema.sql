-- ============================================================
-- Questionnaire Builder — Database Schema
-- ============================================================

-- Questionnaires
CREATE TABLE IF NOT EXISTS questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Questionnaire',
  slug TEXT UNIQUE NOT NULL,
  custom_domain TEXT UNIQUE,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('radio', 'checkbox', 'text', 'textarea', 'number', 'email', 'rating', 'dropdown')),
  title TEXT NOT NULL,
  description TEXT,
  required BOOLEAN DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  options JSONB DEFAULT '[]'::jsonb,
  validation JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branching Logic
CREATE TABLE IF NOT EXISTS question_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  is_end BOOLEAN DEFAULT FALSE
);

-- Scoring Rules
CREATE TABLE IF NOT EXISTS scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fixed', 'ai')) DEFAULT 'fixed',
  option_scores JSONB DEFAULT '{}'::jsonb,
  ai_score_min INT DEFAULT 0,
  ai_score_max INT DEFAULT 10,
  ai_prompt TEXT
);

-- Score Result Ranges
CREATE TABLE IF NOT EXISTS score_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE CASCADE NOT NULL,
  min_score INT NOT NULL DEFAULT 0,
  max_score INT NOT NULL DEFAULT 10,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0
);

-- Design Configuration
CREATE TABLE IF NOT EXISTS questionnaire_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE CASCADE UNIQUE NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- End-user Responses
CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL,
  total_score NUMERIC,
  result_id UUID REFERENCES score_results(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS response_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES responses(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  answer JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC,
  ai_reasoning TEXT,
  answered_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_answers ENABLE ROW LEVEL SECURITY;

-- Questionnaire owners can do everything
CREATE POLICY "Users manage own questionnaires"
  ON questionnaires FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Published questionnaires are publicly readable
CREATE POLICY "Public can view published questionnaires"
  ON questionnaires FOR SELECT
  USING (is_published = true);

-- Questions: owners can manage, public can read if questionnaire is published
CREATE POLICY "Users manage own questions"
  ON questions FOR ALL
  USING (questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid()))
  WITH CHECK (questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid()));

CREATE POLICY "Public can view published questions"
  ON questions FOR SELECT
  USING (questionnaire_id IN (SELECT id FROM questionnaires WHERE is_published = true));

-- Branches: same pattern
CREATE POLICY "Users manage own branches"
  ON question_branches FOR ALL
  USING (question_id IN (SELECT id FROM questions WHERE questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid())))
  WITH CHECK (question_id IN (SELECT id FROM questions WHERE questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid())));

CREATE POLICY "Public can view published branches"
  ON question_branches FOR SELECT
  USING (question_id IN (SELECT id FROM questions WHERE questionnaire_id IN (SELECT id FROM questionnaires WHERE is_published = true)));

-- Scoring rules: same pattern
CREATE POLICY "Users manage own scoring"
  ON scoring_rules FOR ALL
  USING (question_id IN (SELECT id FROM questions WHERE questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid())))
  WITH CHECK (question_id IN (SELECT id FROM questions WHERE questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid())));

CREATE POLICY "Public can view published scoring"
  ON scoring_rules FOR SELECT
  USING (question_id IN (SELECT id FROM questions WHERE questionnaire_id IN (SELECT id FROM questionnaires WHERE is_published = true)));

-- Score results
CREATE POLICY "Users manage own score results"
  ON score_results FOR ALL
  USING (questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid()))
  WITH CHECK (questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid()));

CREATE POLICY "Public can view published score results"
  ON score_results FOR SELECT
  USING (questionnaire_id IN (SELECT id FROM questionnaires WHERE is_published = true));

-- Designs
CREATE POLICY "Users manage own designs"
  ON questionnaire_designs FOR ALL
  USING (questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid()))
  WITH CHECK (questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid()));

CREATE POLICY "Public can view published designs"
  ON questionnaire_designs FOR SELECT
  USING (questionnaire_id IN (SELECT id FROM questionnaires WHERE is_published = true));

-- Responses: anyone can insert (anonymous), owners can read
CREATE POLICY "Anyone can submit responses"
  ON responses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners can view responses"
  ON responses FOR SELECT
  USING (questionnaire_id IN (SELECT id FROM questionnaires WHERE user_id = auth.uid()));

-- Response answers
CREATE POLICY "Anyone can submit response answers"
  ON response_answers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners can view response answers"
  ON response_answers FOR SELECT
  USING (response_id IN (
    SELECT id FROM responses WHERE questionnaire_id IN (
      SELECT id FROM questionnaires WHERE user_id = auth.uid()
    )
  ));

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_questionnaires_user_id ON questionnaires(user_id);
CREATE INDEX IF NOT EXISTS idx_questionnaires_slug ON questionnaires(slug);
CREATE INDEX IF NOT EXISTS idx_questions_questionnaire_id ON questions(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_question_branches_question_id ON question_branches(question_id);
CREATE INDEX IF NOT EXISTS idx_scoring_rules_question_id ON scoring_rules(question_id);
CREATE INDEX IF NOT EXISTS idx_score_results_questionnaire_id ON score_results(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_responses_questionnaire_id ON responses(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_response_answers_response_id ON response_answers(response_id);
