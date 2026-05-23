'use client';

/**
 * Result pages tab. End-users land on one of these pages after completing
 * the questionnaire — chosen by which page's score range contains their
 * total score.
 *
 * Step 1 scope: list pages, edit name + score range + sort order. Full
 * block authoring (text/image/frame autolayout + variable chips) lands in
 * the next step.
 */

import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { Flag, Plus, X } from 'lucide-react';
import styles from '../editor.module.css';

export default function ResultEditor() {
  const { resultPages, addResultPage, updateResultPage, removeResultPage } = useQuestionnaireStore();

  return (
    <div className={styles.editorPanel}>
      <div style={{ maxWidth: '720px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '-0.018em' }}>Result Pages</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', letterSpacing: '-0.008em' }}>
              Define what end-users see after finishing the questionnaire. The page whose score range contains their total score is shown.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={addResultPage} style={{ flexShrink: 0 }}>
            <Plus size={12} strokeWidth={2.25} /> Add Page
          </button>
        </div>

        {resultPages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-xl)', background: 'var(--fill-quaternary)',
            }}>
              <Flag size={28} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: '0.9375rem', marginBottom: '1rem' }}>
              No result pages yet. Without one, end-users see a generic thank-you screen.
            </p>
            <button className="btn btn-primary btn-sm" onClick={addResultPage}>
              <Plus size={12} strokeWidth={2.25} /> Create first page
            </button>
          </div>
        ) : (
          resultPages.map((page) => (
            <div key={page.id} className={styles.resultCard}>
              <div className={styles.resultRange}>
                <input
                  className="input"
                  value={page.name}
                  onChange={(e) => updateResultPage(page.id, { name: e.target.value })}
                  placeholder="Internal name (e.g. 'High scorers')"
                  style={{ flex: 1, minWidth: '160px' }}
                />
                <button
                  className={styles.removeBtn}
                  onClick={() => removeResultPage(page.id)}
                  aria-label="Remove page"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
              <div className={styles.resultRange}>
                <span className={styles.rangeLabel}>Score from</span>
                <input
                  type="number"
                  className={styles.scoreInput}
                  value={page.min_score}
                  onChange={(e) => updateResultPage(page.id, { min_score: Number(e.target.value) })}
                />
                <span className={styles.rangeLabel}>to</span>
                <input
                  type="number"
                  className={styles.scoreInput}
                  value={page.max_score}
                  onChange={(e) => updateResultPage(page.id, { max_score: Number(e.target.value) })}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>points</span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Block authoring (text, images, layout, variables) — coming next.
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
