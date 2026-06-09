-- ============================================================
-- Result-page image storage
--
-- Public bucket where authors upload images used inside Result pages
-- (logos, hero images, CTAs). Files live at:
--     result-images/<user_id>/<questionnaire_id>/<uuid>.<ext>
--
-- The folder-by-user prefix is what RLS enforces — auth.uid() must match
-- the first path segment for writes. SELECT is public because the result
-- pages are served on customer domains where no auth is available.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'result-images',
  'result-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── RLS policies on storage.objects ─────────────────────────────
-- Drop-then-create so re-running the migration cleanly updates policies.

DROP POLICY IF EXISTS "Users upload own result images" ON storage.objects;
CREATE POLICY "Users upload own result images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'result-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own result images" ON storage.objects;
CREATE POLICY "Users update own result images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'result-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own result images" ON storage.objects;
CREATE POLICY "Users delete own result images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'result-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Public read result images" ON storage.objects;
CREATE POLICY "Public read result images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'result-images');
