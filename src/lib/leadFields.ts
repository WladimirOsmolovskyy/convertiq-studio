import type { LeadField } from '@/lib/types';

/**
 * Merge template fields with per-questionnaire fields into one effective list.
 *
 * Dedup rules:
 *  - URL fields are deduplicated by `urlParam` (case-insensitive). A
 *    questionnaire-level URL field with the same param as a template field
 *    overrides the template's entry (lets a questionnaire refine the label).
 *  - Question fields only exist at the questionnaire level. They're added
 *    after URL fields, in declaration order.
 *  - Anything without a kind is treated as `url` for backward compatibility.
 */
export function resolveLeadFields(
  templateFields: LeadField[] | null | undefined,
  questionnaireFields: LeadField[] | null | undefined,
): LeadField[] {
  const urlByParam = new Map<string, LeadField>();
  const questionFields: LeadField[] = [];

  const addUrl = (f: LeadField) => {
    if (!f.urlParam) return;
    urlByParam.set(f.urlParam.toLowerCase(), f);
  };

  for (const f of templateFields ?? []) {
    // Templates only carry URL-kind fields by design.
    if ((f.kind ?? 'url') === 'url') addUrl(f);
  }
  for (const f of questionnaireFields ?? []) {
    const kind = f.kind ?? 'url';
    if (kind === 'url') {
      addUrl(f);
    } else if (kind === 'question') {
      if (f.questionId) questionFields.push(f);
    }
  }

  return [...urlByParam.values(), ...questionFields];
}

/** True for fields that get their value from the URL on page load. */
export function isUrlField(f: LeadField): boolean {
  return (f.kind ?? 'url') === 'url';
}

/** True for fields bound to a questionnaire question's answer. */
export function isQuestionField(f: LeadField): boolean {
  return f.kind === 'question' && !!f.questionId;
}
