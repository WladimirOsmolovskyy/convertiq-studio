import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveProject } from '@/lib/projects';
import type { AdTemplateRow } from '@/lib/adTemplates';
import TemplatesList from './_components/TemplatesList';

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const active = await getActiveProject(supabase, user.id);

  const { data } = await supabase
    .from('ad_templates')
    .select('*')
    .eq('project_id', active.id)
    .order('updated_at', { ascending: false });

  return (
    <TemplatesList
      key={active.id}
      initial={(data as AdTemplateRow[] | null) ?? []}
      activeProjectId={active.id}
    />
  );
}
