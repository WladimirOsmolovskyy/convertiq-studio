'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Plus, Sparkles, ChevronDown } from 'lucide-react';
import type { AdGenerationRow, AdTemplateRow } from '@/lib/adTemplates';
import styles from '../../../dashboard.module.css';
import gen from '../generations.module.css';

interface Props {
  generations: AdGenerationRow[];
  templates: Pick<AdTemplateRow, 'id' | 'title'>[];
  activeProjectId: string;
}

export default function GenerationsList({ generations: initial, templates }: Props) {
  const router = useRouter();
  const [generations, setGenerations] = useState<AdGenerationRow[]>(initial);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    for (const g of generations) {
      router.prefetch(`/dashboard/ads/generations/${g.id}`);
    }
  }, [generations, router]);

  const startNew = (templateId: string) => {
    setPicker(false);
    router.push(`/dashboard/ads/templates/${templateId}/generate`);
  };

  const deleteGeneration = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this generation?')) return;
    const supabase = createClient();
    await supabase.from('ad_generations').delete().eq('id', id);
    setGenerations((prev) => prev.filter((g) => g.id !== id));
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const templateTitle = (id: string | null) =>
    id ? templates.find((t) => t.id === id)?.title ?? 'Deleted template' : 'Deleted template';

  return (
    <div className={styles.contentBody}>
      <div className={styles.largeTitleBlock}>
        <h1 className={styles.largeTitle}>Generations</h1>
        {templates.length > 0 && (
          <div className={gen.pickerWrap}>
            <button className="btn btn-primary" onClick={() => setPicker((v) => !v)}>
              <Plus size={14} strokeWidth={2.5} /> New
              <ChevronDown size={13} strokeWidth={2} />
            </button>
            {picker && (
              <div className={gen.pickerMenu}>
                <div className={gen.pickerHint}>Pick a template</div>
                {templates.map((t) => (
                  <button
                    key={t.id}
                    className={gen.pickerItem}
                    onClick={() => startNew(t.id)}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {generations.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>
            <Sparkles size={28} strokeWidth={1.5} />
          </div>
          <h2 className={styles.emptyStateTitle}>No generations yet</h2>
          <p className={styles.emptyStateDesc}>
            {templates.length === 0
              ? 'Create a template first, then generate variations from it.'
              : 'Pick a template above to generate your first ad.'}
          </p>
          {templates.length === 0 && (
            <button
              className="btn btn-primary btn-lg"
              onClick={() => router.push('/dashboard/ads/templates')}
            >
              Go to Templates
            </button>
          )}
        </div>
      ) : (
        <div className={styles.questionnaireGrid}>
          {generations.map((g) => (
            <div
              key={g.id}
              className={styles.questionnaireCard}
              onClick={() => router.push(`/dashboard/ads/generations/${g.id}`)}
            >
              <div>
                <h3 className={styles.cardTitle}>{g.title}</h3>
                <div className={styles.cardMeta}>
                  <span>{templateTitle(g.template_id)}</span>
                  <span>·</span>
                  <span>{formatDate(g.updated_at)}</span>
                </div>
              </div>
              <div className={styles.cardActions}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dashboard/ads/generations/${g.id}`);
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={(e) => deleteGeneration(g.id, e)}
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
