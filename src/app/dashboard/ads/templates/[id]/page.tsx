import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AdTemplateRow } from '@/lib/adTemplates';
import TemplateEditor from './_components/TemplateEditor';

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('ad_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) notFound();

  return <TemplateEditor template={data as AdTemplateRow} />;
}
