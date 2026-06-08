'use client';

import { useMemo } from 'react';
import type { Question, QuestionBranch } from '@/lib/types';
import styles from '../editor.module.css';

/**
 * Read-only, top-to-bottom node graph of the questionnaire flow.
 *
 * Predefined geometry (not a free canvas): questions are stacked in order, each
 * a node whose answers are ports on the right edge; branches are SVG edges
 * routed through a right-hand gutter. Positions are derived from the graph each
 * render — nothing is stored. This is the visual foundation; drag-to-connect
 * and drag-to-create land in a later phase.
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

const CHOICE = ['radio', 'checkbox', 'dropdown'];
const trunc = (s: string, n = 30) => (s.length > n ? `${s.slice(0, n)}…` : s);

type EdgeKind = 'default' | 'forward' | 'back' | 'end';
type Port = { key: string; label: string; y: number; optionId: string | null };
type GNode = { id: string; index: number; title: string; type: string; y: number; h: number; ports: Port[] };
type GEdge = { id: string; d: string; kind: EdgeKind; fromQ: string; toQ: string | null };

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

  // Faint default (fall-through) edges down the spine.
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

  // Branch edges, routed through the right gutter.
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
  const { nodes, edges, width, height, endY } = useMemo(
    () => buildLayout(questions, branches),
    [questions, branches],
  );

  const isDim = (id: string | null) => !!highlightIds && id != null && !highlightIds.has(id);

  return (
    <div className={styles.graphScroll}>
      <div className={styles.graphCanvas} style={{ width, height }}>
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
        </svg>

        {nodes.map((n) => (
          <div
            key={n.id}
            className={styles.graphNode}
            style={{ left: LEFT, top: n.y, width: NODE_W, opacity: isDim(n.id) ? 0.3 : 1 }}
            role="button"
            tabIndex={0}
            title={n.title}
            onClick={() => onSelectQuestion(n.id)}
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
                <span className={styles.graphPort} aria-hidden />
              </div>
            ))}
          </div>
        ))}

        <div
          className={styles.graphEndNode}
          style={{ left: LEFT, top: endY, width: NODE_W, height: END_H }}
        >
          Results / End
        </div>
      </div>
    </div>
  );
}
