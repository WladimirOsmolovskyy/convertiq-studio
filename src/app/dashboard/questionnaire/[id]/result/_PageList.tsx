'use client';

/**
 * Page list (Pages tab in the left rail). The parent owns the tab strip
 * and search input; this just renders the filtered list + an "Add page"
 * button at the bottom.
 */

import { Flag, Plus, X } from 'lucide-react';
import type { ResultPage } from '@/lib/types';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import styles from './result.module.css';

interface Props {
  pages: ResultPage[];
  selectedPageId: string | null;
  onSelect: (id: string | null) => void;
  /** Substring filter applied to page name (case-insensitive). */
  filter: string;
}

export default function PageList({ pages, selectedPageId, onSelect, filter }: Props) {
  const { addResultPage, removeResultPage } = useQuestionnaireStore();

  const f = filter.trim().toLowerCase();
  const visible = f
    ? pages.filter((p) => p.name.toLowerCase().includes(f))
    : pages;

  const handleAdd = () => {
    addResultPage();
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
    <div className={styles.pageListBody}>
      {pages.length === 0 ? (
        <div className={styles.pageListEmpty}>
          No pages yet. Click + to create one.
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.pageListEmpty}>No pages match &ldquo;{filter}&rdquo;.</div>
      ) : (
        visible.map((page) => {
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
                    if (e.key === 'Enter' || e.key === ' ')
                      handleRemove(e as unknown as React.MouseEvent, page.id);
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

      <button className={styles.addPageBtn} onClick={handleAdd}>
        <Plus size={12} strokeWidth={2.25} /> Add page
      </button>
    </div>
  );
}
