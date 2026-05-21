import { createClient } from '@/lib/supabase/server';
import { defaultDesign } from '@/lib/types';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import QuestionnaireRenderer from './QuestionnaireRenderer';

/**
 * Public questionnaire route. Resolves Host header → project_domain → questionnaire by
 * (domain_id, slug). Returns 404 if the host isn't a verified custom domain or the
 * slug doesn't match. There's no fallback for studio.convertiq.de/q/[slug] —
 * published questionnaires only exist on customer-owned domains.
 */

function studioHost(host: string | null): boolean {
  if (!host) return true;
  const lower = host.toLowerCase().split(':')[0];
  if (lower === 'studio.convertiq.de') return true;
  if (lower === 'staging.studio.convertiq.de') return true;
  if (lower === 'localhost' || lower === '127.0.0.1') return true;
  if (lower.endsWith('.vercel.app')) return true;
  return false;
}

async function resolveDomainId(host: string | null): Promise<string | null> {
  if (!host || studioHost(host)) return null;
  const lower = host.toLowerCase().split(':')[0];
  const supabase = await createClient();
  const { data } = await supabase
    .from('project_domains')
    .select('id')
    .eq('domain', lower)
    .eq('verification_status', 'verified')
    .maybeSingle();
  return data?.id ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const hdrs = await headers();
  const domainId = await resolveDomainId(hdrs.get('host'));
  if (!domainId) return { title: 'Not found' };
  const supabase = await createClient();
  const { data } = await supabase
    .from('questionnaires')
    .select('title')
    .eq('slug', slug)
    .eq('domain_id', domainId)
    .eq('is_published', true)
    .maybeSingle();
  return {
    title: data?.title || 'Questionnaire',
    description: `Take the "${data?.title || 'Questionnaire'}" interactive questionnaire`,
  };
}

export default async function PublishedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hdrs = await headers();
  const domainId = await resolveDomainId(hdrs.get('host'));
  if (!domainId) notFound();

  const supabase = await createClient();

  const { data: questionnaire } = await supabase
    .from('questionnaires')
    .select('*')
    .eq('slug', slug)
    .eq('domain_id', domainId)
    .eq('is_published', true)
    .maybeSingle();

  if (!questionnaire) notFound();

  const [questionsRes, designRes, resultsRes, projectRes] = await Promise.all([
    supabase.from('questions').select('*').eq('questionnaire_id', questionnaire.id).order('sort_order'),
    supabase.from('questionnaire_designs').select('config').eq('questionnaire_id', questionnaire.id).single(),
    supabase.from('score_results').select('*').eq('questionnaire_id', questionnaire.id).order('sort_order'),
    supabase.from('projects').select('lead_fields').eq('id', questionnaire.project_id).maybeSingle(),
  ]);

  const questions = questionsRes.data || [];
  const questionIds = questions.map((q: { id: string }) => q.id);

  const [branchesRes, scoringRes] = await Promise.all([
    questionIds.length > 0
      ? supabase.from('question_branches').select('*').in('question_id', questionIds)
      : Promise.resolve({ data: [] }),
    questionIds.length > 0
      ? supabase.from('scoring_rules').select('*').in('question_id', questionIds)
      : Promise.resolve({ data: [] }),
  ]);

  const design = designRes.data?.config && Object.keys(designRes.data.config).length > 0
    ? { ...defaultDesign, ...designRes.data.config }
    : defaultDesign;

  return (
    <QuestionnaireRenderer
      questionnaire={questionnaire}
      questions={questions}
      branches={branchesRes.data || []}
      scoringRules={scoringRes.data || []}
      scoreResults={resultsRes.data || []}
      design={design}
      projectLeadFields={projectRes.data?.lead_fields ?? []}
    />
  );
}
