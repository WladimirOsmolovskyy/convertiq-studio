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
const DEF_PORT_DY = 12; // grey default port sits this far below the card bottom
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
type GNode = {
  id: string;
  index: number;
  title: string;
  type: string;
  x: number;
  y: number;
  w: number;
  depth: number;
  ports: Port[];
  parentId: string | null;
  reorderable: boolean;
};
type CardDrag = { qId: string; parentId: string; startX: number };
type GEdge = { id: string; d: string; kind: EdgeKind; fromQ: string; toQ: string | null; mid?: { x: number; y: number } };
type Pending = { sourceQuestionId: string; optionId: string | null; fromX: number; fromY: number; isDefault?: boolean };
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

// While a card is dragged horizontally, repack its reorderable siblings into
// the same row (same start, same uniform gap) in the proposed order; the
// dragged card itself follows the cursor.
function siblingPreview(nodes: GNode[], qId: string, parentId: string, dx: number) {
  const sibs = nodes.filter((n) => n.reorderable && n.parentId === parentId).sort((a, b) => a.x - b.x);
  const dragged = sibs.find((n) => n.id === qId);
  if (!dragged || sibs.length < 2) return null;
  const center = dragged.x + dx + dragged.w / 2;
  const order = sibs.filter((n) => n.id !== qId);
  let slot = 0;
  for (const s of order) if (s.x + s.w / 2 < center) slot++;
  order.splice(slot, 0, dragged);
  const gap = sibs[1].x - (sibs[0].x + sibs[0].w);
  const xs = new Map<string, number>();
  let x = sibs[0].x;
  for (const s of order) {
    xs.set(s.id, s.id === qId ? dragged.x + dx : x);
    x += s.w + gap;
  }
  return { order: order.map((s) => s.id), original: sibs.map((s) => s.id), xs };
}

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

  // The question's default child: the default branch's target when set (and not
  // ending), else the next question by order. Drives both the spanning tree and
  // the grey edge so they always agree with runtime fall-through.
  const defaultTargetId = (qId: string) => {
    const def = (branchesByQ.get(qId) ?? []).find((b) => b.is_default);
    if (def) {
      if (def.is_end) return undefined;
      if (def.target_question_id && meta.has(def.target_question_id) && def.target_question_id !== qId) {
        return def.target_question_id;
      }
      // Default set but target invalid → fall back to order.
    }
    const m = meta.get(qId);
    return m ? questions[m.index + 1]?.id : undefined;
  };

  // Children of a question = distinct conditional branch targets (in order) then
  // the default child, deduped. Used to build the spanning tree.
  const childList = (qId: string) => {
    const seen = new Set<string>();
    const out: { id: string; viaBranch: boolean }[] = [];
    for (const b of branchesByQ.get(qId) ?? []) {
      if (b.is_end || b.is_default) continue;
      const t = b.target_question_id;
      if (t && meta.has(t) && t !== qId && !seen.has(t)) {
        seen.add(t);
        out.push({ id: t, viaBranch: true });
      }
    }
    const defId = defaultTargetId(qId);
    if (defId && !seen.has(defId)) out.push({ id: defId, viaBranch: false });
    return out;
  };

  // Breadth-first so a fork's targets are all claimed as siblings at the next
  // level (depth-first would let the default-next chain steal them into a
  // single vertical line, collapsing the fan-out).
  const placed = new Map<string, TreeNode>();
  const parentOf = new Map<string, string>();
  const branchChildren = new Set<string>();
  const branchKidCount = new Map<string, number>();
  const place = (qId: string, depth: number): TreeNode => {
    const tn: TreeNode = { id: qId, depth, w: nodeWidth(meta.get(qId)!.q), x: 0, children: [] };
    placed.set(qId, tn);
    return tn;
  };
  const grow = (root: TreeNode) => {
    const queue: TreeNode[] = [root];
    while (queue.length) {
      const tn = queue.shift()!;
      for (const { id: cId, viaBranch } of childList(tn.id)) {
        if (placed.has(cId) || !meta.has(cId)) continue;
        const cn = place(cId, tn.depth + 1);
        tn.children.push(cn);
        parentOf.set(cId, tn.id);
        if (viaBranch) {
          branchChildren.add(cId);
          branchKidCount.set(tn.id, (branchKidCount.get(tn.id) ?? 0) + 1);
        }
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

  // Bottom-up layout. Each subtree reports a contour: per-level [left, right]
  // extents relative to its root card's left edge. A parent lays its children
  // out as one row whose card-edge gaps are all EQUAL — H_GAP, uniformly
  // widened only as far as cousin subtrees need to clear each other — and
  // centers its own card over that row, so with two children the gap sits
  // directly below the parent's center.
  type Contour = { left: number[]; right: number[] };
  const layoutSubtree = (tn: TreeNode): Contour => {
    if (tn.children.length === 0) return { left: [0], right: [tn.w] };
    const subs = tn.children.map(layoutSubtree);
    const widths = tn.children.map((c) => c.w);
    let gap = H_GAP;
    let cardX: number[] = [];
    for (let guard = 0; guard < 32; guard++) {
      cardX = [];
      let acc = 0;
      for (const w of widths) {
        cardX.push(acc);
        acc += w + gap;
      }
      // Sweep left to right; if a subtree's deep levels overlap an earlier
      // sibling's, widen the shared gap just enough and re-place.
      let widen = 0;
      const right: number[] = [];
      const owner: number[] = [];
      subs.forEach((sub, i) => {
        sub.left.forEach((v, l) => {
          if (right[l] !== undefined) {
            const overlap = right[l] + H_GAP - (cardX[i] + v);
            if (overlap > 0) widen = Math.max(widen, overlap / (i - owner[l]));
          }
        });
        sub.right.forEach((v, l) => {
          const r = cardX[i] + v;
          if (right[l] === undefined || r > right[l]) {
            right[l] = r;
            owner[l] = i;
          }
        });
      });
      if (widen <= 0.5) break;
      gap += widen;
    }
    const rowW = cardX[cardX.length - 1] + widths[widths.length - 1];
    const parentLeft = rowW / 2 - tn.w / 2;
    const contour: Contour = { left: [0], right: [tn.w] };
    tn.children.forEach((c, i) => {
      c.x = cardX[i] - parentLeft; // relative to parent card; made absolute below
      subs[i].left.forEach((v, l) => {
        const lv = c.x + v;
        if (contour.left[l + 1] === undefined || lv < contour.left[l + 1]) contour.left[l + 1] = lv;
      });
      subs[i].right.forEach((v, l) => {
        const rv = c.x + v;
        if (contour.right[l + 1] === undefined || rv > contour.right[l + 1]) contour.right[l + 1] = rv;
      });
    });
    return contour;
  };

  // Pack root trees left to right, then resolve child-relative x to absolute.
  let cursorX = PAD;
  const toAbsolute = (tn: TreeNode) => {
    for (const c of tn.children) {
      c.x += tn.x;
      toAbsolute(c);
    }
  };
  for (const r of roots) {
    const contour = layoutSubtree(r);
    r.x = cursorX - Math.min(...contour.left);
    cursorX = r.x + Math.max(...contour.right) + H_GAP;
    toAbsolute(r);
  }
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
    const x = tn.x;
    const y = yOf(tn.depth);
    const ports: Port[] = [];
    for (let k = 0; k < n; k++) {
      const px = x + ((k + 0.5) / n) * tn.w;
      const py = y + NODE_H;
      if (opts) ports.push({ key: opts[k].id, label: opts[k].label, optionId: opts[k].id, x: px, y: py, draggable: true });
      else ports.push({ key: 'answer', label: isChoice ? 'no options' : 'answer', optionId: null, x: px, y: py, draggable: !isChoice });
    }
    const parentId = parentOf.get(qId) ?? null;
    const reorderable = branchChildren.has(qId) && (branchKidCount.get(parentId!) ?? 0) >= 2;
    nodes.push({ id: qId, index: m.index, title: q.title, type: q.type, x, y, w: tn.w, depth: tn.depth, ports, parentId, reorderable });
    maxRight = Math.max(maxRight, x + tn.w);
    maxDepth = Math.max(maxDepth, tn.depth);
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rootNode = roots[0] ? byId.get(roots[0].id) : undefined;
  const endY = yOf(maxDepth + 1);
  const endX = rootNode ? rootNode.x + rootNode.w / 2 - END_W / 2 : PAD;
  const endTop = { x: endX + END_W / 2, y: endY };

  const edges: GEdge[] = [];

  // Faint default fall-through edges from the grey port → the default target
  // (default branch when set, else next question by order, else End).
  for (const node of nodes) {
    const sx = node.x + node.w / 2;
    const sy = node.y + NODE_H + DEF_PORT_DY;
    const def = (branchesByQ.get(node.id) ?? []).find((b) => b.is_default);
    let toEnd = false;
    let destId: string | undefined;
    if (def?.is_end) toEnd = true;
    else if (def?.target_question_id && byId.has(def.target_question_id)) destId = def.target_question_id;

    if (!toEnd && !destId) {
      const nextQ = questions[node.index + 1];
      if (nextQ && byId.has(nextQ.id)) destId = nextQ.id;
      else toEnd = true;
    }

    if (toEnd) {
      edges.push({ id: `def-${node.id}`, d: curvePath(sx, sy, endTop.x, endTop.y, 'default'), kind: 'default', fromQ: node.id, toQ: null });
    } else if (destId) {
      const tgt = byId.get(destId)!;
      const back = tgt.depth <= node.depth;
      edges.push({
        id: `def-${node.id}`,
        d: curvePath(sx, sy, tgt.x + tgt.w / 2, tgt.y, back ? 'back' : 'default'),
        kind: 'default',
        fromQ: node.id,
        toQ: tgt.id,
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
  const setDefaultBranch = useQuestionnaireStore((s) => s.setDefaultBranch);
  const addQuestion = useQuestionnaireStore((s) => s.addQuestion);
  const reorderBranches = useQuestionnaireStore((s) => s.reorderBranches);

  const { nodes, edges, endNode, width, height } = useMemo(
    () => buildLayout(questions, branches),
    [questions, branches],
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [cardDrag, setCardDrag] = useState<CardDrag | null>(null);
  const [dragDx, setDragDx] = useState(0);

  const dragActive = !!cardDrag && Math.abs(dragDx) > DRAG_THRESHOLD;
  const preview = dragActive ? siblingPreview(nodes, cardDrag.qId, cardDrag.parentId, dragDx) : null;

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
        const wire = p.isDefault
          ? (target: { questionId: string } | { isEnd: true }) => setDefaultBranch(p.sourceQuestionId, target)
          : (target: { questionId: string } | { isEnd: true }) => connectBranch(p.sourceQuestionId, p.optionId, target);
        if (el?.closest('[data-endnode]')) {
          wire({ isEnd: true });
        } else {
          const targetId = el?.closest('[data-qid]')?.getAttribute('data-qid') ?? null;
          if (targetId && targetId !== p.sourceQuestionId) {
            wire({ questionId: targetId });
          } else if (!targetId) {
            const newId = addQuestion('radio');
            wire({ questionId: newId });
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
  }, [pending, connectBranch, setDefaultBranch, addQuestion]);

  // Horizontal card drag → reorder the parent's branches. Sibling order on
  // screen is derived from branch sort_order (= branch priority), so the move
  // is persisted by relocating the dragged target's first branch next to its
  // new neighbour's first branch.
  useEffect(() => {
    if (!cardDrag) return;
    const d = cardDrag;

    const commit = (order: string[]) => {
      const sorted = branches
        .filter((b) => b.question_id === d.parentId && !b.is_default)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const firstIdx = (t: string) => sorted.findIndex((b) => !b.is_end && b.target_question_id === t);
      const from = firstIdx(d.qId);
      const slot = order.indexOf(d.qId);
      if (from < 0 || slot < 0) return;
      let to: number;
      if (slot === 0) {
        const ni = firstIdx(order[1]);
        if (ni < 0) return;
        to = ni > from ? ni - 1 : ni;
      } else {
        const pi = firstIdx(order[slot - 1]);
        if (pi < 0) return;
        to = (pi > from ? pi - 1 : pi) + 1;
      }
      if (to !== from) reorderBranches(d.parentId, from, to);
    };

    const onMove = (e: PointerEvent) => setDragDx(e.clientX - d.startX);
    const onUp = (e: PointerEvent) => {
      const dx = e.clientX - d.startX;
      if (Math.abs(dx) > DRAG_THRESHOLD) {
        const p = siblingPreview(nodes, d.qId, d.parentId, dx);
        if (p && p.order.join() !== p.original.join()) commit(p.order);
      }
      setCardDrag(null);
      setDragDx(0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCardDrag(null);
        setDragDx(0);
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
  }, [cardDrag, nodes, branches, reorderBranches]);

  const startCardDrag = (e: React.PointerEvent, n: GNode) => {
    if (!n.reorderable || !n.parentId || pending) return;
    e.preventDefault();
    setSelected(null);
    setCardDrag({ qId: n.id, parentId: n.parentId, startX: e.clientX });
    setDragDx(0);
  };

  const startWire = (e: React.PointerEvent, sourceQuestionId: string, optionId: string | null, fromX: number, fromY: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(null);
    setPending({ sourceQuestionId, optionId, fromX, fromY });
    setCursor({ x: fromX, y: fromY });
  };

  const startDefaultWire = (e: React.PointerEvent, sourceQuestionId: string, fromX: number, fromY: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(null);
    setPending({ sourceQuestionId, optionId: null, fromX, fromY, isDefault: true });
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

        {nodes.map((n) => {
          const isDragged = dragActive && cardDrag?.qId === n.id;
          const shifted = !!preview && preview.xs.has(n.id) && !isDragged;
          return (
          <div
            key={n.id}
            data-qid={n.id}
            className={`${styles.graphNode} ${hoverId === n.id ? styles.graphNodeDrop : ''} ${isDragged ? styles.graphNodeDragging : ''} ${shifted ? styles.graphNodeShift : ''}`}
            style={{ left: preview?.xs.get(n.id) ?? n.x, top: n.y, width: n.w, height: NODE_H, opacity: isDim(n.id) ? 0.3 : 1 }}
            title={n.title}
          >
            <div
              className={`${styles.graphNodeHead} ${n.reorderable ? styles.graphNodeGrab : ''}`}
              style={{ height: HEADER_H }}
              onPointerDown={(e) => startCardDrag(e, n)}
            >
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
            <span
              className={styles.graphDefaultPort}
              title="Drag to set the default next step"
              onPointerDown={(e) => startDefaultWire(e, n.id, n.x + n.w / 2, n.y + NODE_H + DEF_PORT_DY)}
            />
          </div>
          );
        })}

        <div
          data-endnode=""
          className={`${styles.graphEndNode} ${hoverId === '__end__' ? styles.graphNodeDrop : ''}`}
          style={{ left: endNode.x, top: endNode.y, width: endNode.w, height: endNode.h }}
        >
          Results / End
        </div>

        {!pending &&
          !dragActive &&
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
    .filter((b) => b.question_id === question.id && !b.is_default)
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
