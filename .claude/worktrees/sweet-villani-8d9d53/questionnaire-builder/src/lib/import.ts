
import type { Question, QuestionBranch, ScoringRule, ScoreResult, QuestionType, BranchOperator } from './types';

/* ─── Import JSON Schema ───────────────────────────────────────── */

/** The user-facing JSON import format (simplified, no internal IDs needed) */
export interface QuestionnaireImport {
  title?: string;
  questions: ImportQuestion[];
  score_results?: ImportScoreResult[];
}

export interface ImportQuestion {
  /** A short reference key used to link branches and scoring. Must be unique within the file. */
  key: string;
  type: QuestionType;
  title: string;
  description?: string;
  required?: boolean;
  options?: ImportOption[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    maxLength?: number;
  };
  /** Branching rules evaluated after this question is answered */
  branches?: ImportBranch[];
  /** Scoring configuration for this question */
  scoring?: ImportScoring;
}

export interface ImportOption {
  /** A short reference key used in branches and scoring */
  key: string;
  label: string;
}

export interface ImportBranch {
  /** For choice questions: the option key that triggers this branch */
  if_option?: string;
  /** For open questions: the operator to use */
  operator?: BranchOperator;
  /** For open questions: the value to compare against */
  value?: string;
  /** The question key to jump to (mutually exclusive with `end`) */
  goto?: string;
  /** If true, ends the questionnaire when this branch matches */
  end?: boolean;
}

export interface ImportScoring {
  type: 'fixed' | 'ai';
  /** For fixed scoring on choice questions: map of option key → points */
  option_scores?: Record<string, number>;
  /** For fixed scoring on open questions: flat points for any answer */
  any_answer_score?: number;
  /** For AI scoring: minimum score */
  ai_min?: number;
  /** For AI scoring: maximum score */
  ai_max?: number;
  /** For AI scoring: the evaluation criteria prompt */
  ai_prompt?: string;
}

export interface ImportScoreResult {
  min_score: number;
  max_score: number;
  title: string;
  description?: string;
}

/* ─── Validation ────────────────────────────────────────────────── */

export interface ImportError {
  path: string;
  message: string;
}

const VALID_TYPES: QuestionType[] = ['radio', 'checkbox', 'text', 'textarea', 'number', 'email', 'rating', 'dropdown'];
const VALID_OPERATORS: BranchOperator[] = ['equals', 'not_equals', 'contains', 'greater_than', 'less_than'];

export function validateImport(data: unknown): ImportError[] {
  const errors: ImportError[] = [];

  if (!data || typeof data !== 'object') {
    errors.push({ path: '', message: 'Root must be a JSON object' });
    return errors;
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.questions)) {
    errors.push({ path: 'questions', message: '"questions" must be an array' });
    return errors;
  }

  if (obj.questions.length === 0) {
    errors.push({ path: 'questions', message: '"questions" array must not be empty' });
    return errors;
  }

  const questionKeys = new Set<string>();

  for (let i = 0; i < obj.questions.length; i++) {
    const q = obj.questions[i] as Record<string, unknown>;
    const p = `questions[${i}]`;

    if (!q || typeof q !== 'object') {
      errors.push({ path: p, message: 'Each question must be an object' });
      continue;
    }

    // key
    if (typeof q.key !== 'string' || q.key.trim() === '') {
      errors.push({ path: `${p}.key`, message: '"key" is required and must be a non-empty string' });
    } else if (questionKeys.has(q.key)) {
      errors.push({ path: `${p}.key`, message: `Duplicate question key "${q.key}"` });
    } else {
      questionKeys.add(q.key);
    }

    // type
    if (!VALID_TYPES.includes(q.type as QuestionType)) {
      errors.push({ path: `${p}.type`, message: `"type" must be one of: ${VALID_TYPES.join(', ')}` });
    }

    // title
    if (typeof q.title !== 'string' || q.title.trim() === '') {
      errors.push({ path: `${p}.title`, message: '"title" is required and must be a non-empty string' });
    }

    // options
    const needsOptions = ['radio', 'checkbox', 'dropdown'].includes(q.type as string);
    if (needsOptions) {
      if (!Array.isArray(q.options) || q.options.length === 0) {
        errors.push({ path: `${p}.options`, message: `"options" are required for type "${q.type}"` });
      } else {
        const optKeys = new Set<string>();
        for (let j = 0; j < q.options.length; j++) {
          const opt = q.options[j] as Record<string, unknown>;
          if (typeof opt?.key !== 'string' || opt.key.trim() === '') {
            errors.push({ path: `${p}.options[${j}].key`, message: '"key" is required for each option' });
          } else if (optKeys.has(opt.key)) {
            errors.push({ path: `${p}.options[${j}].key`, message: `Duplicate option key "${opt.key}"` });
          } else {
            optKeys.add(opt.key);
          }
          if (typeof opt?.label !== 'string' || (opt.label as string).trim() === '') {
            errors.push({ path: `${p}.options[${j}].label`, message: '"label" is required for each option' });
          }
        }
      }
    }

    // branches
    if (q.branches && Array.isArray(q.branches)) {
      for (let j = 0; j < q.branches.length; j++) {
        const b = q.branches[j] as Record<string, unknown>;
        const bp = `${p}.branches[${j}]`;

        if (!b.goto && !b.end) {
          errors.push({ path: bp, message: 'Each branch must have either "goto" or "end: true"' });
        }
        if (b.goto && typeof b.goto !== 'string') {
          errors.push({ path: `${bp}.goto`, message: '"goto" must be a question key string' });
        }
        if (needsOptions && !b.if_option) {
          if (!b.operator) {
            errors.push({ path: bp, message: 'Choice questions need "if_option"; open questions need "operator" + "value"' });
          }
        }
        if (b.operator && !VALID_OPERATORS.includes(b.operator as BranchOperator)) {
          errors.push({ path: `${bp}.operator`, message: `"operator" must be one of: ${VALID_OPERATORS.join(', ')}` });
        }
      }
    }

    // scoring
    if (q.scoring && typeof q.scoring === 'object') {
      const s = q.scoring as Record<string, unknown>;
      if (s.type !== 'fixed' && s.type !== 'ai') {
        errors.push({ path: `${p}.scoring.type`, message: '"type" must be "fixed" or "ai"' });
      }
    }
  }

  // Validate branch goto references (second pass)
  if (errors.length === 0) {
    for (let i = 0; i < obj.questions.length; i++) {
      const q = obj.questions[i] as Record<string, unknown>;
      if (q.branches && Array.isArray(q.branches)) {
        for (let j = 0; j < q.branches.length; j++) {
          const b = q.branches[j] as Record<string, unknown>;
          if (b.goto && !questionKeys.has(b.goto as string)) {
            errors.push({
              path: `questions[${i}].branches[${j}].goto`,
              message: `Referenced question key "${b.goto}" does not exist`,
            });
          }
        }
      }
    }
  }

  // score_results
  if (obj.score_results) {
    if (!Array.isArray(obj.score_results)) {
      errors.push({ path: 'score_results', message: '"score_results" must be an array' });
    } else {
      for (let i = 0; i < obj.score_results.length; i++) {
        const r = obj.score_results[i] as Record<string, unknown>;
        const rp = `score_results[${i}]`;
        if (typeof r?.min_score !== 'number') errors.push({ path: `${rp}.min_score`, message: '"min_score" must be a number' });
        if (typeof r?.max_score !== 'number') errors.push({ path: `${rp}.max_score`, message: '"max_score" must be a number' });
        if (typeof r?.title !== 'string') errors.push({ path: `${rp}.title`, message: '"title" is required' });
      }
    }
  }

  return errors;
}

/* ─── Transform to Internal Format ──────────────────────────────── */

export function transformImport(
  data: QuestionnaireImport,
  questionnaireId: string
): {
  questions: Question[];
  branches: QuestionBranch[];
  scoringRules: ScoringRule[];
  scoreResults: ScoreResult[];
} {
  // Build key → generated UUID map
  const keyToId: Record<string, string> = {};
  const optKeyToId: Record<string, Record<string, string>> = {}; // questionKey → { optionKey → id }

  for (const q of data.questions) {
    keyToId[q.key] = crypto.randomUUID();
    if (q.options) {
      optKeyToId[q.key] = {};
      for (const opt of q.options) {
        optKeyToId[q.key][opt.key] = crypto.randomUUID();
      }
    }
  }

  // Transform questions
  const questions: Question[] = data.questions.map((q, idx) => ({
    id: keyToId[q.key],
    questionnaire_id: questionnaireId,
    type: q.type,
    title: q.title,
    description: q.description || '',
    required: q.required ?? true,
    sort_order: idx,
    options: (q.options || []).map((opt) => ({
      id: optKeyToId[q.key][opt.key],
      label: opt.label,
      value: opt.key,
    })),
    validation: q.validation,
  }));

  // Transform branches
  const branches: QuestionBranch[] = [];
  for (const q of data.questions) {
    if (!q.branches) continue;
    for (const b of q.branches) {
      const branch: QuestionBranch = {
        id: crypto.randomUUID(),
        question_id: keyToId[q.key],
        condition: {
          field: b.if_option ? 'option' : 'value',
          operator: b.operator || 'equals',
          value: b.if_option
            ? optKeyToId[q.key]?.[b.if_option] || b.if_option
            : b.value || '',
        },
        target_question_id: b.goto ? keyToId[b.goto] || null : null,
        is_end: b.end || false,
      };
      branches.push(branch);
    }
  }

  // Transform scoring rules
  const scoringRules: ScoringRule[] = data.questions.map((q) => {
    const s = q.scoring;
    const optScores: Record<string, number> = {};

    if (s?.type === 'fixed' && s.option_scores) {
      for (const [optKey, score] of Object.entries(s.option_scores)) {
        const optId = optKeyToId[q.key]?.[optKey];
        if (optId) optScores[optId] = score;
      }
    }
    if (s?.type === 'fixed' && s.any_answer_score !== undefined) {
      optScores['_any'] = s.any_answer_score;
    }

    return {
      id: crypto.randomUUID(),
      question_id: keyToId[q.key],
      type: s?.type || (['text', 'textarea'].includes(q.type) ? 'ai' : 'fixed'),
      option_scores: optScores,
      ai_score_min: s?.ai_min ?? 0,
      ai_score_max: s?.ai_max ?? 10,
      ai_prompt: s?.ai_prompt || '',
    };
  });

  // Transform score results
  const scoreResults: ScoreResult[] = (data.score_results || []).map((r, idx) => ({
    id: crypto.randomUUID(),
    questionnaire_id: questionnaireId,
    min_score: r.min_score,
    max_score: r.max_score,
    title: r.title,
    description: r.description || '',
    sort_order: idx,
  }));

  return { questions, branches, scoringRules, scoreResults };
}
