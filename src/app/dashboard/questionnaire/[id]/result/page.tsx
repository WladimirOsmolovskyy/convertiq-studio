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

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import LeftRail from './_LeftRail';
import Canvas from './_Canvas';
import Inspector from './_Inspector';
import { useResize } from './_useResize';
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

  // Delete the selected block on Delete/Backspace — wherever it was selected
  // (canvas or layers panel). Bails while typing in a field, and never deletes
  // the root frame.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!selectedNodeId || !selectedPageId) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      const { resultPages: pages, removeResultPageNode } = useQuestionnaireStore.getState();
      const pg = pages.find((p) => p.id === selectedPageId);
      if (!pg || selectedNodeId === pg.content.id) return; // missing, or root frame
      e.preventDefault();
      removeResultPageNode(selectedPageId, selectedNodeId);
      setSelectedNodeId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId, selectedPageId]);

  // Persisted, drag-resizable rail widths. Stored per-user in localStorage
  // so they survive reloads but stay scoped to this editor.
  const leftRail = useResize({
    initial: 240,
    min: 180,
    max: 420,
    direction: 1,
    storageKey: 'cq.result.leftWidth',
  });
  const rightRail = useResize({
    initial: 320,
    min: 240,
    max: 520,
    direction: -1,
    storageKey: 'cq.result.rightWidth',
  });

  const gridStyle = {
    gridTemplateColumns: `${leftRail.width}px 1fr ${rightRail.width}px`,
  } as CSSProperties;

  return (
    <div className={styles.editor} style={gridStyle}>
      <div className={styles.railWrap}>
        <LeftRail
          pages={resultPages}
          selectedPage={selectedPage}
          selectedPageId={selectedPageId}
          selectedNodeId={selectedNodeId}
          onSelectPage={handleSelectPage}
          onSelectNode={setSelectedNodeId}
        />
        <div
          className={styles.resizeHandleRight}
          onMouseDown={leftRail.onMouseDown}
          aria-hidden
        />
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

      <div className={styles.railWrap}>
        <div
          className={styles.resizeHandleLeft}
          onMouseDown={rightRail.onMouseDown}
          aria-hidden
        />
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
    </div>
  );
}
