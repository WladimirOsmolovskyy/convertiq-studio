'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Plus, Megaphone, Sparkles } from 'lucide-react';
import { defaultDocument } from '../../_templates/static-ad-default';
import type { AdTemplateRow } from '@/lib/adTemplates';
import styles from '../../../dashboard.module.css';

export default function TemplatesList({
  initial,
  activeProjectId,
}: {
  initial: AdTemplateRow[];
  activeProjectId: string;
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState<AdTemplateRow[]>(initial);

  useEffect(() => {
    for (const t of templates) {
      router.prefetch(`/dashboard/ads/templates/${t.id}`);
    }
  }, [templates, router]);

  const createNew = async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('ad_templates')
      .insert({
        project_id: activeProjectId,
        title: 'Untitled Ad Template',
        document: defaultDocument,
        variables: [],
      })
      .select()
      .single();

    if (data && !error) {
      router.push(`/dashboard/ads/templates/${data.id}`);
    }
  };

  const deleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this template? Existing generations will be detached.')) return;
    const supabase = createClient();
    await supabase.from('ad_templates').delete().eq('id', id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className={styles.contentBody}>
      <div className={styles.largeTitleBlock}>
        <h1 className={styles.largeTitle}>Ad Templates</h1>
        {templates.length > 0 && (
          <button className="btn btn-primary" onClick={createNew}>
            <Plus size={14} strokeWidth={2.5} /> New
          </button>
        )}
      </div>

      {templates.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>
            <Megaphone size={28} strokeWidth={1.5} />
          </div>
          <h2 className={styles.emptyStateTitle}>No templates yet</h2>
          <p className={styles.emptyStateDesc}>
            Build a static ad once, mark the parts you want to swap out as variables,
            and reuse the template to generate as many variations as you need.
          </p>
          <button className="btn btn-primary btn-lg" onClick={createNew}>
            <Plus size={16} strokeWidth={2.5} /> Create Your First Template
          </button>
        </div>
      ) : (
        <div className={styles.questionnaireGrid}>
          {templates.map((t) => (
            <div
              key={t.id}
              className={styles.questionnaireCard}
              onClick={() => router.push(`/dashboard/ads/templates/${t.id}`)}
            >
              <div>
                <h3 className={styles.cardTitle}>{t.title}</h3>
                <div className={styles.cardMeta}>
                  <span>{(t.variables ?? []).length} variable{(t.variables ?? []).length === 1 ? '' : 's'}</span>
                  <span>·</span>
                  <span>{formatDate(t.updated_at)}</span>
                </div>
              </div>
              <div className={styles.cardActions}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dashboard/ads/templates/${t.id}`);
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dashboard/ads/templates/${t.id}/generate`);
                  }}
                >
                  <Sparkles size={12} strokeWidth={2} /> Generate
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={(e) => deleteTemplate(t.id, e)}
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
