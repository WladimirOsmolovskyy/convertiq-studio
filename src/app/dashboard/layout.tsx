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

  return (
    <SidebarInner
      projects={projects}
      activeProjectId={active.id}
      userEmail={user.email ?? ''}
    >
      {children}
    </SidebarInner>
  );
}
