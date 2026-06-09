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
  /** When true, selecting this option counts toward the questionnaire's
   *  red-flag total. If the total reaches the questionnaire's
   *  `red_flag_threshold`, the lead is routed to
   *  `red_flag_audience_id`. */
  is_red_flag?: boolean;
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
  /** Discriminates how `value` is matched at runtime:
   *  - 'option' → `value` is an option id, tested against the answer's
   *    `selected_options` (radio/checkbox/dropdown).
   *  - 'value'  → `value` is a literal, compared against the free-text
   *    `value` of the answer (text/textarea/email/number/rating). */
  field: 'option' | 'value';
  operator: BranchOperator;
  value: string;
}

export interface QuestionBranch {
  id: string;
  question_id: string;
  condition: BranchCondition;
  target_question_id: string | null;
  is_end: boolean;
  /** Per-question evaluation order (first match wins). Branches are sorted by
   *  this before evaluation; absent → falls back to insertion order. */
  sort_order?: number;
  /** When this branch matches, tag the visitor with this audience (mid-flow).
   *  Sticky, last-write-wins across the run; overrides score-range/red-flag
   *  assignment at submit. Null → this branch assigns no audience. Orthogonal
   *  to target_question_id/is_end: a branch can assign-and-jump, assign-and-end,
   *  or assign-and-fall-through. */
  assign_audience_id?: string | null;
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

/** Runtime answer map collected from the visitor as they progress through
 *  the questionnaire. Keyed by question id. Either `value` (free text /
 *  number / rating) or `selected_options` (radio/checkbox/dropdown) is set. */
export type AnswersMap = Record<string, { value?: string; selected_options?: string[] }>;

/* ─── Result Pages ──────────────────────────────────────────────── */

/** A span inside a TextNode. Either literal text or a variable reference
 *  that's resolved at render time against the response context (score,
 *  answers, lead fields). Variable keys are stable strings:
 *    - 'score'                      → total numeric score
 *    - 'page.name' | 'page.range'   → matched ResultPage metadata
 *    - 'answer.<questionId>'        → answer value for that question
 *    - 'lead.<leadFieldId>'         → captured lead-field value
 *  Unknown keys render as empty strings. */
export type TextSpan =
  | { type: 'text'; value: string }
  | { type: 'var'; key: string };

export type ResultSizeMode = 'fixed' | 'fill' | 'fit';

export interface ResultSize {
  mode: ResultSizeMode;
  /** Used only when mode === 'fixed'. Pixels. */
  value?: number;
}

export interface ResultPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** A result-node color bound to a project Brand token. Resolved against the
 *  project palette at render time (see ResultPageRenderer). Detaching a
 *  binding replaces it with a literal CSS color string. */
export interface ColorRef {
  $var: BrandTokenId;
}

/** A result-node color: either a literal CSS color/gradient string, or a live
 *  binding to a Brand token. Templates ship bound by semantic meaning; authors
 *  can detach to a literal or re-link to another token. */
export type ResultColor = string | ColorRef;

/** Type guard: is this color value a Brand-token binding (vs. a literal)? */
export function isColorRef(v: ResultColor | undefined): v is ColorRef {
  return typeof v === 'object' && v !== null && '$var' in v;
}

interface ResultNodeBase {
  id: string;
  width?: ResultSize;
  height?: ResultSize;
}

export interface ResultFrameNode extends ResultNodeBase {
  type: 'frame';
  direction: 'row' | 'column';
  /** px gap between children */
  gap: number;
  padding: ResultPadding;
  /** Cross-axis alignment */
  align: 'start' | 'center' | 'end' | 'stretch';
  /** Main-axis alignment */
  justify: 'start' | 'center' | 'end' | 'space-between';
  /** Literal CSS color/gradient, or a live Brand-token binding. */
  background?: ResultColor;
  borderRadius?: number;
  children: ResultNode[];
}

export interface ResultTextNode extends ResultNodeBase {
  type: 'text';
  spans: TextSpan[];
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  /** em */
  letterSpacing?: number;
  /** Literal CSS color, or a live Brand-token binding. */
  color?: ResultColor;
  textAlign?: 'left' | 'center' | 'right';
  fontFamily?: string;
}

export interface ResultImageNode extends ResultNodeBase {
  type: 'image';
  src: string;
  alt?: string;
  fit?: 'cover' | 'contain';
  borderRadius?: number;
}

export type ResultNode = ResultFrameNode | ResultTextNode | ResultImageNode;

export interface ResultPage {
  id: string;
  questionnaire_id: string;
  name: string;
  min_score: number;
  max_score: number;
  sort_order: number;
  /** Single root frame containing the page layout. */
  content: ResultFrameNode;
}

/** Default empty content tree for a fresh result page. */
export function defaultResultPageContent(): ResultFrameNode {
  return {
    id: crypto.randomUUID(),
    type: 'frame',
    direction: 'column',
    gap: 16,
    padding: { top: 32, right: 24, bottom: 32, left: 24 },
    align: 'center',
    justify: 'start',
    children: [],
  };
}

/* ─── Block factories ──────────────────────────────────────────────
 * Used by the Result tab "Add block" menu. Each factory returns a
 * fresh node with a new id and sensible defaults. Visual presets
 * (title, subtitle, nav-with-logo) are typed nodes pre-styled — they
 * aren't a separate node type, just convenience wrappers. */

export function newFrameNode(overrides: Partial<ResultFrameNode> = {}): ResultFrameNode {
  return {
    id: crypto.randomUUID(),
    type: 'frame',
    direction: 'column',
    gap: 12,
    padding: { top: 16, right: 16, bottom: 16, left: 16 },
    align: 'stretch',
    justify: 'start',
    children: [],
    ...overrides,
  };
}

export function newTextNode(overrides: Partial<ResultTextNode> = {}): ResultTextNode {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    spans: [{ type: 'text', value: 'Text' }],
    fontSize: 16,
    fontWeight: 400,
    textAlign: 'left',
    ...overrides,
  };
}

export function newImageNode(overrides: Partial<ResultImageNode> = {}): ResultImageNode {
  return {
    id: crypto.randomUUID(),
    type: 'image',
    src: '',
    alt: '',
    fit: 'cover',
    width: { mode: 'fixed', value: 200 },
    height: { mode: 'fixed', value: 200 },
    ...overrides,
  };
}

/** Pre-styled large heading text. */
export function newTitleNode(): ResultTextNode {
  return newTextNode({
    spans: [{ type: 'text', value: 'Your title' }],
    fontSize: 32,
    fontWeight: 700,
    textAlign: 'center',
  });
}

/** Pre-styled subdued subheading text. */
export function newSubtitleNode(): ResultTextNode {
  return newTextNode({
    spans: [{ type: 'text', value: 'Your subtitle' }],
    fontSize: 18,
    fontWeight: 400,
    textAlign: 'center',
  });
}

/** Horizontal nav frame: logo on the left, optional title on the right. */
export function newNavWithLogoNode(): ResultFrameNode {
  return newFrameNode({
    direction: 'row',
    gap: 12,
    padding: { top: 16, right: 24, bottom: 16, left: 24 },
    align: 'center',
    justify: 'space-between',
    width: { mode: 'fill' },
    children: [
      newImageNode({
        src: '',
        alt: 'Logo',
        fit: 'contain',
        width: { mode: 'fixed', value: 120 },
        height: { mode: 'fixed', value: 32 },
      }),
    ],
  });
}

/* ─── Design Config ─────────────────────────────────────────────── */

export interface DesignConfig {
  /** Questionnaire color variables. SPARSE — an absent key inherits the
   *  mapped Brand token at render time (see `designResolve`). Existing
   *  questionnaires store full objects (= overrides); new ones start empty
   *  (= inherit brand). */
  colors: Partial<{
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
    error: string;
    success: string;
  }>;
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
    optionGap?: number; // px — gap between answer options
  };
  /** Component styling. Each sub-object is SPARSE — absent fields are
   *  derived from the resolved colors at render time. The five keys are
   *  always present (possibly empty) to keep merges simple. */
  components: {
    question: Partial<{
      background: string;
      border: string;
      shadow: string;
      padding: string;
    }>;
    option: Partial<{
      background: string;
      hoverBackground: string;
      selectedBackground: string;
      border: string;
      selectedBorder: string;
    }>;
    button: Partial<{
      background: string;
      color: string;
      borderRadius: number;
      padding: string;
      fontSize: number;
    }>;
    progress: Partial<{
      background: string;
      fillColor: string;
      height: number;
    }>;
    input: Partial<{
      background: string;
      border: string;
      focusBorder: string;
      borderRadius: number;
    }>;
  };
  background: {
    type: 'solid' | 'gradient' | 'image';
    value: string; // color, gradient CSS, or image URL
  };
  /**
   * Sparse per-element style overrides. The keys above (`colors`, `typography`,
   * `layout`, `components`, `background`) define the GLOBAL design — treated as
   * the "variables" namespace in the inspector. `elements` lets the editor
   * override specific UI elements (selected on canvas) without touching the
   * globals. Phase 1: a curated element list; only `fill`, `radius`, `padding`
   * are wired end-to-end (Commit C). Other fields exist in the type so the
   * inspector UI shell compiles; renderer applies them only when present.
   */
  elements?: Partial<Record<ElementId, ElementStyles>>;
  /** Respondent-facing interaction behavior for the published questionnaire. */
  behavior?: {
    /** Pause (ms) on a picked answer before a single-choice question
     *  auto-advances — a brief selection confirmation. */
    selectFeedbackMs?: number;
    /** 1-based question number from which the progress bar becomes visible
     *  (default 1 = always shown). */
    progressStartQuestion?: number;
    /** Whether to show the Back button (default true). */
    showBackButton?: boolean;
    /** Whether the respondent may navigate backward (default true). When
     *  false, the Back button is hidden regardless of `showBackButton`. */
    allowBack?: boolean;
  };
}

/**
 * The set of canvas-selectable element targets. We use string IDs with
 * dotted-namespace prefixes for question-type-scoped sub-elements
 * (e.g. `radio.option` overrides apply only inside radio questions).
 */
export type ElementId =
  // Page-level
  | 'page'
  | 'container'
  | 'progress'
  | 'navButtons'
  | 'button'
  // Question card (applies to all question types unless type-scoped below)
  | 'questionCard'
  | 'questionTitle'
  | 'questionDescription'
  // Type-scoped sub-elements
  | 'radio.optionsGrid'
  | 'radio.option'
  | 'checkbox.optionsList'
  | 'checkbox.option'
  | 'text.input'
  | 'textarea.input'
  | 'rating.starsContainer'
  | 'rating.star';

/**
 * A variable reference. Phase 2 will let any styled value EITHER hold a
 * literal OR reference a global (e.g. `{ $var: 'colors.primary' }`). For
 * Commit A this type just exists so handlers + components compile.
 */
export type VarRef = { $var: string };

/** Either a literal value or a variable reference. */
export type Styled<T> = T | VarRef;

/**
 * Per-element style override. All fields optional and sparse. Most are
 * shell-only in phase 1 — see `DesignConfig.elements` comment.
 */
export interface ElementStyles {
  // Styles section — `fill`, `radius`, `padding` wired in Commit C
  opacity?: Styled<number>;
  visible?: Styled<boolean>;
  fill?: Styled<string>;
  overflow?: 'visible' | 'hidden' | 'auto' | 'scroll';
  radius?: Styled<number>;
  border?: Styled<string>;
  shadows?: Styled<string>;
  // Layout section
  layoutType?: 'stack' | 'grid';
  direction?: 'horizontal' | 'vertical';
  distribute?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  align?: 'start' | 'center' | 'end';
  wrap?: boolean;
  gap?: Styled<number>;
  padding?: Styled<number>;
  // Size section
  width?: { value: number; unit: 'px' | 'rel' | 'fit' | 'auto' };
  height?: { value: number; unit: 'px' | 'rel' | 'fit' | 'auto' };
  // Position section
  positionType?: 'relative' | 'absolute' | 'fixed';
  // Link section
  linkHref?: string;
}

export const defaultDesign: DesignConfig = {
  // Empty → a new questionnaire inherits every color from the project Brand
  // palette. `defaultBrandPalette` equals the historical defaults above, so
  // an untouched new questionnaire looks exactly as it always did.
  colors: {},
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
  // Empty sub-objects → component colors derive from the resolved (brand)
  // colors at render time. The five keys stay present so design merges and
  // the editor's component sections have a stable object to spread.
  components: {
    question: {},
    option: {},
    button: {},
    progress: {},
    input: {},
  },
  background: {
    type: 'solid',
    value: '#f5f5f7',
  },
};

/** Default pause (ms) on a picked answer before a single-choice question
 *  auto-advances. Overridable per questionnaire via `design.behavior`. */
export const SELECT_FEEDBACK_MS = 220;

/* ─── Project ───────────────────────────────────────────────────── */

export interface Project {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  /** Project-level shared color palette. Sparse — missing tokens fall
   *  back to `defaultBrandPalette`. The most-global color layer:
   *  questionnaire color variables default from here. */
  brand?: BrandPalette;
}

/* ─── Brand palette (project-level design tokens) ───────────────── */

/**
 * The fixed set of brand color tokens, grouped semantically. Token ids
 * are stable strings (dotted namespace) used as keys in `BrandPalette`
 * and as the inheritance source for questionnaire color variables.
 */
export type BrandTokenId =
  // 01 Background
  | 'background.primary'
  | 'background.secondary'
  // 02 UI
  | 'surface'
  | 'surface.highlight'
  | 'surface.secondary'
  | 'line'
  | 'line.highlight'
  | 'line.secondary'
  // 03 Texts
  | 'heading'
  | 'body'
  | 'heading.secondary'
  | 'body.secondary'
  // 04 Brand
  | 'brand.core'
  | 'brand.accent'
  | 'brand.highlight';

/** token id → CSS color (hex). Stored sparse; merge over defaults to read. */
export type BrandPalette = Partial<Record<BrandTokenId, string>>;

/** UI grouping + labels for the brand editor. Order is presentation order. */
export const BRAND_GROUPS: {
  id: string;
  label: string;
  tokens: { id: BrandTokenId; label: string }[];
}[] = [
  {
    id: 'background',
    label: 'Background',
    tokens: [
      { id: 'background.primary', label: 'Background: Primary' },
      { id: 'background.secondary', label: 'Background: Secondary' },
    ],
  },
  {
    id: 'ui',
    label: 'UI',
    tokens: [
      { id: 'surface', label: 'Surface' },
      { id: 'surface.highlight', label: 'Surface: Highlight' },
      { id: 'surface.secondary', label: 'Surface: Secondary' },
      { id: 'line', label: 'Line' },
      { id: 'line.highlight', label: 'Line: Highlight' },
      { id: 'line.secondary', label: 'Line: Secondary' },
    ],
  },
  {
    id: 'texts',
    label: 'Texts',
    tokens: [
      { id: 'heading', label: 'Heading' },
      { id: 'body', label: 'Body' },
      { id: 'heading.secondary', label: 'Heading: Secondary' },
      { id: 'body.secondary', label: 'Body: Secondary' },
    ],
  },
  {
    id: 'brand',
    label: 'Brand',
    tokens: [
      { id: 'brand.core', label: 'Core' },
      { id: 'brand.accent', label: 'Accent' },
      { id: 'brand.highlight', label: 'Highlight' },
    ],
  },
];

/**
 * Default brand palette. A clean light theme aligned with the existing
 * questionnaire defaults (white surfaces, near-black text, Apple blue
 * core) so questionnaires that inherit it look right out of the box.
 * Users recolor freely in the Brand editor.
 */
export const defaultBrandPalette: Record<BrandTokenId, string> = {
  'background.primary': '#ffffff',
  'background.secondary': '#f5f5f7',
  'surface': '#ffffff',
  'surface.highlight': '#f5f5f7',
  'surface.secondary': '#fafafa',
  'line': '#e5e5e7',
  'line.highlight': '#d1d1d6',
  'line.secondary': '#f0f0f2',
  'heading': '#1d1d1f',
  'body': '#2c2c2e',
  'heading.secondary': '#6e6e73',
  'body.secondary': '#8e8e93',
  'brand.core': '#007aff',
  'brand.accent': '#5856d6',
  'brand.highlight': '#ff9500',
};

/** Read a token's effective color: stored value, else default. */
export function resolveBrandToken(palette: BrandPalette | undefined, id: BrandTokenId): string {
  return palette?.[id] ?? defaultBrandPalette[id];
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

/** Where a lead field gets its value from.
 *  - `url`: capture a URL query parameter on page load (works on templates +
 *    per-questionnaire fields).
 *  - `question`: bind to a specific question's answer; resolved at submit
 *    time. Only valid on per-questionnaire fields — templates can't reference
 *    question ids that don't exist in their context.
 *  - `custom`: a standalone input rendered as a lead-capture step before
 *    submission (email / phone / number / free text). Works on both templates
 *    and per-questionnaire fields.
 */
export type LeadFieldKind = 'url' | 'question' | 'custom';

/** Input type for kind='custom'. Maps to the rendered <input type=…>. */
export type LeadFieldInputType = 'text' | 'email' | 'tel' | 'number';

export interface LeadField {
  id: string;
  label: string;
  /** Defaults to 'url' when absent for backward compatibility with pre-kind fields. */
  kind?: LeadFieldKind;
  /** URL query parameter name to capture, e.g. "utm_campaign". Used when kind='url'. */
  urlParam?: string;
  /** Source question id. Used when kind='question'. */
  questionId?: string;
  /** Input type. Used when kind='custom'. Defaults to 'text'. */
  inputType?: LeadFieldInputType;
  /** Whether the visitor must fill this in before submitting. Custom-only. */
  required?: boolean;
}

export interface LeadFieldTemplate {
  id: string;
  user_id: string;
  name: string;
  fields: LeadField[];
  created_at: string;
  updated_at: string;
}

export interface Questionnaire {
  id: string;
  user_id: string;
  project_id: string;
  domain_id: string | null;
  title: string;
  slug: string;
  is_published: boolean;
  /** Per-questionnaire lead fields (don't affect siblings or templates). */
  lead_fields: LeadField[];
  /** Optional FK to a project-scoped LeadFieldTemplate. When set, the template's
   *  fields are merged with this questionnaire's lead_fields at runtime. */
  lead_field_template_id: string | null;
  /** When a response's red-flag option count reaches this threshold,
   *  the lead is placed in `red_flag_audience_id`. Null disables the rule. */
  red_flag_threshold: number | null;
  red_flag_audience_id: string | null;
  created_at: string;
  updated_at: string;
}

/* ─── Audiences ─────────────────────────────────────────────────── */

/** Inclusive numeric range. Null bounds mean unbounded on that side. */
export interface AudienceScoreRange {
  id: string;
  audience_id: string;
  min_score: number | null;
  max_score: number | null;
  sort_order: number;
}

export interface Audience {
  id: string;
  questionnaire_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  /** Nested score ranges. Populated when audiences are loaded with their
   *  ranges joined; empty array when there are no ranges configured. */
  score_ranges: AudienceScoreRange[];
}

/* ─── Responses ─────────────────────────────────────────────────── */

export interface Response {
  id: string;
  questionnaire_id: string;
  session_id: string;
  total_score: number | null;
  result_id: string | null;
  audience_id: string | null;
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
