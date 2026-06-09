import type { AnswersMap, BranchCondition, Question, QuestionBranch } from '@/lib/types';

/**
 * Branch-flow evaluation — the single source of truth for how branch
 * conditions are interpreted and how the questionnaire advances.
 *
 * Shared by:
 *   - QuestionnaireRenderer (live public flow + editor preview), and
 *   - the /api/audiences/recompute route (offline replay of stored answers).
 *
 * Keeping one implementation is what stops the recompute route from silently
 * clobbering a branch-assigned audience back to the score-range result on the
 * next editor save.
 */

/**
 * Evaluate a single branch condition against a visitor's answer.
 *
 * `condition.field` discriminates how `condition.value` is matched:
 *   - 'option' → value is an option id, tested against `ans.selected_options`
 *   - 'value'  → value is a literal, tested against the free-text `ans.value`
 *
 * An empty `condition.value` never matches, so an incompletely-authored branch
 * is inert rather than silently routing. `greater_than`/`less_than` are numeric
 * (NaN operands never match) and are meaningless for option ids (false there).
 */
export function branchMatches(
  condition: BranchCondition,
  ans: { value?: string; selected_options?: string[] } | undefined,
): boolean {
  const { field, operator, value } = condition;
  if (value === '') return false;

  if (field === 'option') {
    const selected = ans?.selected_options ?? [];
    switch (operator) {
      case 'equals':
      case 'contains':
        return selected.includes(value);
      case 'not_equals':
        return !selected.includes(value);
      default:
        return false;
    }
  }

  const raw = ans?.value ?? '';
  switch (operator) {
    case 'equals':
      return raw === value;
    case 'not_equals':
      return raw !== value;
    case 'contains':
      return raw.includes(value);
    case 'greater_than': {
      const a = Number(raw);
      const b = Number(value);
      return Number.isFinite(a) && Number.isFinite(b) && a > b;
    }
    case 'less_than': {
      const a = Number(raw);
      const b = Number(value);
      return Number.isFinite(a) && Number.isFinite(b) && a < b;
    }
    default:
      return false;
  }
}

export interface BranchStep {
  /** Next question index, or -1 to finish. */
  nextIdx: number;
  /** Audience tagged by a matching branch on this question (null if none). */
  assignedAudienceId: string | null;
}

/**
 * Compute the single navigation step out of `qIndex` for the given answers.
 * Branches are evaluated in `sort_order` (first match wins for navigation).
 * Every matching branch's `assign_audience_id` is collected (last one along
 * this question wins), so a branch can assign without also jumping/ending.
 */
export function nextStep(
  questions: Question[],
  branches: QuestionBranch[],
  qIndex: number,
  answers: AnswersMap,
): BranchStep {
  const q = questions[qIndex];
  const ans = answers[q.id];
  const qBranches = branches
    .filter((b) => b.question_id === q.id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  let assignedAudienceId: string | null = null;
  for (const branch of qBranches) {
    if (!branchMatches(branch.condition, ans)) continue;
    if (branch.assign_audience_id) assignedAudienceId = branch.assign_audience_id;
    if (branch.is_end) return { nextIdx: -1, assignedAudienceId };
    if (branch.target_question_id) {
      const targetIdx = questions.findIndex((tq) => tq.id === branch.target_question_id);
      if (targetIdx >= 0) return { nextIdx: targetIdx, assignedAudienceId };
    }
  }
  return { nextIdx: qIndex + 1 < questions.length ? qIndex + 1 : -1, assignedAudienceId };
}

/**
 * Replay an answer set through the flow and return the audience tagged by
 * branches (sticky, last-write-wins), or null if no branch assigned one.
 *
 * Deterministic given fixed answers. A `visited` guard bounds the walk — with
 * a fixed answer set, revisiting an index would otherwise loop forever on a
 * backward jump (the live renderer can't loop because it advances one
 * user-action at a time).
 */
export function resolveBranchAudience(
  questions: Question[],
  branches: QuestionBranch[],
  answers: AnswersMap,
): string | null {
  if (questions.length === 0) return null;
  let idx = 0;
  let audienceId: string | null = null;
  const visited = new Set<number>();
  while (idx >= 0 && idx < questions.length && !visited.has(idx)) {
    visited.add(idx);
    const step = nextStep(questions, branches, idx, answers);
    if (step.assignedAudienceId) audienceId = step.assignedAudienceId;
    idx = step.nextIdx;
  }
  return audienceId;
}
