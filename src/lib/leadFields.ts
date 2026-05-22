import type { LeadField } from '@/lib/types';

/**
 * Merge template fields with per-questionnaire fields into one effective list.
 *
 * Dedup rules:
 *  - URL fields are deduplicated by `urlParam` (case-insensitive). A
 *    questionnaire-level URL field with the same param as a template field
 *    overrides the template's entry (lets a questionnaire refine the label).
 *  - Custom fields are deduplicated by `id` — same template/per-q rules.
 *  - Question fields only exist at the questionnaire level. They're appended
 *    in declaration order.
 *  - Anything without a kind is treated as `url` for backward compatibility.
 *
 * Ordering: URL → custom → question. Stable within each group.
 */
export function resolveLeadFields(
  templateFields: LeadField[] | null | undefined,
  questionnaireFields: LeadField[] | null | undefined,
): LeadField[] {
  const urlByParam = new Map<string, LeadField>();
  const customById = new Map<string, LeadField>();
  const questionFields: LeadField[] = [];

  const addUrl = (f: LeadField) => {
    if (!f.urlParam) return;
    urlByParam.set(f.urlParam.toLowerCase(), f);
  };

  for (const f of templateFields ?? []) {
    const kind = f.kind ?? 'url';
    if (kind === 'url') addUrl(f);
    else if (kind === 'custom') customById.set(f.id, f);
    // question-kind fields on a template are nonsensical — skip silently.
  }
  for (const f of questionnaireFields ?? []) {
    const kind = f.kind ?? 'url';
    if (kind === 'url') addUrl(f);
    else if (kind === 'custom') customById.set(f.id, f);
    else if (kind === 'question') {
      if (f.questionId) questionFields.push(f);
    }
  }

  return [...urlByParam.values(), ...customById.values(), ...questionFields];
}

export const isUrlField = (f: LeadField): boolean => (f.kind ?? 'url') === 'url';
export const isCustomField = (f: LeadField): boolean => f.kind === 'custom';
export const isQuestionField = (f: LeadField): boolean =>
  f.kind === 'question' && !!f.questionId;
