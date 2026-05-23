import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AnswersMap, Audience, Question } from '@/lib/types';
import { assignAudience, countRedFlags } from '@/lib/audiences/assign';

/**
 * Recompute responses.audience_id for every response of a questionnaire
 * using the current audience config. Triggered fire-and-forget after the
 * editor saves audience-affecting changes (red-flag toggles, audience
 * CRUD, range CRUD, red-flag rule edits).
 *
 * Auth: owner-only. We use the auth client throughout — RLS already
 * scopes reads + updates to questionnaires the caller owns, and the
 * UPDATE policy in migration 014 covers the writes.
 *
 * Idempotent: only writes when the computed audience_id differs from
 * what's already stored. total_score is not recomputed (scoring config
 * changes are out of scope here).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const questionnaireId =
    body && typeof body === 'object' && typeof (body as { questionnaire_id?: unknown }).questionnaire_id === 'string'
      ? (body as { questionnaire_id: string }).questionnaire_id
      : null;
  if (!questionnaireId) {
    return NextResponse.json({ error: 'questionnaire_id required' }, { status: 400 });
  }

  // RLS makes this empty if the caller doesn't own the questionnaire.
  const { data: questionnaire } = await supabase
    .from('questionnaires')
    .select('id, red_flag_threshold, red_flag_audience_id')
    .eq('id', questionnaireId)
    .maybeSingle();
  if (!questionnaire) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [questionsRes, audiencesRes, responsesRes] = await Promise.all([
    supabase
      .from('questions')
      .select('id, type, title, required, sort_order, options, validation, questionnaire_id')
      .eq('questionnaire_id', questionnaireId),
    supabase
      .from('questionnaire_audiences')
      .select('*, questionnaire_audience_score_ranges(*)')
      .eq('questionnaire_id', questionnaireId)
      .order('sort_order'),
    supabase
      .from('responses')
      .select('id, total_score, audience_id')
      .eq('questionnaire_id', questionnaireId),
  ]);

  const questions = (questionsRes.data ?? []) as Question[];

  type AudienceRow = {
    id: string;
    questionnaire_id: string;
    name: string;
    color: string | null;
    sort_order: number;
    questionnaire_audience_score_ranges: Array<{
      id: string;
      audience_id: string;
      min_score: number | null;
      max_score: number | null;
      sort_order: number;
    }>;
  };
  const audiences: Audience[] = ((audiencesRes.data ?? []) as AudienceRow[]).map((a) => ({
    id: a.id,
    questionnaire_id: a.questionnaire_id,
    name: a.name,
    color: a.color,
    sort_order: a.sort_order,
    score_ranges: [...(a.questionnaire_audience_score_ranges ?? [])].sort(
      (x, y) => x.sort_order - y.sort_order,
    ),
  }));

  const responses = (responsesRes.data ?? []) as Array<{
    id: string;
    total_score: number | null;
    audience_id: string | null;
  }>;
  if (responses.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  // One bulk read of all answers keyed by response id. Saves a round-trip
  // per response at the cost of memory; fine for typical lead volumes.
  const responseIds = responses.map((r) => r.id);
  const { data: answerRows } = await supabase
    .from('response_answers')
    .select('response_id, question_id, answer')
    .in('response_id', responseIds);

  const answersByResponse = new Map<string, AnswersMap>();
  for (const row of (answerRows ?? []) as Array<{
    response_id: string;
    question_id: string;
    answer: { value?: string; selected_options?: string[] } | null;
  }>) {
    if (!row.answer) continue;
    const existing = answersByResponse.get(row.response_id) ?? {};
    existing[row.question_id] = row.answer;
    answersByResponse.set(row.response_id, existing);
  }

  let updated = 0;
  for (const r of responses) {
    const answers = answersByResponse.get(r.id) ?? {};
    const redFlagCount = countRedFlags(questions, answers);
    const nextAudienceId = assignAudience({
      totalScore: r.total_score ?? 0,
      redFlagCount,
      redFlagThreshold: questionnaire.red_flag_threshold ?? null,
      redFlagAudienceId: questionnaire.red_flag_audience_id ?? null,
      audiences,
    });
    if (nextAudienceId === r.audience_id) continue;
    const { error } = await supabase
      .from('responses')
      .update({ audience_id: nextAudienceId })
      .eq('id', r.id);
    if (!error) updated += 1;
  }

  return NextResponse.json({ ok: true, updated });
}
