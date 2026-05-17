/* ─── Core Types ────────────────────────────────────────────────── */

export type QuestionType =
  | 'radio'
  | 'checkbox'
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'rating'
  | 'dropdown';

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
}

export interface Question {
  id: string;
  questionnaire_id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  sort_order: number;
  options: QuestionOption[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    maxLength?: number;
  };
}

/* ─── Branching Logic ───────────────────────────────────────────── */

export type BranchOperator = 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';

export interface BranchCondition {
  field: string; // option_id or 'value'
  operator: BranchOperator;
  value: string;
}

export interface QuestionBranch {
  id: string;
  question_id: string;
  condition: BranchCondition;
  target_question_id: string | null;
  is_end: boolean;
}

/* ─── Scoring ───────────────────────────────────────────────────── */

export type ScoringType = 'fixed' | 'ai';

export interface ScoringRule {
  id: string;
  question_id: string;
  type: ScoringType;
  option_scores: Record<string, number>; // option_id -> score
  ai_score_min: number;
  ai_score_max: number;
  ai_prompt: string;
}

export interface ScoreResult {
  id: string;
  questionnaire_id: string;
  min_score: number;
  max_score: number;
  title: string;
  description: string;
  sort_order: number;
}

/* ─── Design Config ─────────────────────────────────────────────── */

export interface DesignConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
    error: string;
    success: string;
  };
  typography: {
    fontFamily: string;
    headingFont: string;
    baseFontSize: number; // px
    lineHeight: number;
    headingWeight: number;
  };
  layout: {
    maxWidth: number; // px
    padding: number; // rem
    spacing: number; // rem
    borderRadius: number; // px
    questionSpacing: number; // rem
  };
  components: {
    question: {
      background: string;
      border: string;
      shadow: string;
      padding: string;
    };
    option: {
      background: string;
      hoverBackground: string;
      selectedBackground: string;
      border: string;
      selectedBorder: string;
    };
    button: {
      background: string;
      color: string;
      borderRadius: number;
      padding: string;
      fontSize: number;
    };
    progress: {
      background: string;
      fillColor: string;
      height: number;
    };
    input: {
      background: string;
      border: string;
      focusBorder: string;
      borderRadius: number;
    };
  };
  background: {
    type: 'solid' | 'gradient' | 'image';
    value: string; // color, gradient CSS, or image URL
  };
}

export const defaultDesign: DesignConfig = {
  colors: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    background: '#0a0a0f',
    surface: 'rgba(22, 22, 35, 0.9)',
    text: '#f0f0f5',
    textMuted: '#8888a0',
    accent: '#6366f1',
    error: '#ef4444',
    success: '#22c55e',
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    headingFont: "'Inter', sans-serif",
    baseFontSize: 16,
    lineHeight: 1.6,
    headingWeight: 700,
  },
  layout: {
    maxWidth: 680,
    padding: 2,
    spacing: 2,
    borderRadius: 12,
    questionSpacing: 1.5,
  },
  components: {
    question: {
      background: 'rgba(22, 22, 35, 0.8)',
      border: '1px solid rgba(255,255,255,0.06)',
      shadow: '0 4px 24px rgba(0,0,0,0.2)',
      padding: '2rem',
    },
    option: {
      background: 'rgba(255,255,255,0.04)',
      hoverBackground: 'rgba(255,255,255,0.08)',
      selectedBackground: 'rgba(99,102,241,0.15)',
      border: '1px solid rgba(255,255,255,0.08)',
      selectedBorder: '1px solid rgba(99,102,241,0.5)',
    },
    button: {
      background: '#6366f1',
      color: '#ffffff',
      borderRadius: 10,
      padding: '0.875rem 2rem',
      fontSize: 16,
    },
    progress: {
      background: 'rgba(255,255,255,0.06)',
      fillColor: '#6366f1',
      height: 4,
    },
    input: {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      focusBorder: '1px solid #6366f1',
      borderRadius: 8,
    },
  },
  background: {
    type: 'solid',
    value: '#0a0a0f',
  },
};

/* ─── Questionnaire ─────────────────────────────────────────────── */

export interface Questionnaire {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  custom_domain?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

/* ─── Responses ─────────────────────────────────────────────────── */

export interface Response {
  id: string;
  questionnaire_id: string;
  session_id: string;
  total_score: number | null;
  result_id: string | null;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface ResponseAnswer {
  id: string;
  response_id: string;
  question_id: string;
  answer: {
    value?: string;
    selected_options?: string[];
  };
  score: number | null;
  ai_reasoning: string | null;
  answered_at: string;
}
