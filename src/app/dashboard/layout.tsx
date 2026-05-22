import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  listProjects,
  ensureDefaultProject,
  getActiveProject,
} from '@/lib/projects';
import SidebarInner from './_components/SidebarInner';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let projects = await listProjects(supabase);
  if (projects.length === 0) {
    await ensureDefaultProject(supabase, user.id);
    projects = await listProjects(supabase);
  }
  const active = await getActiveProject(supabase, user.id);

  const [questionnairesRes, adTemplatesRes] = await Promise.all([
    supabase
      .from('questionnaires')
      .select('id, title, slug, is_published, updated_at, domain:project_domains(domain)')
      .eq('project_id', active.id)
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase
      .from('ad_templates')
      .select('id, title, updated_at')
      .eq('project_id', active.id)
      .order('updated_at', { ascending: false })
      .limit(50),
  ]);

  const questionnaires = (questionnairesRes.data ?? []).map((q) => ({
    id: q.id,
    title: q.title,
    slug: q.slug,
    is_published: q.is_published,
    updated_at: q.updated_at,
    domain: Array.isArray(q.domain) ? q.domain[0] ?? null : q.domain ?? null,
  }));
  const adTemplates = adTemplatesRes.data ?? [];

  return (
    <SidebarInner
      projects={projects}
      activeProjectId={active.id}
      userEmail={user.email ?? ''}
      questionnaires={questionnaires}
      adTemplates={adTemplates}
    >
      {children}
    </SidebarInner>
  );
}
