-- ============================================================
-- Per-user API keys (currently: OpenAI)
-- Replaces the previous OPENAI_API_KEY env var. Each user supplies
-- their own key via dashboard Settings. Looked up server-side when
-- AI features run (e.g. /api/ai-score for open-answer scoring).
--
-- Storage tradeoff: plaintext column, RLS-scoped to auth.uid().
-- Reads only happen server-side; the value is never returned to the
-- client (only a masked form). pgsodium-based at-rest encryption
-- can be layered later if needed.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key_type TEXT NOT NULL CHECK (key_type IN ('openai')),
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, key_type)
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own api keys"
  ON user_api_keys FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
