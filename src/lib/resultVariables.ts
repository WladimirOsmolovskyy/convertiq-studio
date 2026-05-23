/**
 * Variable resolution for result-page TextSpan trees.
 *
 * A TextSpan tree can mix literal text with `{type:'var', key}` spans.
 * Keys follow a small, stable grammar:
 *   - 'score'                 → numeric total score
 *   - 'page.name'             → matched ResultPage.name
 *   - 'page.range'            → "min–max" for the matched page
 *   - 'answer.<questionId>'   → human-readable answer text for that question
 *   - 'lead.<leadFieldId>'    → captured lead-field value
 *
 * Unknown keys resolve to '' so authors never see literal "{{undefined}}"
 * leaking into the rendered page.
 *
 * The companion {@link listAvailableVariables} powers the chip picker in
 * the editor (wave 2).
 */

import type {
  AnswersMap,
  LeadField,
  Question,
  ResultPage,
  TextSpan,
} from './types';

export interface ResultRenderContext {
  score: number;
  /** The page whose score range matched, or null if none did. */
  page: ResultPage | null;
  /** Per-question answer text, already projected to a human-readable
   *  string (option labels joined, free text passed through). */
  answers: Record<string, string>;
  /** Captured lead-field values keyed by lead field id. */
  leadFields: Record<string, string>;
}

/** Project a raw AnswersMap into per-question readable strings.
 *  - radio/checkbox/dropdown → joined option labels for selected options
 *  - everything else → raw `value`
 *  - missing answer → '' */
export function projectAnswers(
  questions: Question[],
  raw: AnswersMap,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of questions) {
    const ans = raw[q.id];
    if (!ans) {
      out[q.id] = '';
      continue;
    }
    if (ans.selected_options && ans.selected_options.length > 0) {
      const labels = ans.selected_options
        .map((optId) => q.options.find((o) => o.id === optId)?.label ?? '')
        .filter(Boolean);
      out[q.id] = labels.join(', ');
    } else {
      out[q.id] = ans.value ?? '';
    }
  }
  return out;
}

/** Resolve a single variable key against the context. */
function resolveVar(key: string, ctx: ResultRenderContext): string {
  if (key === 'score') return String(ctx.score);
  if (key === 'page.name') return ctx.page?.name ?? '';
  if (key === 'page.range') return ctx.page ? `${ctx.page.min_score}–${ctx.page.max_score}` : '';
  if (key.startsWith('answer.')) return ctx.answers[key.slice('answer.'.length)] ?? '';
  if (key.startsWith('lead.')) return ctx.leadFields[key.slice('lead.'.length)] ?? '';
  return '';
}

/** Resolve a span array down to a flat string. */
export function resolveSpans(spans: TextSpan[], ctx: ResultRenderContext): string {
  return spans
    .map((s) => (s.type === 'text' ? s.value : resolveVar(s.key, ctx)))
    .join('');
}

/* ─── Variable enumeration (for the chip picker) ───────────────── */

export type VariableGroup = 'score' | 'page' | 'answer' | 'lead';

export interface AvailableVariable {
  key: string;
  /** Human-readable label shown in the picker. */
  label: string;
  group: VariableGroup;
}

/** Enumerate every variable a result-page author can insert. Order matters:
 *  picker groups appear in this order. */
export function listAvailableVariables(
  questions: Question[],
  leadFields: LeadField[],
): AvailableVariable[] {
  const out: AvailableVariable[] = [
    { key: 'score', label: 'Score', group: 'score' },
    { key: 'page.name', label: 'Page name', group: 'page' },
    { key: 'page.range', label: 'Page score range', group: 'page' },
  ];
  for (const q of questions) {
    out.push({
      key: `answer.${q.id}`,
      label: q.title || 'Untitled question',
      group: 'answer',
    });
  }
  for (const f of leadFields) {
    out.push({
      key: `lead.${f.id}`,
      label: f.label || 'Unnamed field',
      group: 'lead',
    });
  }
  return out;
}
