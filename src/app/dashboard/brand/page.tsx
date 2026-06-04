import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveProject } from '@/lib/projects';
import { defaultBrandPalette, type BrandPalette } from '@/lib/types';
import BrandEditor from './_BrandEditor';

/**
 * Brand tab — the project-level shared color palette. This is the most
 * global color layer: questionnaire color variables default from here.
 *
 * Server component resolves the active project, merges stored brand over
 * defaults (so missing tokens always have a value), and hands the full
 * palette to the client editor.
 */
export default async function BrandPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const active = await getActiveProject(supabase, user.id);
  const stored = (active.brand ?? {}) as BrandPalette;
  const palette = { ...defaultBrandPalette, ...stored };

  return (
    <BrandEditor
      projectId={active.id}
      projectName={active.name}
      initialPalette={palette}
    />
  );
}
