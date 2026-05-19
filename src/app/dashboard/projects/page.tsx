import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listProjects, getActiveProject } from '@/lib/projects';
import ProjectsManager from './_ProjectsManager';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const projects = await listProjects(supabase);
  const active = await getActiveProject(supabase, user.id);

  const { data: rows } = await supabase
    .from('questionnaires')
    .select('project_id');

  const counts: Record<string, number> = {};
  for (const r of (rows as { project_id: string }[] | null) ?? []) {
    counts[r.project_id] = (counts[r.project_id] ?? 0) + 1;
  }

  return (
    <ProjectsManager
      initialProjects={projects}
      activeProjectId={active.id}
      initialCounts={counts}
    />
  );
}
