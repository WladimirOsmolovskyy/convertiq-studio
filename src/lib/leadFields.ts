import type { LeadField } from '@/lib/types';

/**
 * Merge project-level and questionnaire-level lead fields into one effective
 * list. Deduplicated by urlParam (case-insensitive). Questionnaire-level
 * entries override project-level entries with the same urlParam — that way a
 * questionnaire can refine the label for a globally-defined param.
 */
export function resolveLeadFields(
  projectFields: LeadField[] | null | undefined,
  questionnaireFields: LeadField[] | null | undefined,
): LeadField[] {
  const byParam = new Map<string, LeadField>();
  for (const f of projectFields ?? []) {
    if (!f.urlParam) continue;
    byParam.set(f.urlParam.toLowerCase(), f);
  }
  for (const f of questionnaireFields ?? []) {
    if (!f.urlParam) continue;
    byParam.set(f.urlParam.toLowerCase(), f);
  }
  return Array.from(byParam.values());
}
