import { create } from 'zustand';
import type {
  Question,
  QuestionBranch,
  ScoringRule,
  ResultPage,
  ResultNode,
  DesignConfig,
  ElementId,
  ElementStyles,
  BrandPalette,
  Questionnaire,
  LeadField,
  Audience,
  AudienceScoreRange,
} from '@/lib/types';
import { defaultDesign, defaultResultPageContent } from '@/lib/types';
import {
  appendChild,
  deleteNode,
  moveNodeToFrame,
  moveNodeToIndex,
  moveNodeWithinParent,
  patchNode,
} from '@/lib/resultPage';
import { createClient } from '@/lib/supabase/client';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEFAULT_AUDIENCE_COLORS = [
  '#007aff',
  '#34c759',
  '#ff9500',
  '#ff3b30',
  '#af52de',
  '#5ac8fa',
  '#ffcc00',
  '#5856d6',
];

interface QuestionnaireState {
  questionnaire: Questionnaire | null;
  questions: Question[];
  branches: QuestionBranch[];
  scoringRules: ScoringRule[];
  resultPages: ResultPage[];
  design: DesignConfig;
  /** Project-level brand palette. Read-only here — design colors resolve
   *  against it. Empty until hydrated. */
  brand: BrandPalette;
  audiences: Audience[];
  isDirty: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;

  setQuestionnaire: (q: Questionnaire) => void;
  setQuestions: (q: Question[]) => void;
  setBranches: (b: QuestionBranch[]) => void;
  setScoringRules: (s: ScoringRule[]) => void;
  setResultPages: (s: ResultPage[]) => void;
  setDesign: (d: DesignConfig) => void;
  updateDesign: (partial: Partial<DesignConfig>) => void;
  /** Merge a Partial&lt;ElementStyles&gt; into design.elements[id]. Creates
   *  the override object if missing. Used by the Inspector panel. */
  updateElementStyle: (elementId: ElementId, partial: Partial<ElementStyles>) => void;
  addQuestion: (type: Question['type']) => void;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  removeQuestion: (id: string) => void;
  reorderQuestions: (fromIndex: number, toIndex: number) => void;
  addOption: (questionId: string) => void;
  updateOption: (questionId: string, optionId: string, label: string) => void;
  toggleOptionRedFlag: (questionId: string, optionId: string) => void;
  removeOption: (questionId: string, optionId: string) => void;
  addBranch: (questionId: string) => void;
  updateBranch: (id: string, updates: Partial<QuestionBranch>) => void;
  removeBranch: (id: string) => void;
  reorderBranches: (questionId: string, fromIndex: number, toIndex: number) => void;
  updateScoringRule: (questionId: string, updates: Partial<ScoringRule>) => void;
  addResultPage: () => void;
  updateResultPage: (id: string, updates: Partial<ResultPage>) => void;
  removeResultPage: (id: string) => void;
  /** Mutate a single node in the page's content tree. */
  updateResultPageNode: (pageId: string, nodeId: string, patch: Partial<ResultNode>) => void;
  /** Append a node as the last child of the given parent frame. */
  addResultPageNode: (pageId: string, parentNodeId: string, node: ResultNode) => void;
  /** Remove a node by id (root cannot be removed). */
  removeResultPageNode: (pageId: string, nodeId: string) => void;
  /** Swap a node with its prev/next sibling. No-op at edges. */
  moveResultPageNode: (pageId: string, nodeId: string, direction: 'up' | 'down') => void;
  /** Reparent a node to be the last child of `parentNodeId`. No-op for
   *  cycles or invalid targets. */
  moveResultPageNodeTo: (pageId: string, nodeId: string, parentNodeId: string) => void;
  /** Reparent a node to a precise index in target parent's children.
   *  Same cycle/target validation as moveResultPageNodeTo. */
  moveResultPageNodeAt: (
    pageId: string,
    nodeId: string,
    parentNodeId: string,
    index: number,
  ) => void;
  updateTitle: (title: string) => void;
  updateSlug: (slug: string) => void;
  setDomain: (domainId: string | null) => void;
  togglePublished: () => void;
  addLeadField: () => void;
  updateLeadField: (id: string, updates: Partial<LeadField>) => void;
  removeLeadField: (id: string) => void;
  setLeadFieldTemplate: (templateId: string | null) => void;
  addAudience: () => void;
  updateAudience: (id: string, updates: Partial<Audience>) => void;
  removeAudience: (id: string) => void;
  reorderAudiences: (fromIndex: number, toIndex: number) => void;
  addAudienceRange: (audienceId: string) => void;
  updateAudienceRange: (
    audienceId: string,
    rangeId: string,
    updates: Partial<AudienceScoreRange>,
  ) => void;
  removeAudienceRange: (audienceId: string, rangeId: string) => void;
  setRedFlagThreshold: (threshold: number | null) => void;
  setRedFlagAudience: (audienceId: string | null) => void;
  hydrate: (data: {
    questionnaire: Questionnaire;
    questions: Question[];
    branches: QuestionBranch[];
    scoringRules: ScoringRule[];
    resultPages: ResultPage[];
    design: DesignConfig;
    audiences: Audience[];
    brand?: BrandPalette;
  }) => void;
  reset: () => void;
  saveAll: () => Promise<void>;
}

export const useQuestionnaireStore = create<QuestionnaireState>((set, get) => ({
  questionnaire: null,
  questions: [],
  branches: [],
  scoringRules: [],
  resultPages: [],
  design: defaultDesign,
  brand: {},
  audiences: [],
  isDirty: false,
  isSaving: false,
  saveStatus: 'idle' as SaveStatus,

  setQuestionnaire: (q) => set({ questionnaire: q }),
  setQuestions: (q) => set({ questions: q, isDirty: true }),
  setBranches: (b) => set({ branches: b, isDirty: true }),
  setScoringRules: (s) => set({ scoringRules: s, isDirty: true }),
  setResultPages: (s) => set({ resultPages: s, isDirty: true }),
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

  updateElementStyle: (elementId, partial) => {
    const c = get().design;
    const existing = c.elements?.[elementId] ?? {};
    set({
      design: {
        ...c,
        elements: { ...(c.elements ?? {}), [elementId]: { ...existing, ...partial } },
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

  toggleOptionRedFlag: (qId, oId) =>
    set({
      questions: get().questions.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          options: q.options.map((o) =>
            o.id === oId ? { ...o, is_red_flag: !o.is_red_flag } : o,
          ),
        };
      }),
      isDirty: true,
    }),

  removeOption: (qId, oId) =>
    set({
      questions: get().questions.map((q) => (q.id !== qId ? q : { ...q, options: q.options.filter((o) => o.id !== oId) })),
      isDirty: true,
    }),

  addBranch: (qId) => {
    const q = get().questions.find((x) => x.id === qId);
    const field: 'option' | 'value' =
      q && (q.type === 'radio' || q.type === 'checkbox' || q.type === 'dropdown') ? 'option' : 'value';
    const sortOrder = get().branches.filter((b) => b.question_id === qId).length;
    set({
      branches: [...get().branches, { id: crypto.randomUUID(), question_id: qId, condition: { field, operator: 'equals', value: '' }, target_question_id: null, is_end: false, sort_order: sortOrder, assign_audience_id: null }],
      isDirty: true,
    });
  },

  updateBranch: (id, updates) =>
    set({ branches: get().branches.map((b) => (b.id === id ? { ...b, ...updates } : b)), isDirty: true }),

  removeBranch: (id) =>
    set({ branches: get().branches.filter((b) => b.id !== id), isDirty: true }),

  reorderBranches: (questionId, from, to) => {
    const qBranches = get()
      .branches.filter((b) => b.question_id === questionId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const [moved] = qBranches.splice(from, 1);
    qBranches.splice(to, 0, moved);
    const reindexed = new Map(qBranches.map((b, i) => [b.id, { ...b, sort_order: i }]));
    set({
      branches: get().branches.map((b) => reindexed.get(b.id) ?? b),
      isDirty: true,
    });
  },

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

  addResultPage: () => {
    const pages = get().resultPages;
    set({
      resultPages: [
        ...pages,
        {
          id: crypto.randomUUID(),
          questionnaire_id: get().questionnaire?.id || '',
          name: 'Result',
          min_score: 0,
          max_score: 10,
          sort_order: pages.length,
          content: defaultResultPageContent(),
        },
      ],
      isDirty: true,
    });
  },

  updateResultPage: (id, updates) =>
    set({ resultPages: get().resultPages.map((r) => (r.id === id ? { ...r, ...updates } : r)), isDirty: true }),

  removeResultPage: (id) =>
    set({ resultPages: get().resultPages.filter((r) => r.id !== id), isDirty: true }),

  updateResultPageNode: (pageId, nodeId, patch) =>
    set({
      resultPages: get().resultPages.map((p) =>
        p.id === pageId ? { ...p, content: patchNode(p.content, nodeId, patch) } : p,
      ),
      isDirty: true,
    }),

  addResultPageNode: (pageId, parentNodeId, node) =>
    set({
      resultPages: get().resultPages.map((p) =>
        p.id === pageId ? { ...p, content: appendChild(p.content, parentNodeId, node) } : p,
      ),
      isDirty: true,
    }),

  removeResultPageNode: (pageId, nodeId) =>
    set({
      resultPages: get().resultPages.map((p) =>
        p.id === pageId ? { ...p, content: deleteNode(p.content, nodeId) } : p,
      ),
      isDirty: true,
    }),

  moveResultPageNode: (pageId, nodeId, direction) =>
    set({
      resultPages: get().resultPages.map((p) =>
        p.id === pageId
          ? { ...p, content: moveNodeWithinParent(p.content, nodeId, direction) }
          : p,
      ),
      isDirty: true,
    }),

  moveResultPageNodeTo: (pageId, nodeId, parentNodeId) =>
    set({
      resultPages: get().resultPages.map((p) =>
        p.id === pageId
          ? { ...p, content: moveNodeToFrame(p.content, nodeId, parentNodeId) }
          : p,
      ),
      isDirty: true,
    }),

  moveResultPageNodeAt: (pageId, nodeId, parentNodeId, index) =>
    set({
      resultPages: get().resultPages.map((p) =>
        p.id === pageId
          ? { ...p, content: moveNodeToIndex(p.content, nodeId, parentNodeId, index) }
          : p,
      ),
      isDirty: true,
    }),

  updateTitle: (title) => {
    const q = get().questionnaire;
    if (q) set({ questionnaire: { ...q, title }, isDirty: true });
  },

  updateSlug: (slug) => {
    const q = get().questionnaire;
    if (q) set({ questionnaire: { ...q, slug }, isDirty: true });
  },

  setDomain: (domainId) => {
    const q = get().questionnaire;
    if (q) set({ questionnaire: { ...q, domain_id: domainId }, isDirty: true });
  },

  togglePublished: () => {
    const q = get().questionnaire;
    if (q) set({ questionnaire: { ...q, is_published: !q.is_published }, isDirty: true });
  },

  addLeadField: () => {
    const q = get().questionnaire;
    if (!q) return;
    const newField: LeadField = {
      id: crypto.randomUUID(),
      label: 'New field',
      kind: 'url',
      urlParam: '',
    };
    set({
      questionnaire: { ...q, lead_fields: [...(q.lead_fields || []), newField] },
      isDirty: true,
    });
  },

  updateLeadField: (id, updates) => {
    const q = get().questionnaire;
    if (!q) return;
    set({
      questionnaire: {
        ...q,
        lead_fields: (q.lead_fields || []).map((f) => (f.id === id ? { ...f, ...updates } : f)),
      },
      isDirty: true,
    });
  },

  removeLeadField: (id) => {
    const q = get().questionnaire;
    if (!q) return;
    set({
      questionnaire: { ...q, lead_fields: (q.lead_fields || []).filter((f) => f.id !== id) },
      isDirty: true,
    });
  },

  setLeadFieldTemplate: (templateId) => {
    const q = get().questionnaire;
    if (!q) return;
    set({
      questionnaire: { ...q, lead_field_template_id: templateId },
      isDirty: true,
    });
  },

  addAudience: () => {
    const qId = get().questionnaire?.id ?? '';
    const audiences = get().audiences;
    set({
      audiences: [
        ...audiences,
        {
          id: crypto.randomUUID(),
          questionnaire_id: qId,
          name: `Audience ${audiences.length + 1}`,
          color: DEFAULT_AUDIENCE_COLORS[audiences.length % DEFAULT_AUDIENCE_COLORS.length],
          sort_order: audiences.length,
          score_ranges: [],
        },
      ],
      isDirty: true,
    });
  },

  updateAudience: (id, updates) =>
    set({
      audiences: get().audiences.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      isDirty: true,
    }),

  removeAudience: (id) => {
    const q = get().questionnaire;
    set({
      audiences: get().audiences.filter((a) => a.id !== id).map((a, i) => ({ ...a, sort_order: i })),
      questionnaire:
        q && q.red_flag_audience_id === id ? { ...q, red_flag_audience_id: null } : q,
      branches: get().branches.map((b) =>
        b.assign_audience_id === id ? { ...b, assign_audience_id: null } : b,
      ),
      isDirty: true,
    });
  },

  reorderAudiences: (from, to) => {
    const list = [...get().audiences];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    set({
      audiences: list.map((a, i) => ({ ...a, sort_order: i })),
      isDirty: true,
    });
  },

  addAudienceRange: (audienceId) =>
    set({
      audiences: get().audiences.map((a) => {
        if (a.id !== audienceId) return a;
        return {
          ...a,
          score_ranges: [
            ...a.score_ranges,
            {
              id: crypto.randomUUID(),
              audience_id: audienceId,
              min_score: 0,
              max_score: 10,
              sort_order: a.score_ranges.length,
            },
          ],
        };
      }),
      isDirty: true,
    }),

  updateAudienceRange: (audienceId, rangeId, updates) =>
    set({
      audiences: get().audiences.map((a) => {
        if (a.id !== audienceId) return a;
        return {
          ...a,
          score_ranges: a.score_ranges.map((r) => (r.id === rangeId ? { ...r, ...updates } : r)),
        };
      }),
      isDirty: true,
    }),

  removeAudienceRange: (audienceId, rangeId) =>
    set({
      audiences: get().audiences.map((a) => {
        if (a.id !== audienceId) return a;
        return {
          ...a,
          score_ranges: a.score_ranges
            .filter((r) => r.id !== rangeId)
            .map((r, i) => ({ ...r, sort_order: i })),
        };
      }),
      isDirty: true,
    }),

  setRedFlagThreshold: (threshold) => {
    const q = get().questionnaire;
    if (!q) return;
    set({
      questionnaire: { ...q, red_flag_threshold: threshold },
      isDirty: true,
    });
  },

  setRedFlagAudience: (audienceId) => {
    const q = get().questionnaire;
    if (!q) return;
    set({
      questionnaire: { ...q, red_flag_audience_id: audienceId },
      isDirty: true,
    });
  },

  hydrate: (data) => set({ ...data, brand: data.brand ?? {}, isDirty: false, isSaving: false, saveStatus: 'idle' }),

  reset: () =>
    set({ questionnaire: null, questions: [], branches: [], scoringRules: [], resultPages: [], design: defaultDesign, brand: {}, audiences: [], isDirty: false, isSaving: false, saveStatus: 'idle' }),

  saveAll: async () => {
    // Read fresh state on each call so we always persist the latest store.
    const s = get();
    if (!s.questionnaire || s.isSaving) return;
    set({ isSaving: true, saveStatus: 'saving' });

    try {
      const supabase = createClient();
      const qId = s.questionnaire.id;

      // 1. Update questionnaire metadata
      const { error: qErr } = await supabase
        .from('questionnaires')
        .update({
          title: s.questionnaire.title,
          slug: s.questionnaire.slug,
          domain_id: s.questionnaire.domain_id,
          is_published: s.questionnaire.is_published,
          lead_fields: s.questionnaire.lead_fields ?? [],
          lead_field_template_id: s.questionnaire.lead_field_template_id ?? null,
          red_flag_threshold: s.questionnaire.red_flag_threshold ?? null,
          red_flag_audience_id: s.questionnaire.red_flag_audience_id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', qId);
      if (qErr) console.error('Save questionnaire failed:', qErr);

      // 2. Delete child records FIRST (RLS checks parent existence)
      const oldQuestionsRes = await supabase
        .from('questions')
        .select('id')
        .eq('questionnaire_id', qId);
      const oldQuestionIds = (oldQuestionsRes.data || []).map((q: { id: string }) => q.id);

      if (oldQuestionIds.length > 0) {
        const { error: bDelErr } = await supabase
          .from('question_branches')
          .delete()
          .in('question_id', oldQuestionIds);
        if (bDelErr) console.error('Delete branches failed:', bDelErr);

        const { error: sDelErr } = await supabase
          .from('scoring_rules')
          .delete()
          .in('question_id', oldQuestionIds);
        if (sDelErr) console.error('Delete scoring rules failed:', sDelErr);
      }

      // 3. Delete old result pages
      const { error: srDelErr } = await supabase
        .from('result_pages')
        .delete()
        .eq('questionnaire_id', qId);
      if (srDelErr) console.error('Delete result pages failed:', srDelErr);

      // 4. Delete old questions
      const { error: qDelErr } = await supabase
        .from('questions')
        .delete()
        .eq('questionnaire_id', qId);
      if (qDelErr) console.error('Delete questions failed:', qDelErr);

      // 5. Insert new questions
      if (s.questions.length > 0) {
        const { error: qInsErr } = await supabase.from('questions').insert(
          s.questions.map((q) => ({
            id: q.id,
            questionnaire_id: qId,
            type: q.type,
            title: q.title,
            description: q.description || null,
            required: q.required,
            sort_order: q.sort_order,
            options: q.options,
            validation: q.validation || null,
          })),
        );
        if (qInsErr) console.error('Insert questions failed:', qInsErr);
      }

      // 6. Insert new branches
      if (s.branches.length > 0) {
        const { error: bInsErr } = await supabase.from('question_branches').insert(
          s.branches.map((b) => ({
            id: b.id,
            question_id: b.question_id,
            condition: b.condition,
            target_question_id: b.target_question_id,
            is_end: b.is_end,
            sort_order: b.sort_order ?? 0,
            assign_audience_id: b.assign_audience_id ?? null,
          })),
        );
        if (bInsErr) console.error('Insert branches failed:', bInsErr);
      }

      // 7. Insert new scoring rules
      if (s.scoringRules.length > 0) {
        const { error: sInsErr } = await supabase.from('scoring_rules').insert(
          s.scoringRules.map((r) => ({
            id: r.id,
            question_id: r.question_id,
            type: r.type,
            option_scores: r.option_scores,
            ai_score_min: r.ai_score_min,
            ai_score_max: r.ai_score_max,
            ai_prompt: r.ai_prompt || null,
          })),
        );
        if (sInsErr) console.error('Insert scoring rules failed:', sInsErr);
      }

      // 8. Insert new result pages
      if (s.resultPages.length > 0) {
        const { error: srInsErr } = await supabase.from('result_pages').insert(
          s.resultPages.map((r) => ({
            id: r.id,
            questionnaire_id: qId,
            name: r.name,
            min_score: r.min_score,
            max_score: r.max_score,
            sort_order: r.sort_order,
            content: r.content,
          })),
        );
        if (srInsErr) console.error('Insert result pages failed:', srInsErr);
      }

      // 9. Upsert design
      const { error: dErr } = await supabase
        .from('questionnaire_designs')
        .upsert(
          { questionnaire_id: qId, config: s.design },
          { onConflict: 'questionnaire_id' },
        );
      if (dErr) console.error('Upsert design failed:', dErr);

      // 10. Sync audiences + their score ranges.
      // Delete-then-insert is fine here: leads reference audiences via
      // responses.audience_id with ON DELETE SET NULL, so audience
      // churn on edit nulls historical assignments rather than failing.
      // For most editor flows audiences are stable; the only common
      // mutation is adding/removing ranges.
      const audienceIds = s.audiences.map((a) => a.id);
      const { data: existingAudiences } = await supabase
        .from('questionnaire_audiences')
        .select('id')
        .eq('questionnaire_id', qId);
      const existingIds = (existingAudiences ?? []).map((a: { id: string }) => a.id);
      const toDelete = existingIds.filter((id) => !audienceIds.includes(id));
      if (toDelete.length > 0) {
        const { error: aDelErr } = await supabase
          .from('questionnaire_audiences')
          .delete()
          .in('id', toDelete);
        if (aDelErr) console.error('Delete audiences failed:', aDelErr);
      }

      if (s.audiences.length > 0) {
        const { error: aUpErr } = await supabase
          .from('questionnaire_audiences')
          .upsert(
            s.audiences.map((a) => ({
              id: a.id,
              questionnaire_id: qId,
              name: a.name,
              color: a.color,
              sort_order: a.sort_order,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: 'id' },
          );
        if (aUpErr) console.error('Upsert audiences failed:', aUpErr);

        if (audienceIds.length > 0) {
          const { error: rDelErr } = await supabase
            .from('questionnaire_audience_score_ranges')
            .delete()
            .in('audience_id', audienceIds);
          if (rDelErr) console.error('Delete audience ranges failed:', rDelErr);
        }

        const allRanges = s.audiences.flatMap((a) =>
          a.score_ranges.map((r) => ({
            id: r.id,
            audience_id: a.id,
            min_score: r.min_score,
            max_score: r.max_score,
            sort_order: r.sort_order,
          })),
        );
        if (allRanges.length > 0) {
          const { error: rInsErr } = await supabase
            .from('questionnaire_audience_score_ranges')
            .insert(allRanges);
          if (rInsErr) console.error('Insert audience ranges failed:', rInsErr);
        }
      }

      set({ isDirty: false, isSaving: false, saveStatus: 'saved' });

      // Fire-and-forget: refresh total_score + audience_id on every
      // existing response against the latest config. The endpoint is
      // idempotent and writes only diffs, so it's safe to fire on
      // every save regardless of which field changed.
      void fetch('/api/audiences/recompute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionnaire_id: qId }),
      }).catch(() => {});

      // Drop the "Saved" indicator back to idle after 3s.
      setTimeout(() => {
        if (get().saveStatus === 'saved') set({ saveStatus: 'idle' });
      }, 3000);
    } catch (err) {
      console.error('Save failed:', err);
      set({ isSaving: false, saveStatus: 'error' });
    }
  },
}));
