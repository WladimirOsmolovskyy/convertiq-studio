'use client';

/**
 * Layers panel — tree view of the selected page's node hierarchy with
 * full drag-and-drop reordering.
 *
 * Drag semantics:
 *   - Drag any non-root row up/down. Click still selects (drag only
 *     activates after a few px of pointer movement).
 *   - Drop *between* rows: source becomes sibling of the row above
 *     (sibling-after).
 *   - Drop *on* a frame row: source becomes that frame's first child.
 *     This is how you cross parent boundaries by dragging.
 *   - Dropping above the root is rejected — the root row is fixed.
 *
 * Frames drag as a subtree: the source node carries its children with
 * it. Descendants remain visible in their flat positions while a frame
 * is being dragged (no DragOverlay yet) — the final tree update is
 * still correct because we mutate the tree, not the flat list.
 */

import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  findParent,
  listValidMoveTargets,
  walkTree,
} from '@/lib/resultPage';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import styles from './result.module.css';

interface Props {
  page: ResultPage;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  filter: string;
}

const INDENT_PX = 14;

export default function LayersPanel({ page, selectedNodeId, onSelectNode, filter }: Props) {
  const {
    moveResultPageNode,
    moveResultPageNodeTo,
    moveResultPageNodeAt,
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

  // Sortable participates only when no filter is active (the filtered
  // list isn't a contiguous tree slice, so drag semantics don't apply).
  const dragEnabled = !f;
  const sortableRows = rows.filter((r) => r.node.id !== page.content.id);
  const sortableIds = sortableRows.map((r) => r.node.id);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const sourceId = String(active.id);
    const overId = String(over.id);
    if (sourceId === overId) return;

    const oldIdx = sortableIds.indexOf(sourceId);
    const newIdx = sortableIds.indexOf(overId);
    if (oldIdx < 0 || newIdx < 0) return;

    // The new flat order of non-root rows.
    const reordered = arrayMove(sortableIds, oldIdx, newIdx);
    const sourceNewIdx = reordered.indexOf(sourceId);
    const anchorId = sourceNewIdx > 0 ? reordered[sourceNewIdx - 1] : null;

    // No anchor → drop becomes first child of root.
    if (!anchorId) {
      moveResultPageNodeAt(page.id, sourceId, page.content.id, 0);
      return;
    }

    const anchorNode = findNode(page.content, anchorId);
    if (!anchorNode) return;

    // Rule: drop ON a frame → become its first child (this is how you
    // enter a frame via drag). Drop between leaves → sibling-after.
    if (anchorNode.type === 'frame') {
      moveResultPageNodeAt(page.id, sourceId, anchorNode.id, 0);
      return;
    }

    // Sibling-after: insert into anchor's parent at (anchor.index + 1),
    // measured in the after-detach children list (matches the helper).
    const parent = findParent(page.content, anchorNode.id);
    if (!parent) return;
    const sourceParent = findParent(page.content, sourceId);
    const sameParent = sourceParent?.id === parent.id;
    const anchorIdxInParent = parent.children.findIndex((c) => c.id === anchorNode.id);
    let targetIndex = anchorIdxInParent + 1;
    // If source is a sibling of anchor and sits before it, detaching
    // shifts anchor's index down by one — compensate.
    if (sameParent) {
      const sourceIdxInParent = parent.children.findIndex((c) => c.id === sourceId);
      if (sourceIdxInParent >= 0 && sourceIdxInParent < anchorIdxInParent) {
        targetIndex -= 1;
      }
    }
    moveResultPageNodeAt(page.id, sourceId, parent.id, targetIndex);
  };

  return (
    <div className={styles.layersPanel}>
      <div className={styles.layersBody}>
        {f && rows.length === 0 && (
          <div className={styles.pageListEmpty}>No layers match &ldquo;{filter}&rdquo;.</div>
        )}

        {/* Root row is fixed (not draggable). */}
        {rows.length > 0 && rows[0].node.id === page.content.id && (
          <LayerRowInner
            page={page}
            row={rows[0]}
            isRoot
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            moveMenuFor={moveMenuFor}
            setMoveMenuFor={setMoveMenuFor}
            moveResultPageNode={moveResultPageNode}
            moveResultPageNodeTo={moveResultPageNodeTo}
            removeResultPageNode={removeResultPageNode}
          />
        )}

        {dragEnabled ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {sortableRows.map((row) => (
                <SortableLayerRow
                  key={row.node.id}
                  page={page}
                  row={row}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={onSelectNode}
                  moveMenuFor={moveMenuFor}
                  setMoveMenuFor={setMoveMenuFor}
                  moveResultPageNode={moveResultPageNode}
                  moveResultPageNodeTo={moveResultPageNodeTo}
                  removeResultPageNode={removeResultPageNode}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          sortableRows.map((row) => (
            <LayerRowInner
              key={row.node.id}
              page={page}
              row={row}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              moveMenuFor={moveMenuFor}
              setMoveMenuFor={setMoveMenuFor}
              moveResultPageNode={moveResultPageNode}
              moveResultPageNodeTo={moveResultPageNodeTo}
              removeResultPageNode={removeResultPageNode}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Sortable wrapper ───────────────────────────────────────────── */

type RowProps = {
  page: ResultPage;
  row: { node: ResultNode; depth: number };
  isRoot?: boolean;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  moveMenuFor: string | null;
  setMoveMenuFor: (id: string | null) => void;
  moveResultPageNode: (pageId: string, nodeId: string, direction: 'up' | 'down') => void;
  moveResultPageNodeTo: (pageId: string, nodeId: string, parentNodeId: string) => void;
  removeResultPageNode: (pageId: string, nodeId: string) => void;
};

function SortableLayerRow(props: RowProps) {
  const { node } = props.row;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: node.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isOver && node.type === 'frame' ? styles.layerRowDropFrame : undefined}
    >
      <LayerRowInner {...props} />
    </div>
  );
}

function LayerRowInner({
  page,
  row,
  isRoot,
  selectedNodeId,
  onSelectNode,
  moveMenuFor,
  setMoveMenuFor,
  moveResultPageNode,
  moveResultPageNodeTo,
  removeResultPageNode,
}: RowProps) {
  const { node, depth } = row;
  const isSelected = node.id === selectedNodeId;
  const targets = isRoot ? [] : listValidMoveTargets(page.content, node.id);

  return (
    <div
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
      <span className={styles.layerLabel}>{layerLabel(node, !!isRoot)}</span>

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

          <div style={{ position: 'relative' }}>
            <button
              className={styles.layerActionBtn}
              onClick={() => setMoveMenuFor(moveMenuFor === node.id ? null : node.id)}
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
                        {targetId === page.content.id ? 'Root frame' : layerLabel(target, false)}
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
}

function LayerIcon({ node }: { node: ResultNode }) {
  if (node.type === 'frame') return <Frame size={12} strokeWidth={1.75} />;
  if (node.type === 'text') return <Type size={12} strokeWidth={1.75} />;
  return <ImageIcon size={12} strokeWidth={1.75} />;
}

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
