import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AnswersMap, Audience, Question, QuestionBranch, ScoringRule } from '@/lib/types';
import { assignAudience, countRedFlags } from '@/lib/audiences/assign';
import { resolveBranchAudience } from '@/lib/audiences/branchFlow';
import { calculateTotalScore } from '@/lib/scoring';

/**
 * Refresh total_score + audience_id for every response of a questionnaire
 * against the latest config. Fire-and-forget from the editor after every
 * successful save — idempotent, so over-triggering only costs the read.
 *
 * Auth: ownership is checked via the auth client (RLS). Writes go through
 * the admin client because the responses table has no owner-update policy.
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

  // Ownership check: RLS makes this null when the caller doesn't own the
  // questionnaire. Once verified, the rest runs through the admin client.
  const { data: ownedQuestionnaire } = await supabase
    .from('questionnaires')
    .select('id')
    .eq('id', questionnaireId)
    .maybeSingle();
  if (!ownedQuestionnaire) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const admin = createAdminClient();

  const { data: questionnaire } = await admin
    .from('questionnaires')
    .select('id, red_flag_threshold, red_flag_audience_id')
    .eq('id', questionnaireId)
    .maybeSingle();
  if (!questionnaire) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [questionsRes, audiencesRes, responsesRes] = await Promise.all([
    admin
      .from('questions')
      .select('id, type, title, required, sort_order, options, validation, questionnaire_id')
      .eq('questionnaire_id', questionnaireId)
      .order('sort_order'),
    admin
      .from('questionnaire_audiences')
      .select('*, questionnaire_audience_score_ranges(*)')
      .eq('questionnaire_id', questionnaireId)
      .order('sort_order'),
    admin
      .from('responses')
      .select('id, total_score, audience_id')
      .eq('questionnaire_id', questionnaireId),
  ]);

  const questions = (questionsRes.data ?? []) as Question[];

  const questionIds = questions.map((q) => q.id);
  const { data: scoringRulesData } = questionIds.length > 0
    ? await admin
        .from('scoring_rules')
        .select('id, question_id, type, option_scores, ai_score_min, ai_score_max, ai_prompt')
        .in('question_id', questionIds)
    : { data: [] as ScoringRule[] };
  const scoringRules = (scoringRulesData ?? []) as ScoringRule[];

  // Branches are needed to replay mid-flow audience assignment so a recompute
  // (fired after every editor save) doesn't clobber a branch-assigned audience
  // back to the score-range result.
  const { data: branchesData } = questionIds.length > 0
    ? await admin.from('question_branches').select('*').in('question_id', questionIds)
    : { data: [] as QuestionBranch[] };
  const branches = (branchesData ?? []) as QuestionBranch[];

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

  const responseIds = responses.map((r) => r.id);
  const { data: answerRows } = await admin
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
    const nextTotalScore = calculateTotalScore(questions, scoringRules, answers);
    const redFlagCount = countRedFlags(questions, answers);
    const branchAudienceId = resolveBranchAudience(questions, branches, answers);
    const nextAudienceId = assignAudience({
      totalScore: nextTotalScore,
      redFlagCount,
      redFlagThreshold: questionnaire.red_flag_threshold ?? null,
      redFlagAudienceId: questionnaire.red_flag_audience_id ?? null,
      audiences,
      branchAudienceId,
    });

    const scoreChanged = nextTotalScore !== r.total_score;
    const audienceChanged = nextAudienceId !== r.audience_id;
    if (!scoreChanged && !audienceChanged) continue;

    const patch: Record<string, unknown> = {};
    if (scoreChanged) patch.total_score = nextTotalScore;
    if (audienceChanged) patch.audience_id = nextAudienceId;

    const { error } = await admin.from('responses').update(patch).eq('id', r.id);
    if (!error) updated += 1;
  }

  return NextResponse.json({ ok: true, updated });
}
