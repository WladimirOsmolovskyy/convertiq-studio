'use client';

import { useEffect, useState, useCallback, useRef, use, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { defaultDesign } from '@/lib/types';
import {
  ArrowLeft,
  FileText,
  GitBranch,
  Target,
  Paintbrush,
  Play,
  Users,
  Download,
  Loader2,
  Check,
  AlertCircle,
  Circle,
} from 'lucide-react';
import ImportModal from './ImportModal';
import PublishPopover from './PublishPopover';
import styles from './editor.module.css';

const TAB_ICON = { size: 14, strokeWidth: 1.75 } as const;

const TABS: ReadonlyArray<{ key: string; label: string; icon: ReactNode }> = [
  { key: 'content', label: 'Content', icon: <FileText {...TAB_ICON} /> },
  { key: 'logic', label: 'Logic', icon: <GitBranch {...TAB_ICON} /> },
  { key: 'scoring', label: 'Scoring', icon: <Target {...TAB_ICON} /> },
  { key: 'design', label: 'Design', icon: <Paintbrush {...TAB_ICON} /> },
  { key: 'preview', label: 'Preview', icon: <Play {...TAB_ICON} /> },
  { key: 'leads', label: 'Leads', icon: <Users {...TAB_ICON} /> },
];

const AUTO_SAVE_DELAY = 2000; // ms after last change

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function EditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const store = useQuestionnaireStore();
  const [loaded, setLoaded] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const savedIndicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tab segment is always the 5th path part: /dashboard/questionnaire/{id}/{tab}/...
  // Pull from index 4 so /leads/[leadId] still highlights the Leads tab.
  const activeTab = pathname.split('/')[4] || 'content';

  /* ─── Load data from Supabase ──────────────────────────────── */
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    const supabase = createClient();

    const [qRes, questionsRes, branchesRes, scoringRes, resultsRes, designRes] = await Promise.all([
      supabase.from('questionnaires').select('*').eq('id', id).single(),
      supabase.from('questions').select('*').eq('questionnaire_id', id).order('sort_order'),
      supabase.from('question_branches').select('*').eq('question_id', id),
      supabase.from('scoring_rules').select('*'),
      supabase.from('score_results').select('*').eq('questionnaire_id', id).order('sort_order'),
      supabase.from('questionnaire_designs').select('*').eq('questionnaire_id', id).single(),
    ]);

    if (qRes.data) {
      const questionIds = (questionsRes.data || []).map((q: { id: string }) => q.id);
      const branchRes = questionIds.length > 0
        ? await supabase.from('question_branches').select('*').in('question_id', questionIds)
        : { data: [] };
      const scoreRulesRes = questionIds.length > 0
        ? await supabase.from('scoring_rules').select('*').in('question_id', questionIds)
        : { data: [] };

      store.hydrate({
        questionnaire: qRes.data,
        questions: questionsRes.data || [],
        branches: branchRes.data || [],
        scoringRules: scoreRulesRes.data || [],
        scoreResults: resultsRes.data || [],
        design: designRes.data?.config && Object.keys(designRes.data.config).length > 0
          ? { ...defaultDesign, ...designRes.data.config }
          : defaultDesign,
      });
    }
    setLoaded(true);
  };

  /* ─── Persist to Supabase ──────────────────────────────────── */
  const saveAll = useCallback(async () => {
    // Always read the absolute latest state from the store
    const s = useQuestionnaireStore.getState();
    if (!s.questionnaire || isSavingRef.current) return;
    isSavingRef.current = true;
    setSaveStatus('saving');

    try {
      const supabase = createClient();
      const qId = s.questionnaire.id;
      const questionIds = s.questions.map((q) => q.id);

      // 1. Update questionnaire metadata
      const { error: qErr } = await supabase.from('questionnaires').update({
        title: s.questionnaire.title,
        slug: s.questionnaire.slug,
        domain_id: s.questionnaire.domain_id,
        is_published: s.questionnaire.is_published,
        updated_at: new Date().toISOString(),
      }).eq('id', qId);
      if (qErr) console.error('Save questionnaire failed:', qErr);

      // 2. Delete child records FIRST (while parent questions still exist for RLS)
      //    Branches and scoring_rules have RLS that checks question_id → questions → questionnaires
      //    So we must delete them while the old questions still exist in the DB.
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

      // 3. Delete old score results
      const { error: srDelErr } = await supabase
        .from('score_results')
        .delete()
        .eq('questionnaire_id', qId);
      if (srDelErr) console.error('Delete score results failed:', srDelErr);

      // 4. Delete old questions (children are already gone)
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
          }))
        );
        if (qInsErr) console.error('Insert questions failed:', qInsErr);
      }

      // 6. Insert new branches (questions now exist for RLS check)
      if (s.branches.length > 0) {
        const { error: bInsErr } = await supabase.from('question_branches').insert(
          s.branches.map((b) => ({
            id: b.id,
            question_id: b.question_id,
            condition: b.condition,
            target_question_id: b.target_question_id,
            is_end: b.is_end,
          }))
        );
        if (bInsErr) console.error('Insert branches failed:', bInsErr);
      }

      // 7. Insert new scoring rules (questions now exist for RLS check)
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
          }))
        );
        if (sInsErr) console.error('Insert scoring rules failed:', sInsErr);
      }

      // 8. Insert new score results
      if (s.scoreResults.length > 0) {
        const { error: srInsErr } = await supabase.from('score_results').insert(
          s.scoreResults.map((r) => ({
            id: r.id,
            questionnaire_id: qId,
            min_score: r.min_score,
            max_score: r.max_score,
            title: r.title,
            description: r.description,
            sort_order: r.sort_order,
          }))
        );
        if (srInsErr) console.error('Insert score results failed:', srInsErr);
      }

      // 9. Upsert design
      const { error: dErr } = await supabase.from('questionnaire_designs').upsert({
        questionnaire_id: qId,
        config: s.design,
      }, { onConflict: 'questionnaire_id' });
      if (dErr) console.error('Upsert design failed:', dErr);

      // Mark clean
      useQuestionnaireStore.setState({ isDirty: false });

      setSaveStatus('saved');
      // Clear "Saved" indicator after 3s
      if (savedIndicatorTimer.current) clearTimeout(savedIndicatorTimer.current);
      savedIndicatorTimer.current = setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Auto-save failed:', err);
      setSaveStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  /* ─── Auto-save: debounced on isDirty ──────────────────────── */
  useEffect(() => {
    // Subscribe to store changes
    const unsub = useQuestionnaireStore.subscribe((state) => {
      if (!state.isDirty) return;

      // Clear previous timer
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

      // Schedule save
      autoSaveTimer.current = setTimeout(() => {
        saveAll();
      }, AUTO_SAVE_DELAY);
    });

    return () => {
      unsub();
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [saveAll]);

  /* ─── Save on page unload / navigation away ───────────────── */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const s = useQuestionnaireStore.getState();
      if (s.isDirty && s.questionnaire) {
        // Fire and forget — browser may or may not complete it
        saveAll();
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveAll]);

  /* ─── Save before navigating back to dashboard ─────────────── */
  const handleBack = useCallback(async () => {
    const s = useQuestionnaireStore.getState();
    if (s.isDirty) {
      await saveAll();
    }
    router.push('/dashboard');
  }, [saveAll, router]);

  /* ─── Render ───────────────────────────────────────────────── */
  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <Loader2 size={24} strokeWidth={1.75} className="animate-spin" />
      </div>
    );
  }

  const statusContent = (() => {
    switch (saveStatus) {
      case 'saving':
        return { icon: <Loader2 size={12} strokeWidth={2} className="animate-spin" />, label: 'Saving', color: 'var(--text-muted)' };
      case 'saved':
        return { icon: <Check size={12} strokeWidth={2.25} />, label: 'Saved', color: 'var(--success)' };
      case 'error':
        return { icon: <AlertCircle size={12} strokeWidth={2} />, label: 'Error', color: 'var(--error)' };
      default:
        return store.isDirty
          ? { icon: <Circle size={8} strokeWidth={0} fill="currentColor" />, label: 'Unsaved', color: 'var(--warning)' }
          : { icon: null, label: '', color: 'var(--text-muted)' };
    }
  })();

  return (
    <div className={styles.editorShell}>
      {/* Header */}
      <div className={styles.editorHeader}>
        <button className={styles.editorBack} onClick={handleBack} aria-label="Back to dashboard">
          <ArrowLeft size={17} strokeWidth={1.75} />
        </button>
        <input
          className={styles.editorTitleInput}
          value={store.questionnaire?.title || ''}
          onChange={(e) => store.updateTitle(e.target.value)}
          placeholder="Untitled"
        />
        <div className={styles.editorHeaderActions}>
          {statusContent.label && (
            <span
              className={styles.saveStatus}
              style={{ color: statusContent.color }}
            >
              {statusContent.icon}
              {statusContent.label}
            </span>
          )}

          {store.questionnaire && (
            <PublishPopover
              projectId={store.questionnaire.project_id}
              domainId={store.questionnaire.domain_id}
              slug={store.questionnaire.slug}
              isPublished={store.questionnaire.is_published}
              onDomainChange={store.setDomain}
              onSlugChange={store.updateSlug}
              onTogglePublished={store.togglePublished}
            />
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>
            <Download size={13} strokeWidth={2} /> Import
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={saveAll}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.editorTabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.editorTab} ${activeTab === tab.key ? styles.active : ''} ${tab.key === 'preview' ? styles.previewTab : ''}`}
            onClick={async () => {
              // Auto-save before entering preview so responses save correctly
              if (tab.key === 'preview') {
                const s = useQuestionnaireStore.getState();
                if (s.isDirty) await saveAll();
              }
              router.push(`/dashboard/questionnaire/${id}/${tab.key}`);
            }}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Import Modal */}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}

      {/* Body */}
      <div className={`${styles.editorBody} ${activeTab === 'preview' ? styles.editorBodyPreview : ''}`}>
        {children}
      </div>
    </div>
  );
}
