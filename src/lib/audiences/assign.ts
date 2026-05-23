import type { Audience, AnswersMap, Question } from '@/lib/types';

export interface AssignAudienceArgs {
  totalScore: number;
  redFlagCount: number;
  redFlagThreshold: number | null;
  redFlagAudienceId: string | null;
  audiences: Audience[];
}

/**
 * Decide which audience a completed response belongs to. Pure: same inputs
 * always yield the same id. Returns null when no rule matches.
 *
 * Precedence:
 *   1. Red-flag rule wins. If `redFlagThreshold` is set and
 *      `redFlagCount >= threshold` and `redFlagAudienceId` resolves to an
 *      existing audience, return that.
 *   2. Otherwise, walk audiences in `sort_order`, then each audience's
 *      ranges in `sort_order`. The first range whose inclusive
 *      [min_score, max_score] contains `totalScore` wins. Null bounds are
 *      treated as unbounded on that side.
 */
export function assignAudience({
  totalScore,
  redFlagCount,
  redFlagThreshold,
  redFlagAudienceId,
  audiences,
}: AssignAudienceArgs): string | null {
  if (
    redFlagThreshold != null &&
    redFlagThreshold > 0 &&
    redFlagCount >= redFlagThreshold &&
    redFlagAudienceId
  ) {
    if (audiences.some((a) => a.id === redFlagAudienceId)) {
      return redFlagAudienceId;
    }
  }

  const ordered = [...audiences].sort((a, b) => a.sort_order - b.sort_order);
  for (const audience of ordered) {
    const ranges = [...(audience.score_ranges ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    for (const r of ranges) {
      const minOk = r.min_score == null || totalScore >= r.min_score;
      const maxOk = r.max_score == null || totalScore <= r.max_score;
      if (minOk && maxOk) return audience.id;
    }
  }

  return null;
}

/**
 * Count how many red-flag options were selected across all answered
 * questions. Only `radio`, `checkbox`, and `dropdown` questions have
 * options that can be flagged; other types are skipped.
 */
export function countRedFlags(questions: Question[], answers: AnswersMap): number {
  let count = 0;
  for (const q of questions) {
    const ans = answers[q.id];
    const selected = ans?.selected_options;
    if (!selected || selected.length === 0) continue;
    for (const optId of selected) {
      const opt = q.options.find((o) => o.id === optId);
      if (opt?.is_red_flag) count += 1;
    }
  }
  return count;
}
