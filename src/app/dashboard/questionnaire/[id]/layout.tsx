'use client';

import { useEffect, useRef, useState, use } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { defaultDesign } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import styles from './editor.module.css';

const AUTO_SAVE_DELAY = 2000; // ms after last change

export default function EditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pathname = usePathname();
  const [loaded, setLoaded] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tab segment is the 5th path part: /dashboard/questionnaire/{id}/{tab}/...
  const activeTab = pathname.split('/')[4] || 'content';

  /* ─── Load data from Supabase ──────────────────────────────── */
  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();

      const [qRes, questionsRes, resultsRes, designRes] = await Promise.all([
        supabase.from('questionnaires').select('*').eq('id', id).single(),
        supabase.from('questions').select('*').eq('questionnaire_id', id).order('sort_order'),
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

        useQuestionnaireStore.getState().hydrate({
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
    loadData();
  }, [id]);

  /* ─── Auto-save: debounced on isDirty ──────────────────────── */
  useEffect(() => {
    const unsub = useQuestionnaireStore.subscribe((state) => {
      if (!state.isDirty) return;
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        useQuestionnaireStore.getState().saveAll();
      }, AUTO_SAVE_DELAY);
    });

    return () => {
      unsub();
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  /* ─── Force-save when entering preview tab ────────────────── */
  useEffect(() => {
    if (activeTab !== 'preview') return;
    const s = useQuestionnaireStore.getState();
    if (s.isDirty) s.saveAll();
  }, [activeTab]);

  /* ─── Save on page unload / navigation away ───────────────── */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const s = useQuestionnaireStore.getState();
      if (s.isDirty && s.questionnaire) {
        s.saveAll();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  /* ─── Render ───────────────────────────────────────────────── */
  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        <Loader2 size={24} strokeWidth={1.75} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className={styles.editorShell}>
      <div className={`${styles.editorBody} ${activeTab === 'preview' ? styles.editorBodyPreview : ''}`}>
        {children}
      </div>
    </div>
  );
}
