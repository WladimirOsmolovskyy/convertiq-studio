'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import type { Question, QuestionBranch } from '@/lib/types';
import styles from '../editor.module.css';

/**
 * Top-to-bottom node graph of the questionnaire flow, with drag-to-wire.
 *
 * Predefined geometry (not a free canvas): questions are stacked in order, each
 * a node whose answers are ports on the right edge; branches are SVG edges
 * routed through a right-hand gutter. Positions are derived from the graph each
 * render — nothing is stored.
 *
 * Dragging an answer port wires logic: drop on a question = branch to it, drop
 * on the End node = end branch, drop on empty space = create a new question and
 * branch to it. Re-dragging an answer re-targets its existing branch.
 */

const LEFT = 24;
const NODE_W = 248;
const HEADER_H = 38;
const ROW_H = 26;
const PAD_B = 8;
const GAP = 34;
const GUTTER = 176;
const END_H = 46;
const TOP = 8;
const DRAG_THRESHOLD = 10;

const CHOICE = ['radio', 'checkbox', 'dropdown'];
const trunc = (s: string, n = 30) => (s.length > n ? `${s.slice(0, n)}…` : s);

type EdgeKind = 'default' | 'forward' | 'back' | 'end';
type Port = { key: string; label: string; y: number; optionId: string | null };
type GNode = { id: string; index: number; title: string; type: string; y: number; h: number; ports: Port[] };
type GEdge = { id: string; d: string; kind: EdgeKind; fromQ: string; toQ: string | null };
type Pending = { sourceQuestionId: string; optionId: string | null; fromX: number; fromY: number };

const EDGE_CLASS: Record<EdgeKind, string> = {
  default: styles.graphEdgeDefault,
  forward: styles.graphEdgeForward,
  back: styles.graphEdgeBack,
  end: styles.graphEdgeEnd,
};
const ARROW_CLASS: Record<EdgeKind, string> = {
  default: styles.graphArrowDefault,
  forward: styles.graphArrowForward,
  back: styles.graphArrowBack,
  end: styles.graphArrowEnd,
};
const EDGE_KINDS: EdgeKind[] = ['default', 'forward', 'back', 'end'];

function buildLayout(questions: Question[], branches: QuestionBranch[]) {
  const nodes: GNode[] = [];
  let y = TOP;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const isChoice = CHOICE.includes(q.type);
    const hasOpts = isChoice && q.options.length > 0;
    const rowCount = hasOpts ? q.options.length : 1;
    const h = HEADER_H + rowCount * ROW_H + PAD_B;
    const ports: Port[] = [];
    if (hasOpts) {
      q.options.forEach((opt, k) => {
        ports.push({ key: opt.id, label: opt.label, y: y + HEADER_H + k * ROW_H + ROW_H / 2, optionId: opt.id });
      });
    } else {
      ports.push({ key: 'answer', label: isChoice ? 'no options yet' : 'answer', y: y + HEADER_H + ROW_H / 2, optionId: null });
    }
    nodes.push({ id: q.id, index: i, title: q.title, type: q.type, y, h, ports });
    y += h + GAP;
  }

  const endY = y;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const portX = LEFT + NODE_W;
  const centerX = LEFT + NODE_W / 2;
  const endCenterY = endY + END_H / 2;
  const edges: GEdge[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const toY = i < nodes.length - 1 ? nodes[i + 1].y : endY;
    edges.push({
      id: `def-${n.id}`,
      d: `M ${centerX} ${n.y + n.h} L ${centerX} ${toY}`,
      kind: 'default',
      fromQ: n.id,
      toQ: i < nodes.length - 1 ? nodes[i + 1].id : null,
    });
  }

  for (const b of branches) {
    const src = byId.get(b.question_id);
    if (!src) continue;
    let py = src.ports[0]?.y ?? src.y + src.h / 2;
    if (b.condition.field === 'option') {
      const p = src.ports.find((pp) => pp.optionId === b.condition.value);
      if (p) py = p.y;
    }

    let ty: number;
    let kind: EdgeKind;
    let toQ: string | null;
    if (b.is_end) {
      ty = endCenterY;
      kind = 'end';
      toQ = null;
    } else if (b.target_question_id && byId.has(b.target_question_id)) {
      const tgt = byId.get(b.target_question_id)!;
      ty = tgt.y + tgt.h / 2;
      kind = tgt.index > src.index ? 'forward' : 'back';
      toQ = tgt.id;
    } else {
      continue;
    }

    const bow = Math.min(GUTTER - 8, 44 + Math.abs(ty - py) * 0.22);
    edges.push({
      id: b.id,
      d: `M ${portX} ${py} C ${portX + bow} ${py}, ${portX + bow} ${ty}, ${portX} ${ty}`,
      kind,
      fromQ: b.question_id,
      toQ,
    });
  }

  return { nodes, edges, width: LEFT + NODE_W + GUTTER, height: endY + END_H + TOP, endY };
}

export default function FlowGraph({
  questions,
  branches,
  highlightIds,
  onSelectQuestion,
}: {
  questions: Question[];
  branches: QuestionBranch[];
  highlightIds: Set<string> | null;
  onSelectQuestion: (id: string) => void;
}) {
  const connectBranch = useQuestionnaireStore((s) => s.connectBranch);
  const addQuestion = useQuestionnaireStore((s) => s.addQuestion);

  const { nodes, edges, width, height, endY } = useMemo(
    () => buildLayout(questions, branches),
    [questions, branches],
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);

  const isDim = (id: string | null) => !!highlightIds && id != null && !highlightIds.has(id);

  // While a wire is in progress, track the pointer and resolve the drop.
  useEffect(() => {
    if (!pending) return;
    const p = pending;

    const canvasPoint = (e: PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: p.fromX, y: p.fromY };
    };

    const onMove = (e: PointerEvent) => {
      setCursor(canvasPoint(e));
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el?.closest('[data-endnode]')) setHoverId('__end__');
      else {
        const node = el?.closest('[data-qid]');
        const qid = node?.getAttribute('data-qid') ?? null;
        setHoverId(qid && qid !== p.sourceQuestionId ? qid : null);
      }
    };

    const onUp = (e: PointerEvent) => {
      const { x, y } = canvasPoint(e);
      const moved = Math.hypot(x - p.fromX, y - p.fromY) > DRAG_THRESHOLD;
      if (moved) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el?.closest('[data-endnode]')) {
          connectBranch(p.sourceQuestionId, p.optionId, { isEnd: true });
        } else {
          const targetId = el?.closest('[data-qid]')?.getAttribute('data-qid') ?? null;
          if (targetId && targetId !== p.sourceQuestionId) {
            connectBranch(p.sourceQuestionId, p.optionId, { questionId: targetId });
          } else if (!targetId) {
            const newId = addQuestion('radio');
            connectBranch(p.sourceQuestionId, p.optionId, { questionId: newId });
          }
        }
      }
      setPending(null);
      setHoverId(null);
      // Clear after the trailing click so node-click-to-scroll stays suppressed.
      setTimeout(() => {
        draggingRef.current = false;
      }, 0);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPending(null);
        setHoverId(null);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [pending, connectBranch, addQuestion]);

  const startWire = (e: React.PointerEvent, sourceQuestionId: string, optionId: string | null, fromY: number) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    const fromX = LEFT + NODE_W;
    setPending({ sourceQuestionId, optionId, fromX, fromY });
    setCursor({ x: fromX, y: fromY });
  };

  return (
    <div className={`${styles.graphScroll} ${pending ? styles.graphWiring : ''}`}>
      <div className={styles.graphCanvas} ref={canvasRef} style={{ width, height }}>
        <svg className={styles.graphEdges} width={width} height={height} aria-hidden>
          <defs>
            {EDGE_KINDS.map((k) => (
              <marker
                key={k}
                id={`gm-${k}`}
                viewBox="0 0 8 8"
                refX="6.5"
                refY="4"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 z" className={ARROW_CLASS[k]} />
              </marker>
            ))}
          </defs>
          {edges.map((e) => {
            const dim = highlightIds && isDim(e.fromQ) && (e.toQ === null || isDim(e.toQ));
            return (
              <path
                key={e.id}
                d={e.d}
                fill="none"
                className={EDGE_CLASS[e.kind]}
                markerEnd={`url(#gm-${e.kind})`}
                style={dim ? { opacity: 0.12 } : undefined}
              />
            );
          })}
          {pending && (
            <path
              d={`M ${pending.fromX} ${pending.fromY} C ${pending.fromX + 60} ${pending.fromY}, ${cursor.x - 60} ${cursor.y}, ${cursor.x} ${cursor.y}`}
              fill="none"
              className={styles.graphEdgeWiring}
            />
          )}
        </svg>

        {nodes.map((n) => (
          <div
            key={n.id}
            data-qid={n.id}
            className={`${styles.graphNode} ${hoverId === n.id ? styles.graphNodeDrop : ''}`}
            style={{ left: LEFT, top: n.y, width: NODE_W, opacity: isDim(n.id) ? 0.3 : 1 }}
            role="button"
            tabIndex={0}
            title={n.title}
            onClick={() => {
              if (draggingRef.current) return;
              onSelectQuestion(n.id);
            }}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') onSelectQuestion(n.id);
            }}
          >
            <div className={styles.graphNodeHead} style={{ height: HEADER_H }}>
              <span className={styles.graphNodeNum}>{n.index + 1}</span>
              <span className={styles.graphNodeTitle}>{trunc(n.title, 26)}</span>
              <span className={styles.graphNodeType}>{n.type}</span>
            </div>
            {n.ports.map((p) => (
              <div key={p.key} className={styles.graphPortRow} style={{ height: ROW_H }}>
                <span className={styles.graphPortLabel}>{trunc(p.label, 24)}</span>
                <span
                  className={styles.graphPort}
                  title="Drag to connect"
                  onPointerDown={(e) => startWire(e, n.id, p.optionId, p.y)}
                />
              </div>
            ))}
          </div>
        ))}

        <div
          data-endnode=""
          className={`${styles.graphEndNode} ${hoverId === '__end__' ? styles.graphNodeDrop : ''}`}
          style={{ left: LEFT, top: endY, width: NODE_W, height: END_H }}
        >
          Results / End
        </div>
      </div>
    </div>
  );
}
