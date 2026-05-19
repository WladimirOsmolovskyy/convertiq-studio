'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from 'nanoid';
import { Plus, ClipboardList } from 'lucide-react';
import type { Questionnaire } from '@/lib/types';
import styles from '../dashboard.module.css';

export default function QuestionnairesList({
  initial,
  activeProjectId,
}: {
  initial: Questionnaire[];
  activeProjectId: string;
}) {
  const router = useRouter();
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>(initial);

  // Prefetch each questionnaire's editor route so clicks feel instant
  useEffect(() => {
    for (const q of questionnaires) {
      router.prefetch(`/dashboard/questionnaire/${q.id}/content`);
    }
  }, [questionnaires, router]);

  const createNew = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const slug = nanoid(10);
    const { data, error } = await supabase
      .from('questionnaires')
      .insert({
        user_id: user.id,
        project_id: activeProjectId,
        title: 'Untitled Questionnaire',
        slug,
        is_published: false,
      })
      .select()
      .single();

    if (data && !error) {
      await supabase.from('questionnaire_designs').insert({
        questionnaire_id: data.id,
        config: {},
      });
      router.push(`/dashboard/questionnaire/${data.id}/content`);
    }
  };

  const deleteQuestionnaire = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this questionnaire?')) return;
    const supabase = createClient();
    await supabase.from('questionnaires').delete().eq('id', id);
    setQuestionnaires((prev) => prev.filter((q) => q.id !== id));
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className={styles.contentBody}>
      <div className={styles.largeTitleBlock}>
        <h1 className={styles.largeTitle}>Questionnaires</h1>
        {questionnaires.length > 0 && (
          <button className="btn btn-primary" onClick={createNew}>
            <Plus size={14} strokeWidth={2.5} /> New
          </button>
        )}
      </div>

      {questionnaires.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>
            <ClipboardList size={28} strokeWidth={1.5} />
          </div>
          <h2 className={styles.emptyStateTitle}>No questionnaires yet</h2>
          <p className={styles.emptyStateDesc}>
            Create your first interactive questionnaire with branching logic and scoring.
          </p>
          <button className="btn btn-primary btn-lg" onClick={createNew}>
            <Plus size={16} strokeWidth={2.5} /> Create Your First Questionnaire
          </button>
        </div>
      ) : (
        <div className={styles.questionnaireGrid}>
          {questionnaires.map((q) => (
            <div
              key={q.id}
              className={styles.questionnaireCard}
              onClick={() => router.push(`/dashboard/questionnaire/${q.id}/content`)}
            >
              <div>
                <h3 className={styles.cardTitle}>{q.title}</h3>
                <div className={styles.cardMeta}>
                  <span className={`badge ${q.is_published ? 'badge-success' : 'badge-warning'}`}>
                    {q.is_published ? 'Published' : 'Draft'}
                  </span>
                  <span>{formatDate(q.updated_at)}</span>
                </div>
              </div>
              <div className={styles.cardActions}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dashboard/questionnaire/${q.id}/content`);
                  }}
                >
                  Edit
                </button>
                {q.is_published && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/q/${q.slug}`, '_blank');
                    }}
                  >
                    Preview
                  </button>
                )}
                <button
                  className="btn btn-danger btn-sm"
                  onClick={(e) => deleteQuestionnaire(q.id, e)}
                  style={{ marginLeft: 'auto' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
