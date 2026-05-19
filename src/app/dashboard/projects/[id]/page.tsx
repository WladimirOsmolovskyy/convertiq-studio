import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Project, ProjectDomain } from '@/lib/types';
import DomainsManager from './_DomainsManager';

type Ctx = { params: Promise<{ id: string }> };

export default async function ProjectDetailPage({ params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!project) notFound();

  const { data: domains } = await supabase
    .from('project_domains')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true });

  const { data: linked } = await supabase
    .from('questionnaires')
    .select('domain_id')
    .eq('project_id', id);

  const counts: Record<string, number> = {};
  for (const r of (linked as { domain_id: string | null }[] | null) ?? []) {
    if (r.domain_id) counts[r.domain_id] = (counts[r.domain_id] ?? 0) + 1;
  }

  return (
    <DomainsManager
      project={project as Project}
      initialDomains={(domains as ProjectDomain[] | null) ?? []}
      questionnaireCounts={counts}
    />
  );
}
