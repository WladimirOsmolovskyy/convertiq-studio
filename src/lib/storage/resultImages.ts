'use client';

/**
 * Browser-side helper for uploading result-page images to the
 * `result-images` Supabase Storage bucket. The bucket is public-read so
 * the returned URL embeds directly into image nodes — no signing.
 *
 * Path layout enforced by RLS: <user_id>/<questionnaire_id>/<uuid>.<ext>
 */

import { createClient } from '@/lib/supabase/client';

const BUCKET = 'result-images';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — matches the bucket limit.
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

export interface UploadedImage {
  /** Public URL ready to use as a node `src`. */
  url: string;
  /** Storage path (for future delete/replace flows). */
  path: string;
}

export async function uploadResultImage(
  file: File,
  questionnaireId: string,
): Promise<UploadedImage> {
  if (file.size > MAX_BYTES) {
    const mb = (MAX_BYTES / 1024 / 1024).toFixed(0);
    throw new Error(`Image is too large. Max ${mb} MB.`);
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || 'unknown'}.`);
  }

  const supabase = createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    throw new Error('You must be signed in to upload images.');
  }

  // Sanitize filename / pick an extension. We don't trust the name —
  // path uses a fresh UUID, only the extension is taken from the file.
  const ext =
    file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${userData.user.id}/${questionnaireId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) {
    throw new Error(upErr.message);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: urlData.publicUrl, path };
}
