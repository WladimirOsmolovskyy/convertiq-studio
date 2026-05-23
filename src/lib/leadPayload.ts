import type {
  LeadField,
  Question,
  QuestionOption,
  ScoringRule,
  ResultPage,
  Questionnaire,
} from '@/lib/types';
import { resolveLeadFields } from '@/lib/leadFields';
import { deriveTitleDescription } from '@/lib/resultPage';

/* ─── Public payload shape ────────────────────────────────────── */
/*
 * This is the shape we'll POST to user-configured webhooks. Keep it stable —
 * external consumers (Zapier, Make, custom endpoints) parse it. Add new fields
 * by appending; rename/remove with a versioned envelope.
 */

export interface LeadPayloadField {
  id: string;
  label: string;
  /** 'url' | 'question' | 'custom'. Tells the consumer how this value was sourced. */
  kind: 'url' | 'question' | 'custom';
  /** Only set when kind='url' or the field has a URL param hint. */
  url_param?: string;
  /** Only set when kind='question'. */
  question_id?: string;
  /** Only set when kind='custom'. */
  input_type?: 'text' | 'email' | 'tel' | 'number';
  value: string | null;
}

export interface LeadPayloadAnswer {
  question_id: string;
  type: Question['type'];
  title: string;
  /** Raw text answer for free-form / numeric / email questions. */
  value: string | null;
  /** Selected option objects for radio / checkbox / dropdown. */
  selected_options: Array<{ id: string; label: string; value: string }>;
  score: number | null;
  ai_reasoning: string | null;
  answered_at?: string;
}

export interface LeadPayload {
  /** Bump when the wire format changes. */
  schema_version: 1;
  event: 'lead.completed';
  occurred_at: string;
  lead: {
    id: string;
    session_id: string;
    started_at: string | null;
    completed_at: string | null;
    duration_ms: number | null;
    total_score: number | null;
    result: { id: string; title: string; description: string | null } | null;
    source: {
      host: string | null;
      user_agent: string | null;
    };
  };
  questionnaire: {
    id: string;
    title: string;
    slug: string;
    project_id: string;
  };
  /** Effective lead fields (template + per-questionnaire) with their captured values. */
  fields: LeadPayloadField[];
  /** Every question asked, in sort order, paired with the visitor's answer. */
  questions: LeadPayloadAnswer[];
}

/* ─── Builder ─────────────────────────────────────────────────── */

interface BuildArgs {
  responseId: string;
  sessionId: string;
  startedAt: string | null;
  completedAt: string | null;
  totalScore: number | null;
  matchedResult: ResultPage | null;
  host: string | null;
  userAgent: string | null;
  questionnaire: Pick<Questionnaire, 'id' | 'title' | 'slug' | 'project_id' | 'lead_fields'>;
  templateLeadFields?: LeadField[];
  questions: Question[];
  /** Visitor's typed answers, keyed by question id. */
  answers: Record<string, { value?: string; selected_options?: string[] }>;
  /** Captured lead field values keyed by field id. */
  leadFieldValues: Record<string, string>;
  scoringRules?: ScoringRule[];
}

/**
 * Build the webhook-ready payload for a completed lead.
 * Pure: no I/O — pass in everything it needs. Use the same builder from the
 * renderer (to POST live) or the Lead detail page (to preview / re-send).
 */
export function buildLeadPayload(args: BuildArgs): LeadPayload {
  const {
    responseId,
    sessionId,
    startedAt,
    completedAt,
    totalScore,
    matchedResult,
    host,
    userAgent,
    questionnaire,
    templateLeadFields,
    questions,
    answers,
    leadFieldValues,
    scoringRules,
  } = args;

  const durationMs =
    completedAt && startedAt
      ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
      : null;

  const effectiveFields = resolveLeadFields(
    templateLeadFields,
    questionnaire.lead_fields ?? [],
  );

  const fields: LeadPayloadField[] = effectiveFields.map((f) => {
    const kind = (f.kind ?? 'url') as 'url' | 'question' | 'custom';
    const value = leadFieldValues[f.id] ?? null;
    const entry: LeadPayloadField = {
      id: f.id,
      label: f.label,
      kind,
      value,
    };
    if (f.urlParam) entry.url_param = f.urlParam;
    if (kind === 'question' && f.questionId) entry.question_id = f.questionId;
    if (kind === 'custom') entry.input_type = f.inputType ?? 'text';
    return entry;
  });

  const questionPayload: LeadPayloadAnswer[] = questions.map((q) => {
    const ans = answers[q.id];
    const selectedIds = ans?.selected_options ?? [];
    const selectedOptions = selectedIds
      .map((id) => q.options.find((o: QuestionOption) => o.id === id))
      .filter((o): o is QuestionOption => !!o)
      .map((o) => ({ id: o.id, label: o.label, value: o.value }));

    // Score for this question — only fixed-type rules can be computed client-side.
    let score: number | null = null;
    const rule = scoringRules?.find((r) => r.question_id === q.id);
    if (rule && rule.type === 'fixed') {
      const hasOptions = ['radio', 'checkbox', 'dropdown'].includes(q.type);
      if (hasOptions) {
        score = 0;
        for (const id of selectedIds) score += rule.option_scores?.[id] ?? 0;
      } else if (ans?.value) {
        score = rule.option_scores?.['_any'] ?? 0;
      }
    }

    return {
      question_id: q.id,
      type: q.type,
      title: q.title,
      value: ans?.value ?? null,
      selected_options: selectedOptions,
      score,
      ai_reasoning: null,
    };
  });

  return {
    schema_version: 1,
    event: 'lead.completed',
    occurred_at: new Date().toISOString(),
    lead: {
      id: responseId,
      session_id: sessionId,
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: durationMs,
      total_score: totalScore,
      result: matchedResult
        ? (() => {
            // Derive the human-readable title/description from the page's
            // content blocks for backward-compatible webhook payloads.
            const { title, description } = deriveTitleDescription(matchedResult);
            return {
              id: matchedResult.id,
              title,
              description: description || null,
            };
          })()
        : null,
      source: { host, user_agent: userAgent },
    },
    questionnaire: {
      id: questionnaire.id,
      title: questionnaire.title,
      slug: questionnaire.slug,
      project_id: questionnaire.project_id,
    },
    fields,
    questions: questionPayload,
  };
}
