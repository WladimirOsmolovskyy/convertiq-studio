import type { AnswersMap, Question, ScoringRule } from '@/lib/types';

const hasOptions = (type: string) => ['radio', 'checkbox', 'dropdown'].includes(type);

/**
 * Sum the fixed-type scoring rules across all answered questions.
 *
 * Pure: same inputs always yield the same total. AI-type rules are
 * scored elsewhere (per-answer, post-hoc) and are not included here.
 *
 * Used by the renderer at submit and by the recompute API to refresh
 * historical responses after the user edits per-option scores.
 */
export function calculateTotalScore(
  questions: Question[],
  scoringRules: ScoringRule[],
  answers: AnswersMap,
): number {
  let score = 0;
  for (const q of questions) {
    const rule = scoringRules.find((r) => r.question_id === q.id);
    if (!rule || rule.type !== 'fixed') continue;
    const ans = answers[q.id];
    if (!ans) continue;
    if (hasOptions(q.type)) {
      for (const optId of ans.selected_options ?? []) {
        score += rule.option_scores?.[optId] ?? 0;
      }
    } else if (ans.value !== undefined) {
      score += rule.option_scores?.['_any'] ?? 0;
    }
  }
  return score;
}
