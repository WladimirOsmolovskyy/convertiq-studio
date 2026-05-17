import { create } from 'zustand';
import type { Question, QuestionBranch, ScoringRule, ScoreResult, DesignConfig, Questionnaire } from '@/lib/types';
import { defaultDesign } from '@/lib/types';

interface QuestionnaireState {
  questionnaire: Questionnaire | null;
  questions: Question[];
  branches: QuestionBranch[];
  scoringRules: ScoringRule[];
  scoreResults: ScoreResult[];
  design: DesignConfig;
  isDirty: boolean;
  isSaving: boolean;

  setQuestionnaire: (q: Questionnaire) => void;
  setQuestions: (q: Question[]) => void;
  setBranches: (b: QuestionBranch[]) => void;
  setScoringRules: (s: ScoringRule[]) => void;
  setScoreResults: (s: ScoreResult[]) => void;
  setDesign: (d: DesignConfig) => void;
  updateDesign: (partial: Partial<DesignConfig>) => void;
  addQuestion: (type: Question['type']) => void;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  removeQuestion: (id: string) => void;
  reorderQuestions: (fromIndex: number, toIndex: number) => void;
  addOption: (questionId: string) => void;
  updateOption: (questionId: string, optionId: string, label: string) => void;
  removeOption: (questionId: string, optionId: string) => void;
  addBranch: (questionId: string) => void;
  updateBranch: (id: string, updates: Partial<QuestionBranch>) => void;
  removeBranch: (id: string) => void;
  updateScoringRule: (questionId: string, updates: Partial<ScoringRule>) => void;
  addScoreResult: () => void;
  updateScoreResult: (id: string, updates: Partial<ScoreResult>) => void;
  removeScoreResult: (id: string) => void;
  updateTitle: (title: string) => void;
  updateSlug: (slug: string) => void;
  togglePublished: () => void;
  hydrate: (data: {
    questionnaire: Questionnaire;
    questions: Question[];
    branches: QuestionBranch[];
    scoringRules: ScoringRule[];
    scoreResults: ScoreResult[];
    design: DesignConfig;
  }) => void;
  reset: () => void;
}

export const useQuestionnaireStore = create<QuestionnaireState>((set, get) => ({
  questionnaire: null,
  questions: [],
  branches: [],
  scoringRules: [],
  scoreResults: [],
  design: defaultDesign,
  isDirty: false,
  isSaving: false,

  setQuestionnaire: (q) => set({ questionnaire: q }),
  setQuestions: (q) => set({ questions: q, isDirty: true }),
  setBranches: (b) => set({ branches: b, isDirty: true }),
  setScoringRules: (s) => set({ scoringRules: s, isDirty: true }),
  setScoreResults: (s) => set({ scoreResults: s, isDirty: true }),
  setDesign: (d) => set({ design: d, isDirty: true }),

  updateDesign: (partial) => {
    const c = get().design;
    const bodyDefaults = { size: 16, weight: 400, lineHeight: 1.6, letterSpacing: 0, color: '#1d1d1f' };
    const headingDefaults = { size: 22, weight: 700, lineHeight: 1.2, letterSpacing: -0.02, color: '#1d1d1f' };
    set({
      design: {
        ...c,
        ...partial,
        colors: { ...c.colors, ...(partial.colors || {}) },
        typography: {
          ...c.typography,
          ...(partial.typography || {}),
          body: { ...bodyDefaults, ...c.typography.body, ...(partial.typography?.body || {}) },
          heading: { ...headingDefaults, ...c.typography.heading, ...(partial.typography?.heading || {}) },
        },
        layout: { ...c.layout, ...(partial.layout || {}) },
        components: {
          question: { ...c.components.question, ...(partial.components?.question || {}) },
          option: { ...c.components.option, ...(partial.components?.option || {}) },
          button: { ...c.components.button, ...(partial.components?.button || {}) },
          progress: { ...c.components.progress, ...(partial.components?.progress || {}) },
          input: { ...c.components.input, ...(partial.components?.input || {}) },
        },
        background: { ...c.background, ...(partial.background || {}) },
      },
      isDirty: true,
    });
  },

  addQuestion: (type) => {
    const questions = get().questions;
    const hasOptions = type === 'radio' || type === 'checkbox' || type === 'dropdown';
    const newQ: Question = {
      id: crypto.randomUUID(),
      questionnaire_id: get().questionnaire?.id || '',
      type,
      title: 'New Question',
      description: '',
      required: true,
      sort_order: questions.length,
      options: hasOptions
        ? [
            { id: crypto.randomUUID(), label: 'Option 1', value: 'option_1' },
            { id: crypto.randomUUID(), label: 'Option 2', value: 'option_2' },
          ]
        : [],
    };
    const newRule: ScoringRule = {
      id: crypto.randomUUID(),
      question_id: newQ.id,
      type: type === 'text' || type === 'textarea' ? 'ai' : 'fixed',
      option_scores: {},
      ai_score_min: 0,
      ai_score_max: 10,
      ai_prompt: '',
    };
    set({ questions: [...questions, newQ], scoringRules: [...get().scoringRules, newRule], isDirty: true });
  },

  updateQuestion: (id, updates) =>
    set({ questions: get().questions.map((q) => (q.id === id ? { ...q, ...updates } : q)), isDirty: true }),

  removeQuestion: (id) =>
    set({
      questions: get().questions.filter((q) => q.id !== id).map((q, i) => ({ ...q, sort_order: i })),
      branches: get().branches.filter((b) => b.question_id !== id && b.target_question_id !== id),
      scoringRules: get().scoringRules.filter((s) => s.question_id !== id),
      isDirty: true,
    }),

  reorderQuestions: (from, to) => {
    const qs = [...get().questions];
    const [moved] = qs.splice(from, 1);
    qs.splice(to, 0, moved);
    set({ questions: qs.map((q, i) => ({ ...q, sort_order: i })), isDirty: true });
  },

  addOption: (qId) =>
    set({
      questions: get().questions.map((q) => {
        if (q.id !== qId) return q;
        const n = q.options.length + 1;
        return { ...q, options: [...q.options, { id: crypto.randomUUID(), label: `Option ${n}`, value: `option_${n}` }] };
      }),
      isDirty: true,
    }),

  updateOption: (qId, oId, label) =>
    set({
      questions: get().questions.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          options: q.options.map((o) => (o.id === oId ? { ...o, label, value: label.toLowerCase().replace(/\s+/g, '_') } : o)),
        };
      }),
      isDirty: true,
    }),

  removeOption: (qId, oId) =>
    set({
      questions: get().questions.map((q) => (q.id !== qId ? q : { ...q, options: q.options.filter((o) => o.id !== oId) })),
      isDirty: true,
    }),

  addBranch: (qId) =>
    set({
      branches: [...get().branches, { id: crypto.randomUUID(), question_id: qId, condition: { field: '', operator: 'equals', value: '' }, target_question_id: null, is_end: false }],
      isDirty: true,
    }),

  updateBranch: (id, updates) =>
    set({ branches: get().branches.map((b) => (b.id === id ? { ...b, ...updates } : b)), isDirty: true }),

  removeBranch: (id) =>
    set({ branches: get().branches.filter((b) => b.id !== id), isDirty: true }),

  updateScoringRule: (qId, updates) => {
    const rules = get().scoringRules;
    const existing = rules.find((r) => r.question_id === qId);
    if (existing) {
      set({ scoringRules: rules.map((r) => (r.question_id === qId ? { ...r, ...updates } : r)), isDirty: true });
    } else {
      set({
        scoringRules: [...rules, { id: crypto.randomUUID(), question_id: qId, type: 'fixed', option_scores: {}, ai_score_min: 0, ai_score_max: 10, ai_prompt: '', ...updates }],
        isDirty: true,
      });
    }
  },

  addScoreResult: () => {
    const results = get().scoreResults;
    set({
      scoreResults: [...results, { id: crypto.randomUUID(), questionnaire_id: get().questionnaire?.id || '', min_score: 0, max_score: 10, title: 'Result Title', description: 'Result description', sort_order: results.length }],
      isDirty: true,
    });
  },

  updateScoreResult: (id, updates) =>
    set({ scoreResults: get().scoreResults.map((r) => (r.id === id ? { ...r, ...updates } : r)), isDirty: true }),

  removeScoreResult: (id) =>
    set({ scoreResults: get().scoreResults.filter((r) => r.id !== id), isDirty: true }),

  updateTitle: (title) => {
    const q = get().questionnaire;
    if (q) set({ questionnaire: { ...q, title }, isDirty: true });
  },

  updateSlug: (slug) => {
    const q = get().questionnaire;
    if (q) set({ questionnaire: { ...q, slug }, isDirty: true });
  },

  togglePublished: () => {
    const q = get().questionnaire;
    if (q) set({ questionnaire: { ...q, is_published: !q.is_published }, isDirty: true });
  },

  hydrate: (data) => set({ ...data, isDirty: false, isSaving: false }),

  reset: () =>
    set({ questionnaire: null, questions: [], branches: [], scoringRules: [], scoreResults: [], design: defaultDesign, isDirty: false, isSaving: false }),
}));
