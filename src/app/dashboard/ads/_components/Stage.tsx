'use client';

import { useEffect, useMemo, useRef, useState, useLayoutEffect, type MutableRefObject } from 'react';
import { Stage as KStage, Layer, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useEditorStore } from '../_store/editor';
import { computeLayout } from '../_model/autolayout';
import NodeRenderer from './Renderer';
import InlineTextEditor from './InlineTextEditor';
import styles from '../ads.module.css';

const PADDING = 48;

interface Props {
  stageRef: MutableRefObject<Konva.Stage | null>;
}

export default function EditorStage({ stageRef }: Props) {
  const doc = useEditorStore((s) => s.doc);
  const selectedId = useEditorStore((s) => s.selectedId);
  const setSelected = useEditorStore((s) => s.setSelected);
  const editNode = useEditorStore((s) => s.editNode);

  const containerRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Track viewport size
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = useMemo(() => {
    const fitX = (containerSize.width - PADDING * 2) / doc.size.width;
    const fitY = (containerSize.height - PADDING * 2) / doc.size.height;
    return Math.max(0.05, Math.min(fitX, fitY, 1));
  }, [containerSize, doc.size]);

  // Compute layouts once per doc change.
  const layouts = useMemo(() => computeLayout(doc.root), [doc]);

  // Wire transformer to selected node.
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (!selectedId || selectedId === doc.root.id) {
      tr.nodes([]);
    } else {
      const node = stage.findOne(`#${selectedId}`);
      if (node) {
        tr.nodes([node]);
      } else {
        tr.nodes([]);
      }
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, doc, layouts]);

  // Background click clears selection
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      setSelected(null);
    }
  };

  // Drag finalize — child's local x/y inside its Konva parent is also its transform.x/y
  // for free-positioned children (which is the only case where canDrag is true).
  const handleDragEnd = (id: string, lx: number, ly: number) => {
    editNode(id, (n) => {
      // If the node has stretch constraints, the layout pass overrides position anyway;
      // store the raw local coords so users have a stable value if they remove the constraint.
      n.transform.x = lx;
      n.transform.y = ly;
    });
  };

  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const id = e.target.id();
    if (!id) return;
    // Find node, only enter text edit if it's a text node
    const find = (node: typeof doc.root | typeof doc.root.children[number]): typeof doc.root.children[number] | null => {
      if (node.id === id) return node as typeof doc.root.children[number];
      if (node.type !== 'frame') return null;
      for (const c of node.children) {
        const f = find(c);
        if (f) return f;
      }
      return null;
    };
    const n = find(doc.root);
    if (n?.type === 'text') {
      setEditingTextId(id);
    }
  };

  const editingTextNode = useMemo(() => {
    if (!editingTextId) return null;
    const find = (node: typeof doc.root | typeof doc.root.children[number]): typeof doc.root.children[number] | null => {
      if (node.id === editingTextId) return node as typeof doc.root.children[number];
      if (node.type !== 'frame') return null;
      for (const c of node.children) {
        const f = find(c);
        if (f) return f;
      }
      return null;
    };
    return find(doc.root);
  }, [editingTextId, doc]);

  return (
    <div ref={containerRef} className={styles.canvasArea}>
      <div
        className={styles.canvasViewport}
        style={{
          width: doc.size.width * scale,
          height: doc.size.height * scale,
        }}
      >
        <KStage
          ref={stageRef}
          width={doc.size.width * scale}
          height={doc.size.height * scale}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={handleStageClick}
          onDblClick={handleDblClick}
          onDblTap={handleDblClick}
        >
          <Layer>
            <NodeRenderer
              node={doc.root}
              layouts={layouts}
              onSelect={(id) => setSelected(id)}
              onDragEnd={handleDragEnd}
              hiddenIds={editingTextId ? new Set([editingTextId]) : undefined}
              canDrag={false}
            />
          </Layer>
          <Layer>
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              anchorSize={8}
              anchorStroke="#007aff"
              anchorFill="#ffffff"
              borderStroke="#007aff"
              borderStrokeWidth={1}
              ignoreStroke
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
              onTransformEnd={(e) => {
                const id = e.target.id();
                if (!id) return;
                const scaleX = e.target.scaleX();
                const scaleY = e.target.scaleY();
                e.target.scaleX(1);
                e.target.scaleY(1);
                editNode(id, (n) => {
                  n.transform.width = Math.max(1, n.transform.width * scaleX);
                  n.transform.height = Math.max(1, n.transform.height * scaleY);
                });
              }}
            />
          </Layer>
        </KStage>
        {editingTextNode && editingTextNode.type === 'text' && (
          <InlineTextEditor
            node={editingTextNode}
            layout={layouts.get(editingTextNode.id)!}
            scale={scale}
            onCommit={(text) => {
              editNode(editingTextNode.id, (n) => {
                if (n.type === 'text') n.text = text;
              });
              setEditingTextId(null);
            }}
            onCancel={() => setEditingTextId(null)}
          />
        )}
      </div>
      <div className={styles.canvasScaleHint}>{Math.round(scale * 100)}%</div>
    </div>
  );
}
