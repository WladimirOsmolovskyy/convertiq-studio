'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import type { BranchOperator, Question, QuestionBranch, QuestionType } from '@/lib/types';
import { ArrowDown, ArrowUp, Pencil, Trash2, X } from 'lucide-react';
import styles from '../editor.module.css';

/**
 * Top-down tree graph of the questionnaire flow — the whole logic editor.
 *
 * Predefined geometry (not a free canvas): a spanning tree is laid out top to
 * bottom; a question's answers are ports along its bottom edge, fanning out
 * with curved connectors to child questions spread below it. Positions are
 * derived from the graph each render — nothing is stored.
 *
 * Wiring IS the branch: drag an answer port onto a question to branch to it,
 * onto End to finish, or onto empty space to create a new question and branch
 * to it. Re-dragging a choice answer re-targets its existing branch. Click a
 * connection's pencil to edit its leftover logic or delete it. Question content
 * (titles, options) stays in the Content tab.
 */

const NODE_MIN_W = 156;
const OPT_CELL_W = 66;
const HEADER_H = 34;
const OPT_STRIP_H = 30;
const NODE_H = HEADER_H + OPT_STRIP_H;
const V_GAP = 66;
const H_GAP = 30;
const PAD = 16;
const END_W = 168;
const END_H = 44;
const DRAG_THRESHOLD = 10;

const CHOICE = ['radio', 'checkbox', 'dropdown'];
const trunc = (s: string, n = 30) => (s.length > n ? `${s.slice(0, n)}…` : s);

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
type Port = { key: string; label: string; optionId: string | null; x: number; y: number; draggable: boolean };
type GNode = { id: string; index: number; title: string; type: string; x: number; y: number; w: number; depth: number; ports: Port[] };
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

function curvePath(sx: number, sy: number, tx: number, ty: number, kind: EdgeKind): string {
  if (kind === 'back') {
    const bow = 64 + Math.abs(tx - sx) * 0.12;
    return `M ${sx} ${sy} C ${sx + bow} ${sy} ${tx + bow} ${ty} ${tx} ${ty}`;
  }
  const dy = Math.max(24, Math.abs(ty - sy) * 0.45);
  return `M ${sx} ${sy} C ${sx} ${sy + dy} ${tx} ${ty - dy} ${tx} ${ty}`;
}

type TreeNode = { id: string; depth: number; w: number; x: number; children: TreeNode[] };

function buildLayout(questions: Question[], branches: QuestionBranch[]) {
  const meta = new Map(questions.map((q, index) => [q.id, { q, index }]));
  const branchesByQ = new Map<string, QuestionBranch[]>();
  for (const b of branches) {
    const list = branchesByQ.get(b.question_id) ?? [];
    list.push(b);
    branchesByQ.set(b.question_id, list);
  }
  for (const list of branchesByQ.values()) list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const nodeWidth = (q: Question) => {
    const n = CHOICE.includes(q.type) && q.options.length ? q.options.length : 1;
    return Math.max(NODE_MIN_W, n * OPT_CELL_W);
  };

  // Children of a question = distinct branch targets (in order) then the
  // default next question, deduped. Used to build the spanning tree.
  const childList = (qId: string) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const b of branchesByQ.get(qId) ?? []) {
      if (b.is_end) continue;
      const t = b.target_question_id;
      if (t && meta.has(t) && t !== qId && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    const m = meta.get(qId);
    const nextId = m ? questions[m.index + 1]?.id : undefined;
    if (nextId && !seen.has(nextId)) out.push(nextId);
    return out;
  };

  // Breadth-first so a fork's targets are all claimed as siblings at the next
  // level (depth-first would let the default-next chain steal them into a
  // single vertical line, collapsing the fan-out).
  const placed = new Map<string, TreeNode>();
  const place = (qId: string, depth: number): TreeNode => {
    const tn: TreeNode = { id: qId, depth, w: nodeWidth(meta.get(qId)!.q), x: 0, children: [] };
    placed.set(qId, tn);
    return tn;
  };
  const grow = (root: TreeNode) => {
    const queue: TreeNode[] = [root];
    while (queue.length) {
      const tn = queue.shift()!;
      for (const cId of childList(tn.id)) {
        if (placed.has(cId) || !meta.has(cId)) continue;
        const cn = place(cId, tn.depth + 1);
        tn.children.push(cn);
        queue.push(cn);
      }
    }
  };

  const roots: TreeNode[] = [];
  if (questions[0]) {
    const r = place(questions[0].id, 0);
    roots.push(r);
    grow(r);
  }
  for (const q of questions) {
    if (!placed.has(q.id)) {
      const r = place(q.id, 0);
      roots.push(r);
      grow(r);
    }
  }

  let cursorX = PAD;
  const assignX = (tn: TreeNode) => {
    if (tn.children.length === 0) {
      tn.x = cursorX;
      cursorX += tn.w + H_GAP;
      return;
    }
    for (const c of tn.children) assignX(c);
    const f = tn.children[0];
    const l = tn.children[tn.children.length - 1];
    tn.x = (f.x + l.x + l.w) / 2 - tn.w / 2;
  };
  for (const r of roots) if (r) assignX(r);

  let minX = Infinity;
  for (const tn of placed.values()) minX = Math.min(minX, tn.x);
  const offset = Number.isFinite(minX) && minX < PAD ? PAD - minX : 0;
  const yOf = (depth: number) => PAD + depth * (NODE_H + V_GAP);

  const nodes: GNode[] = [];
  let maxRight = 0;
  let maxDepth = 0;
  for (const [qId, tn] of placed) {
    const m = meta.get(qId)!;
    const q = m.q;
    const isChoice = CHOICE.includes(q.type);
    const opts = isChoice && q.options.length ? q.options : null;
    const n = opts ? opts.length : 1;
    const x = tn.x + offset;
    const y = yOf(tn.depth);
    const ports: Port[] = [];
    for (let k = 0; k < n; k++) {
      const px = x + ((k + 0.5) / n) * tn.w;
      const py = y + NODE_H;
      if (opts) ports.push({ key: opts[k].id, label: opts[k].label, optionId: opts[k].id, x: px, y: py, draggable: true });
      else ports.push({ key: 'answer', label: isChoice ? 'no options' : 'answer', optionId: null, x: px, y: py, draggable: !isChoice });
    }
    nodes.push({ id: qId, index: m.index, title: q.title, type: q.type, x, y, w: tn.w, depth: tn.depth, ports });
    maxRight = Math.max(maxRight, x + tn.w);
    maxDepth = Math.max(maxDepth, tn.depth);
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rootNode = roots[0] ? byId.get(roots[0].id) : undefined;
  const endY = yOf(maxDepth + 1);
  const endX = rootNode ? rootNode.x + rootNode.w / 2 - END_W / 2 : PAD;
  const endTop = { x: endX + END_W / 2, y: endY };

  const edges: GEdge[] = [];

  // Faint default fall-through edges (center bottom → next question, or → End
  // for the last question).
  for (const node of nodes) {
    const sx = node.x + node.w / 2;
    const sy = node.y + NODE_H;
    const nextQ = questions[node.index + 1];
    if (nextQ) {
      const tgt = byId.get(nextQ.id);
      if (!tgt) continue;
      const back = tgt.depth <= node.depth;
      edges.push({
        id: `def-${node.id}`,
        d: curvePath(sx, sy, tgt.x + tgt.w / 2, tgt.y, back ? 'back' : 'default'),
        kind: 'default',
        fromQ: node.id,
        toQ: tgt.id,
      });
    } else {
      edges.push({
        id: `def-${node.id}`,
        d: curvePath(sx, sy, endTop.x, endTop.y, 'default'),
        kind: 'default',
        fromQ: node.id,
        toQ: null,
      });
    }
  }

  // Branch edges from answer ports.
  for (const b of branches) {
    const src = byId.get(b.question_id);
    if (!src) continue;
    const port = b.condition.field === 'option' ? src.ports.find((p) => p.optionId === b.condition.value) : src.ports[0];
    const sx = port ? port.x : src.x + src.w / 2;
    const sy = port ? port.y : src.y + NODE_H;

    let tx: number;
    let ty: number;
    let kind: EdgeKind;
    let toQ: string | null;
    if (b.is_end) {
      tx = endTop.x;
      ty = endTop.y;
      kind = 'end';
      toQ = null;
    } else if (b.target_question_id && byId.has(b.target_question_id)) {
      const tgt = byId.get(b.target_question_id)!;
      tx = tgt.x + tgt.w / 2;
      ty = tgt.y;
      kind = tgt.depth > src.depth ? 'forward' : 'back';
      toQ = tgt.id;
    } else {
      continue;
    }

    edges.push({
      id: b.id,
      d: curvePath(sx, sy, tx, ty, kind),
      kind,
      fromQ: b.question_id,
      toQ,
      mid: { x: (sx + tx) / 2 + (kind === 'back' ? 44 : 0), y: (sy + ty) / 2 },
    });
  }

  return {
    nodes,
    edges,
    endNode: { x: endX, y: endY, w: END_W, h: END_H },
    width: Math.max(maxRight, endX + END_W) + PAD,
    height: endY + END_H + PAD,
  };
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

  const { nodes, edges, endNode, width, height } = useMemo(
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

  const startWire = (e: React.PointerEvent, sourceQuestionId: string, optionId: string | null, fromX: number, fromY: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(null);
    setPending({ sourceQuestionId, optionId, fromX, fromY });
    setCursor({ x: fromX, y: fromY });
  };

  return (
    <div className={`${styles.graphScroll} ${pending ? styles.graphWiring : ''}`}>
      <div className={styles.graphCanvas} ref={canvasRef} style={{ width, height }}>
        <svg className={styles.graphEdges} width={width} height={height} aria-hidden>
          <defs>
            {EDGE_KINDS.map((k) => (
              <marker key={k} id={`gm-${k}`} viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="6" markerHeight="6" orient="auto">
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
              d={`M ${pending.fromX} ${pending.fromY} C ${pending.fromX} ${pending.fromY + 50} ${cursor.x} ${cursor.y - 50} ${cursor.x} ${cursor.y}`}
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
            style={{ left: n.x, top: n.y, width: n.w, height: NODE_H, opacity: isDim(n.id) ? 0.3 : 1 }}
            title={n.title}
          >
            <div className={styles.graphNodeHead} style={{ height: HEADER_H }}>
              <span className={styles.graphNodeNum}>{n.index + 1}</span>
              <span className={styles.graphNodeTitle}>{trunc(n.title, 22)}</span>
            </div>
            <div className={styles.graphOptStrip} style={{ height: OPT_STRIP_H }}>
              {n.ports.map((p) => (
                <div key={p.key} className={styles.graphOptCell} title={p.label}>
                  <span className={styles.graphOptLabel}>{trunc(p.label, 9)}</span>
                  <span
                    className={`${styles.graphPort} ${p.draggable ? '' : styles.graphPortStatic}`}
                    title={p.draggable ? 'Drag to connect' : undefined}
                    onPointerDown={p.draggable ? (e) => startWire(e, n.id, p.optionId, p.x, p.y) : undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div
          data-endnode=""
          className={`${styles.graphEndNode} ${hoverId === '__end__' ? styles.graphNodeDrop : ''}`}
          style={{ left: endNode.x, top: endNode.y, width: endNode.w, height: endNode.h }}
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
