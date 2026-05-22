import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveProject } from '@/lib/projects';
import type { AdGenerationRow, AdTemplateRow } from '@/lib/adTemplates';
import GenerationsList from './_components/GenerationsList';

export default async function GenerationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const active = await getActiveProject(supabase, user.id);

  const [gensRes, tplsRes] = await Promise.all([
    supabase
      .from('ad_generations')
      .select('*')
      .eq('project_id', active.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('ad_templates')
      .select('id, title')
      .eq('project_id', active.id),
  ]);

  const generations = (gensRes.data as AdGenerationRow[] | null) ?? [];
  const templates = (tplsRes.data as Pick<AdTemplateRow, 'id' | 'title'>[] | null) ?? [];

  return (
    <GenerationsList
      key={active.id}
      generations={generations}
      templates={templates}
      activeProjectId={active.id}
    />
  );
}
