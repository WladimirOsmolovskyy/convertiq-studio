import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveProject } from '@/lib/projects';
import type { Questionnaire } from '@/lib/types';
import QuestionnairesList from './_components/QuestionnairesList';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const active = await getActiveProject(supabase, user.id);

  const { data } = await supabase
    .from('questionnaires')
    .select('*')
    .eq('project_id', active.id)
    .order('updated_at', { ascending: false });

  return (
    <QuestionnairesList
      key={active.id}
      initial={(data as Questionnaire[] | null) ?? []}
      activeProjectId={active.id}
    />
  );
}
