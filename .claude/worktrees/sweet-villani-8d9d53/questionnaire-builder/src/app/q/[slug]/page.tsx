import { createClient } from '@/lib/supabase/server';
import { defaultDesign } from '@/lib/types';
import type { Metadata } from 'next';
import QuestionnaireRenderer from './QuestionnaireRenderer';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('questionnaires').select('title').eq('slug', slug).eq('is_published', true).single();
  return {
    title: data?.title || 'Questionnaire',
    description: `Take the "${data?.title || 'Questionnaire'}" interactive questionnaire`,
  };
}

export default async function PublishedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch questionnaire
  const { data: questionnaire } = await supabase
    .from('questionnaires')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!questionnaire) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', textAlign: 'center', flexDirection: 'column', gap: '1rem',
      }}>
        <div style={{ fontSize: '3rem' }}>🔍</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>Questionnaire not found</h1>
        <p style={{ color: 'var(--text-secondary)' }}>This questionnaire doesn&apos;t exist or is not published.</p>
      </div>
    );
  }

  // Fetch all related data
  const [questionsRes, designRes, resultsRes] = await Promise.all([
    supabase.from('questions').select('*').eq('questionnaire_id', questionnaire.id).order('sort_order'),
    supabase.from('questionnaire_designs').select('config').eq('questionnaire_id', questionnaire.id).single(),
    supabase.from('score_results').select('*').eq('questionnaire_id', questionnaire.id).order('sort_order'),
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
    />
  );
}
