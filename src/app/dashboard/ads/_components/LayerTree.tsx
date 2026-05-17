'use client';

import { ChevronRight, Frame as FrameIcon, Type, Square, Image as ImageIcon, MousePointer2, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { useEditorStore } from '../_store/editor';
import type { SceneNode } from '../_model/nodes';
import styles from '../ads.module.css';

export default function LayerTree() {
  const doc = useEditorStore((s) => s.doc);
  return (
    <div className={styles.panelScroll}>
      <div className={styles.panelSectionTitle}>Layers</div>
      <div className={styles.layerTree}>
        <Row node={doc.root} depth={0} />
      </div>
    </div>
  );
}

function Row({ node, depth }: { node: SceneNode; depth: number }) {
  const selectedId = useEditorStore((s) => s.selectedId);
  const setSelected = useEditorStore((s) => s.setSelected);
  const expanded = useEditorStore((s) => s.expanded);
  const toggleExpanded = useEditorStore((s) => s.toggleExpanded);
  const editNode = useEditorStore((s) => s.editNode);

  const isFrame = node.type === 'frame';
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  const Icon = isFrame
    ? FrameIcon
    : node.type === 'text'
    ? Type
    : node.type === 'shape'
    ? Square
    : node.type === 'image'
    ? ImageIcon
    : MousePointer2;

  return (
    <>
      <div
        className={`${styles.layerRow} ${isSelected ? styles.layerRowActive : ''}`}
        style={{ paddingLeft: 6 + depth * 12 }}
        onClick={() => setSelected(node.id)}
      >
        {isFrame ? (
          <button
            className={styles.layerChevron}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(node.id);
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <ChevronRight size={12} strokeWidth={2} />
          </button>
        ) : (
          <span className={styles.layerChevronSpacer} />
        )}
        <span className={styles.layerIcon}>
          <Icon size={13} strokeWidth={1.75} />
        </span>
        <span className={styles.layerLabel}>{node.name}</span>
        <button
          className={styles.layerEye}
          onClick={(e) => {
            e.stopPropagation();
            editNode(node.id, (n) => {
              n.visible = !n.visible;
            });
          }}
          aria-label={node.visible ? 'Hide' : 'Show'}
        >
          {node.visible ? <Eye size={12} strokeWidth={1.75} /> : <EyeOff size={12} strokeWidth={1.75} />}
        </button>
        <button
          className={styles.layerEye}
          onClick={(e) => {
            e.stopPropagation();
            editNode(node.id, (n) => {
              n.locked = !n.locked;
            });
          }}
          aria-label={node.locked ? 'Unlock' : 'Lock'}
        >
          {node.locked ? <Lock size={12} strokeWidth={1.75} /> : <Unlock size={12} strokeWidth={1.75} />}
        </button>
      </div>
      {isFrame && isExpanded && node.children.map((c) => <Row key={c.id} node={c} depth={depth + 1} />)}
    </>
  );
}
