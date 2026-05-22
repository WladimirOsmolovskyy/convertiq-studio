import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveProject } from '@/lib/projects';
import type { AdGenerationRow, AdTemplateRow } from '@/lib/adTemplates';
import GenerateView from '../../templates/[id]/generate/_components/GenerateView';

export default async function GenerationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const active = await getActiveProject(supabase, user.id);

  const { data: gen, error: gErr } = await supabase
    .from('ad_generations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (gErr || !gen) notFound();
  const generationRow = gen as AdGenerationRow;
  if (!generationRow.template_id) notFound();

  const { data: tpl, error: tErr } = await supabase
    .from('ad_templates')
    .select('*')
    .eq('id', generationRow.template_id)
    .maybeSingle();

  if (tErr || !tpl) notFound();

  return (
    <GenerateView
      template={tpl as AdTemplateRow}
      generation={generationRow}
      activeProjectId={active.id}
    />
  );
}
