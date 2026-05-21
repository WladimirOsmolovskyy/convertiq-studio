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
    baseFontSize: number; // px – kept for backward compat
    lineHeight: number; // kept for backward compat
    headingWeight: number; // kept for backward compat
    body: {
      size: number; // px
      weight: number;
      lineHeight: number;
      letterSpacing: number; // em
      color: string;
    };
    heading: {
      size: number; // px
      weight: number;
      lineHeight: number;
      letterSpacing: number; // em
      color: string;
    };
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
    primary: '#007aff',
    secondary: '#5856d6',
    background: '#ffffff',
    surface: '#ffffff',
    text: '#1d1d1f',
    textMuted: '#6e6e73',
    accent: '#007aff',
    error: '#ff3b30',
    success: '#34c759',
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    headingFont: "'Inter', sans-serif",
    baseFontSize: 16,
    lineHeight: 1.6,
    headingWeight: 700,
    body: {
      size: 16,
      weight: 400,
      lineHeight: 1.6,
      letterSpacing: 0,
      color: '#1d1d1f',
    },
    heading: {
      size: 22,
      weight: 700,
      lineHeight: 1.2,
      letterSpacing: -0.02,
      color: '#1d1d1f',
    },
  },
  layout: {
    maxWidth: 680,
    padding: 2,
    spacing: 2,
    borderRadius: 14,
    questionSpacing: 1.5,
  },
  components: {
    question: {
      background: '#ffffff',
      border: '1px solid rgba(0,0,0,0.08)',
      shadow: '0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
      padding: '2rem',
    },
    option: {
      background: '#f5f5f7',
      hoverBackground: '#ededf0',
      selectedBackground: 'rgba(0,122,255,0.08)',
      border: '1px solid rgba(0,0,0,0.06)',
      selectedBorder: '1px solid rgba(0,122,255,0.4)',
    },
    button: {
      background: '#007aff',
      color: '#ffffff',
      borderRadius: 980,
      padding: '0.875rem 2rem',
      fontSize: 16,
    },
    progress: {
      background: 'rgba(0,0,0,0.06)',
      fillColor: '#007aff',
      height: 4,
    },
    input: {
      background: '#ffffff',
      border: '1px solid rgba(0,0,0,0.1)',
      focusBorder: '1px solid #007aff',
      borderRadius: 10,
    },
  },
  background: {
    type: 'solid',
    value: '#f5f5f7',
  },
};

/* ─── Project ───────────────────────────────────────────────────── */

export interface Project {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/* ─── Project Domain ───────────────────────────────────────────── */

export type DomainVerificationStatus = 'pending' | 'verifying' | 'verified' | 'error';

/** A Vercel verification record telling the user what DNS to set. */
export interface VercelVerificationRecord {
  type: string;   // 'CNAME' | 'TXT' | ...
  domain: string; // record name
  value: string;  // record value
  reason?: string;
}

export interface ProjectDomain {
  id: string;
  project_id: string;
  domain: string;
  verification_status: DomainVerificationStatus;
  vercel_data: {
    verification?: VercelVerificationRecord[];
    misconfigured?: boolean;
    error?: { code?: string; message?: string };
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

/* ─── Questionnaire ─────────────────────────────────────────────── */

export interface LeadField {
  id: string;
  label: string;
  /** URL query parameter name to capture (e.g. "utm_campaign"). Stored on
   *  responses.metadata.lead_fields keyed by this value. */
  urlParam: string;
}

export interface Questionnaire {
  id: string;
  user_id: string;
  project_id: string;
  domain_id: string | null;
  title: string;
  slug: string;
  is_published: boolean;
  lead_fields: LeadField[];
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
