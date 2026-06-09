'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import type { BranchOperator, Question, QuestionBranch, QuestionType } from '@/lib/types';
import { ArrowDown, ArrowUp, Pencil, Trash2, X } from 'lucide-react';
import styles from '../editor.module.css';

/**
 * Top-to-bottom node graph of the questionnaire flow — the whole logic editor.
 *
 * Predefined geometry (not a free canvas): questions are stacked in order, each
 * a node whose answers are ports on the right edge; branches are SVG edges
 * routed through a right-hand gutter. Positions are derived from the graph each
 * render — nothing is stored.
 *
 * Wiring IS the branch: drag an answer port onto a question to branch to it,
 * onto End to finish, or onto empty space to create a new question and branch
 * to it. Re-dragging a choice answer re-targets its existing branch. Click a
 * connection's pencil to edit the leftover logic (open-question condition,
 * audience tag, precedence) or delete it. Question content stays in the
 * Content tab.
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

/** Operators offered per question type — only those the runtime honors. */
function operatorOptions(type: QuestionType): { value: BranchOperator; label: string }[] {
  if (CHOICE.includes(type)) {
    return [
      { value: 'equals', label: 'is' },
      { value: 'not_equals', label: 'is not' },
    ];
  }
  if (type === 'number' || type === 'rating') {
    return [
      { value: 'equals', label: 'equals' },
      { value: 'not_equals', label: 'does not equal' },
      { value: 'greater_than', label: 'greater than' },
      { value: 'less_than', label: 'less than' },
    ];
  }
  return [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
  ];
}

type EdgeKind = 'default' | 'forward' | 'back' | 'end';
type Port = { key: string; label: string; y: number; optionId: string | null; draggable: boolean };
type GNode = { id: string; index: number; title: string; type: string; y: number; h: number; ports: Port[] };
type GEdge = { id: string; d: string; kind: EdgeKind; fromQ: string; toQ: string | null; mid?: { x: number; y: number } };
type Pending = { sourceQuestionId: string; optionId: string | null; fromX: number; fromY: number };
type Selected = { branchId: string; x: number; y: number };

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
        ports.push({ key: opt.id, label: opt.label, y: y + HEADER_H + k * ROW_H + ROW_H / 2, optionId: opt.id, draggable: true });
      });
    } else {
      ports.push({
        key: 'answer',
        label: isChoice ? 'no options yet' : 'answer',
        y: y + HEADER_H + ROW_H / 2,
        optionId: null,
        draggable: !isChoice,
      });
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
      mid: { x: portX + bow * 0.62, y: (py + ty) / 2 },
    });
  }

  return { nodes, edges, width: LEFT + NODE_W + GUTTER, height: endY + END_H + TOP, endY };
}

export default function FlowGraph({
  questions,
  branches,
  highlightIds,
}: {
  questions: Question[];
  branches: QuestionBranch[];
  highlightIds: Set<string> | null;
}) {
  const connectBranch = useQuestionnaireStore((s) => s.connectBranch);
  const addQuestion = useQuestionnaireStore((s) => s.addQuestion);

  const { nodes, edges, width, height, endY } = useMemo(
    () => buildLayout(questions, branches),
    [questions, branches],
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);

  const isDim = (id: string | null) => !!highlightIds && id != null && !highlightIds.has(id);
  const selectedBranch = selected ? branches.find((b) => b.id === selected.branchId) ?? null : null;

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
      if (Math.hypot(x - p.fromX, y - p.fromY) > DRAG_THRESHOLD) {
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
    setSelected(null);
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
                className={`${EDGE_CLASS[e.kind]} ${selected?.branchId === e.id ? styles.graphEdgeSelected : ''}`}
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
            title={n.title}
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
                  className={`${styles.graphPort} ${p.draggable ? '' : styles.graphPortStatic}`}
                  title={p.draggable ? 'Drag to connect' : undefined}
                  onPointerDown={p.draggable ? (e) => startWire(e, n.id, p.optionId, p.y) : undefined}
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

        {!pending &&
          edges
            .filter((e) => e.kind !== 'default' && e.mid)
            .map((e) => (
              <button
                key={`edit-${e.id}`}
                type="button"
                className={styles.graphEdgeBtn}
                style={{ left: e.mid!.x, top: e.mid!.y }}
                title="Edit connection"
                onClick={(ev) => setSelected({ branchId: e.id, x: ev.clientX, y: ev.clientY })}
              >
                <Pencil size={11} strokeWidth={2} />
              </button>
            ))}
      </div>

      {selected && selectedBranch && (
        <EdgeInspector
          branch={selectedBranch}
          questions={questions}
          branches={branches}
          x={selected.x}
          y={selected.y}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ─── Edge inspector (logic editing for a selected branch) ───────── */

function EdgeInspector({
  branch,
  questions,
  branches,
  x,
  y,
  onClose,
}: {
  branch: QuestionBranch;
  questions: Question[];
  branches: QuestionBranch[];
  x: number;
  y: number;
  onClose: () => void;
}) {
  const audiences = useQuestionnaireStore((s) => s.audiences);
  const updateBranch = useQuestionnaireStore((s) => s.updateBranch);
  const removeBranch = useQuestionnaireStore((s) => s.removeBranch);
  const reorderBranches = useQuestionnaireStore((s) => s.reorderBranches);

  const question = questions.find((q) => q.id === branch.question_id);
  if (!question) return null;

  const isChoice = CHOICE.includes(question.type);
  const siblings = branches
    .filter((b) => b.question_id === question.id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const pos = siblings.findIndex((b) => b.id === branch.id);

  const targetValue = branch.is_end ? '__end__' : branch.target_question_id ?? '';
  const onTarget = (v: string) => {
    if (v === '__end__') updateBranch(branch.id, { is_end: true, target_question_id: null });
    else updateBranch(branch.id, { is_end: false, target_question_id: v });
  };

  const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 280);
  const top = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 9999) - 240);

  return (
    <>
      <div className={styles.edgePopBackdrop} onClick={onClose} />
      <div className={styles.edgePop} style={{ left, top }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.edgePopHead}>
          <span className={styles.edgePopTitle}>Q{questions.indexOf(question) + 1} branch</span>
          <button className={styles.edgePopClose} onClick={onClose} aria-label="Close">
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {isChoice ? (
          <div className={styles.edgePopCondition}>
            if answer is{' '}
            <strong>{question.options.find((o) => o.id === branch.condition.value)?.label ?? '—'}</strong>
          </div>
        ) : (
          <div className={styles.edgePopRow}>
            <span className={styles.edgePopLabel}>if answer</span>
            <select
              className={styles.branchSelect}
              value={branch.condition.operator}
              onChange={(e) =>
                updateBranch(branch.id, {
                  condition: { ...branch.condition, field: 'value', operator: e.target.value as BranchOperator },
                })
              }
            >
              {operatorOptions(question.type).map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            <input
              className={styles.branchSelect}
              value={branch.condition.value}
              onChange={(e) =>
                updateBranch(branch.id, {
                  condition: { ...branch.condition, field: 'value', value: e.target.value },
                })
              }
              placeholder={question.type === 'number' || question.type === 'rating' ? 'Number…' : 'Value…'}
              style={{ flex: 1, minWidth: 60 }}
            />
          </div>
        )}

        <div className={styles.edgePopRow}>
          <span className={styles.edgePopLabel}>go to</span>
          <select className={styles.branchSelect} value={targetValue} onChange={(e) => onTarget(e.target.value)} style={{ flex: 1 }}>
            {questions
              .filter((tq) => tq.id !== question.id)
              .map((tq) => (
                <option key={tq.id} value={tq.id}>
                  Q{questions.indexOf(tq) + 1}: {trunc(tq.title, 22)}
                </option>
              ))}
            <option value="__end__">End questionnaire</option>
          </select>
        </div>

        {audiences.length > 0 && (
          <div className={styles.edgePopRow}>
            <span className={styles.edgePopLabel}>tag as</span>
            <select
              className={styles.branchSelect}
              value={branch.assign_audience_id ?? ''}
              onChange={(e) => updateBranch(branch.id, { assign_audience_id: e.target.value || null })}
              style={{ flex: 1 }}
            >
              <option value="">— no tag —</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.edgePopFooter}>
          {siblings.length > 1 && (
            <div className={styles.edgePopOrder}>
              <button
                className={styles.edgePopIconBtn}
                disabled={pos <= 0}
                onClick={() => reorderBranches(question.id, pos, pos - 1)}
                title="Higher priority"
                aria-label="Higher priority"
              >
                <ArrowUp size={13} strokeWidth={2} />
              </button>
              <span className={styles.edgePopOrderText}>
                {pos + 1}/{siblings.length}
              </span>
              <button
                className={styles.edgePopIconBtn}
                disabled={pos >= siblings.length - 1}
                onClick={() => reorderBranches(question.id, pos, pos + 1)}
                title="Lower priority"
                aria-label="Lower priority"
              >
                <ArrowDown size={13} strokeWidth={2} />
              </button>
            </div>
          )}
          <button
            className={styles.edgePopDelete}
            onClick={() => {
              removeBranch(branch.id);
              onClose();
            }}
          >
            <Trash2 size={13} strokeWidth={2} /> Delete
          </button>
        </div>
      </div>
    </>
  );
}
