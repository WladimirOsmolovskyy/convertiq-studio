import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveProject } from '@/lib/projects';
import type { AdTemplateRow } from '@/lib/adTemplates';
import GenerateView from './_components/GenerateView';

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const active = await getActiveProject(supabase, user.id);

  const { data, error } = await supabase
    .from('ad_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) notFound();

  return (
    <GenerateView
      template={data as AdTemplateRow}
      activeProjectId={active.id}
    />
  );
}
