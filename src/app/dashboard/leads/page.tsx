import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveProject } from '@/lib/projects';
import { ClipboardList, Users } from 'lucide-react';
import Link from 'next/link';
import styles from '../dashboard.module.css';

export default async function LeadsPickerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const active = await getActiveProject(supabase, user.id);

  const { data: questionnaires } = await supabase
    .from('questionnaires')
    .select('id, title, is_published, updated_at')
    .eq('project_id', active.id)
    .order('updated_at', { ascending: false });

  const list = questionnaires || [];

  let countsByQ: Record<string, number> = {};
  if (list.length > 0) {
    const { data: responses } = await supabase
      .from('responses')
      .select('questionnaire_id')
      .in(
        'questionnaire_id',
        list.map((q) => q.id),
      );
    countsByQ = (responses || []).reduce<Record<string, number>>((acc, r) => {
      acc[r.questionnaire_id] = (acc[r.questionnaire_id] || 0) + 1;
      return acc;
    }, {});
  }

  return (
    <div className={styles.contentBody}>
      <div className={styles.largeTitleBlock}>
        <h1 className={styles.largeTitle}>Leads</h1>
      </div>

      {list.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>
            <Users size={28} strokeWidth={1.5} />
          </div>
          <h2 className={styles.emptyStateTitle}>No questionnaires yet</h2>
          <p className={styles.emptyStateDesc}>
            Create a questionnaire and publish it to start collecting leads.
          </p>
        </div>
      ) : (
        <div className={styles.questionnaireGrid}>
          {list.map((q) => {
            const count = countsByQ[q.id] || 0;
            return (
              <Link
                key={q.id}
                href={`/dashboard/questionnaire/${q.id}/leads`}
                className={styles.questionnaireCard}
                style={{ textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <ClipboardList size={16} strokeWidth={1.75} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  <h3 className={styles.cardTitle} style={{ margin: 0 }}>{q.title}</h3>
                </div>
                <div className={styles.cardMeta} style={{ marginTop: '0.25rem' }}>
                  <span className={`badge ${q.is_published ? 'badge-success' : 'badge-warning'}`}>
                    {q.is_published ? 'Published' : 'Draft'}
                  </span>
                  <span>
                    {count} {count === 1 ? 'lead' : 'leads'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
