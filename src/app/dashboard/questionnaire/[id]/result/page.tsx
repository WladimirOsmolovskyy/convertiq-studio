'use client';

/**
 * Result tab shell. Three columns:
 *   - left:   page list (selects which result page to edit)
 *   - center: live canvas with click-to-select + add-block toolbar
 *   - right:  inspector (page or node properties, plus variable reference)
 *
 * Selection state is local to this shell. Page content + score-range
 * metadata lives in the Zustand store, picked up by the canvas/inspector.
 */

import { useMemo, useState } from 'react';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import PageList from './_PageList';
import LayersPanel from './_LayersPanel';
import Canvas from './_Canvas';
import Inspector from './_Inspector';
import styles from './result.module.css';

export default function ResultEditor() {
  const { resultPages } = useQuestionnaireStore();
  // The user's explicit selection. May be stale (page deleted) — we never
  // mutate it from an effect; instead the effective id is derived below.
  const [explicitSelectedPageId, setExplicitSelectedPageId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Effective selection: honor the explicit pick if it still exists,
  // otherwise default to the first page (or null when the list is empty).
  const selectedPageId = useMemo(() => {
    if (explicitSelectedPageId && resultPages.some((p) => p.id === explicitSelectedPageId)) {
      return explicitSelectedPageId;
    }
    return resultPages[0]?.id ?? null;
  }, [explicitSelectedPageId, resultPages]);

  const selectedPage = useMemo(
    () => resultPages.find((p) => p.id === selectedPageId) ?? null,
    [resultPages, selectedPageId],
  );

  const handleSelectPage = (id: string | null) => {
    setExplicitSelectedPageId(id);
    setSelectedNodeId(null);
  };

  return (
    <div className={styles.editor}>
      <div className={styles.leftRail}>
        <PageList
          pages={resultPages}
          selectedPageId={selectedPageId}
          onSelect={handleSelectPage}
        />
        {selectedPage && (
          <LayersPanel
            page={selectedPage}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        )}
      </div>

      {selectedPage ? (
        <Canvas
          page={selectedPage}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
      ) : (
        <div className={styles.canvas}>
          <div className={styles.canvasEmpty}>
            {resultPages.length === 0
              ? 'Create a result page from the left rail to start designing.'
              : 'Select a page to edit.'}
          </div>
        </div>
      )}

      {selectedPage ? (
        <Inspector page={selectedPage} selectedNodeId={selectedNodeId} />
      ) : (
        <aside className={styles.inspector}>
          <div className={styles.inspectorEmpty}>
            Properties will appear here once you select a page.
          </div>
        </aside>
      )}
    </div>
  );
}
