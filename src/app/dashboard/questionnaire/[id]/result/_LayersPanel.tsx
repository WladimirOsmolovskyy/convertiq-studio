'use client';

/**
 * Layers panel — tree view of the selected page's node hierarchy.
 *
 * Mirrors the canvas selection: clicking a row selects that node in the
 * inspector, and the canvas highlights it. The panel is where you make
 * structural changes that are hard to do by clicking into the canvas:
 *   - move a node up/down among its siblings
 *   - reparent a node into another frame ("Move to…" dropdown)
 *   - delete a node
 *
 * Indent is purely visual; the source of truth remains the page content
 * tree in the store. Root is rendered but not draggable/deletable.
 */

import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Frame,
  Image as ImageIcon,
  Trash2,
  Type,
} from 'lucide-react';
import type { ResultNode, ResultPage, TextSpan } from '@/lib/types';
import {
  canMoveNode,
  findNode,
  listValidMoveTargets,
  walkTree,
} from '@/lib/resultPage';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import styles from './result.module.css';

interface Props {
  page: ResultPage;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  /** Substring filter on row labels (case-insensitive). */
  filter: string;
}

const INDENT_PX = 14;

export default function LayersPanel({ page, selectedNodeId, onSelectNode, filter }: Props) {
  const {
    moveResultPageNode,
    moveResultPageNodeTo,
    removeResultPageNode,
  } = useQuestionnaireStore();
  const [moveMenuFor, setMoveMenuFor] = useState<string | null>(null);

  const allRows = Array.from(walkTree(page.content));
  const f = filter.trim().toLowerCase();
  const rows = f
    ? allRows.filter(({ node }) =>
        layerLabel(node, node.id === page.content.id).toLowerCase().includes(f),
      )
    : allRows;

  return (
    <div className={styles.layersPanel}>
      <div className={styles.layersBody}>
        {f && rows.length === 0 && (
          <div className={styles.pageListEmpty}>No layers match &ldquo;{filter}&rdquo;.</div>
        )}
        {rows.map(({ node, depth }) => {
          const isRoot = node.id === page.content.id;
          const isSelected = node.id === selectedNodeId;
          const targets = isRoot ? [] : listValidMoveTargets(page.content, node.id);
          return (
            <div
              key={node.id}
              className={`${styles.layerRow} ${isSelected ? styles.layerRowSelected : ''}`}
              style={{ paddingLeft: `${8 + depth * INDENT_PX}px` }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(node.id);
              }}
            >
              <span className={styles.layerIcon} aria-hidden>
                <LayerIcon node={node} />
              </span>
              <span className={styles.layerLabel}>
                {layerLabel(node, isRoot)}
              </span>

              {!isRoot && (
                <span className={styles.layerActions} onClick={(e) => e.stopPropagation()}>
                  <button
                    className={styles.layerActionBtn}
                    onClick={() => moveResultPageNode(page.id, node.id, 'up')}
                    disabled={!canMoveNode(page.content, node.id, 'up')}
                    title="Move up"
                    aria-label="Move up"
                  >
                    <ArrowUp size={11} strokeWidth={2} />
                  </button>
                  <button
                    className={styles.layerActionBtn}
                    onClick={() => moveResultPageNode(page.id, node.id, 'down')}
                    disabled={!canMoveNode(page.content, node.id, 'down')}
                    title="Move down"
                    aria-label="Move down"
                  >
                    <ArrowDown size={11} strokeWidth={2} />
                  </button>

                  {/* Move to frame */}
                  <div style={{ position: 'relative' }}>
                    <button
                      className={styles.layerActionBtn}
                      onClick={() =>
                        setMoveMenuFor((cur) => (cur === node.id ? null : node.id))
                      }
                      disabled={targets.length === 0}
                      title={targets.length === 0 ? 'No other frames to move into' : 'Move to frame'}
                      aria-label="Move to frame"
                    >
                      <ChevronRight size={11} strokeWidth={2} />
                    </button>
                    {moveMenuFor === node.id && (
                      <>
                        <div
                          onClick={() => setMoveMenuFor(null)}
                          style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                        />
                        <div className={styles.moveMenu}>
                          {targets.map((targetId) => {
                            const target = findNode(page.content, targetId);
                            if (!target) return null;
                            return (
                              <button
                                key={targetId}
                                className={styles.moveMenuItem}
                                onClick={() => {
                                  moveResultPageNodeTo(page.id, node.id, targetId);
                                  setMoveMenuFor(null);
                                }}
                              >
                                <Frame size={11} strokeWidth={1.75} />
                                {targetId === page.content.id
                                  ? 'Root frame'
                                  : layerLabel(target, false)}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    className={styles.layerActionBtn}
                    onClick={() => {
                      removeResultPageNode(page.id, node.id);
                      if (selectedNodeId === node.id) onSelectNode(null);
                    }}
                    title="Delete"
                    aria-label="Delete"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Trash2 size={11} strokeWidth={2} />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LayerIcon({ node }: { node: ResultNode }) {
  if (node.type === 'frame') return <Frame size={12} strokeWidth={1.75} />;
  if (node.type === 'text') return <Type size={12} strokeWidth={1.75} />;
  return <ImageIcon size={12} strokeWidth={1.75} />;
}

/** Human-readable row label. Text nodes preview their content with
 *  variable spans surfaced as `[Label]`; frames/images fall back to
 *  their type name. */
function layerLabel(node: ResultNode, isRoot: boolean): string {
  if (node.type === 'frame') return isRoot ? 'Page' : 'Frame';
  if (node.type === 'image') return 'Image';
  return previewSpans(node.spans) || 'Text';
}

function previewSpans(spans: TextSpan[]): string {
  const flat = spans
    .map((s) => (s.type === 'text' ? s.value : `[${s.key}]`))
    .join('')
    .trim();
  return flat.length > 32 ? flat.slice(0, 32) + '…' : flat;
}
