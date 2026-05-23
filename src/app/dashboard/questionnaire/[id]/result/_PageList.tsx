'use client';

/**
 * Left rail of the Result editor. Lists every result page with its
 * score range; clicking selects it for editing. Add/remove lives here.
 *
 * Selection is owned by the parent (result/page.tsx) and passed in.
 */

import { Flag, Plus, X } from 'lucide-react';
import type { ResultPage } from '@/lib/types';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import styles from './result.module.css';

interface Props {
  pages: ResultPage[];
  selectedPageId: string | null;
  onSelect: (id: string | null) => void;
}

export default function PageList({ pages, selectedPageId, onSelect }: Props) {
  const { addResultPage, removeResultPage } = useQuestionnaireStore();

  const handleAdd = () => {
    addResultPage();
    // Select the page that was just appended — it's the last one after add.
    const fresh = useQuestionnaireStore.getState().resultPages;
    const newest = fresh[fresh.length - 1];
    if (newest) onSelect(newest.id);
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeResultPage(id);
    if (selectedPageId === id) onSelect(null);
  };

  return (
    <div className={styles.pageList}>
      <div className={styles.pageListHeader}>
        <h3>Result Pages</h3>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={handleAdd} aria-label="Add page" title="Add page">
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>
      <div className={styles.pageListBody}>
        {pages.length === 0 ? (
          <div className={styles.pageListEmpty}>
            No pages yet. Click + to create one.
          </div>
        ) : (
          pages.map((page) => {
            const isActive = page.id === selectedPageId;
            return (
              <button
                key={page.id}
                className={`${styles.pageListItem} ${isActive ? styles.pageListItemActive : ''}`}
                onClick={() => onSelect(page.id)}
              >
                <span className={styles.pageListItemName}>
                  <Flag size={12} strokeWidth={1.75} aria-hidden />
                  {page.name || 'Untitled'}
                  <span style={{ flex: 1 }} />
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleRemove(e, page.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleRemove(e as unknown as React.MouseEvent, page.id);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    aria-label="Remove page"
                  >
                    <X size={12} strokeWidth={2} />
                  </span>
                </span>
                <span className={styles.pageListItemRange}>
                  {page.min_score}–{page.max_score} pts
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
