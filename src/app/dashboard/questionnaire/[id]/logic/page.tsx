'use client';

import { useState } from 'react';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import type { BranchOperator, Question, QuestionBranch, QuestionType } from '@/lib/types';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  CornerDownRight,
  Flag,
  GitBranch,
  GripVertical,
  Plus,
  X,
} from 'lucide-react';
import styles from '../editor.module.css';

const CHOICE_TYPES: QuestionType[] = ['radio', 'checkbox', 'dropdown'];
const hasOptions = (type: QuestionType) => CHOICE_TYPES.includes(type);

/** Operators offered per question type. Only operators the runtime actually
 *  honors for that type are shown, so a dead branch can't be authored. */
function operatorOptions(type: QuestionType): { value: BranchOperator; label: string }[] {
  if (hasOptions(type)) {
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

const trunc = (s: string, n = 30) => (s.length > n ? `${s.slice(0, n)}…` : s);

const scrollToCard = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

/** Questions involved in one audience's routing: questions whose branch tags
 *  this audience, plus everything reachable from them by following branch jump
 *  targets. Editor-only — used to filter the view, never the runtime flow. */
function questionsForAudience(audienceId: string, branches: QuestionBranch[]): Set<string> {
  const set = new Set<string>();
  const queue: string[] = [];
  for (const b of branches) {
    if (b.assign_audience_id === audienceId) {
      queue.push(b.question_id);
      if (b.target_question_id) queue.push(b.target_question_id);
    }
  }
  while (queue.length) {
    const id = queue.shift() as string;
    if (set.has(id)) continue;
    set.add(id);
    for (const b of branches) {
      if (b.question_id === id && b.target_question_id && !set.has(b.target_question_id)) {
        queue.push(b.target_question_id);
      }
    }
  }
  return set;
}

export default function LogicEditor() {
  const { questions, branches, audiences } = useQuestionnaireStore();
  const [activeAudience, setActiveAudience] = useState<string | null>(null);

  // Editor-only view filter. Selecting an audience focuses the map + cards on
  // that audience's routing; it never affects what a respondent sees.
  const filterSet =
    activeAudience && audiences.some((a) => a.id === activeAudience)
      ? questionsForAudience(activeAudience, branches)
      : null;

  return (
    <div className={styles.editorPanel}>
      <div className={styles.flowContainer}>
        <div className={styles.flowHeader}>
          <h2 className={styles.flowHeaderTitle}>Logic &amp; Flow</h2>
          <p className={styles.flowHeaderDesc}>
            Define conditional paths based on answers. Without branches, questions follow their
            natural order.
          </p>
        </div>

        {questions.length === 0 ? (
          <div className={styles.flowEmptyState}>
            <div className={styles.flowEmptyIcon}>
              <GitBranch size={28} strokeWidth={1.5} />
            </div>
            <p>Add questions in the Content tab first.</p>
          </div>
        ) : (
          <>
            {audiences.length > 0 && (
              <div className={styles.logicTabs} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeAudience === null}
                  className={`${styles.logicTab} ${activeAudience === null ? styles.logicTabActive : ''}`}
                  onClick={() => setActiveAudience(null)}
                >
                  All branches
                </button>
                {audiences.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="tab"
                    aria-selected={activeAudience === a.id}
                    className={`${styles.logicTab} ${activeAudience === a.id ? styles.logicTabActive : ''}`}
                    onClick={() => setActiveAudience(a.id)}
                  >
                    <span
                      className={styles.logicTabDot}
                      style={{ background: a.color ?? 'var(--accent)' }}
                      aria-hidden
                    />
                    {a.name}
                  </button>
                ))}
              </div>
            )}

            <FlowMap questions={questions} branches={branches} highlightIds={filterSet} />

            {questions.map((q, idx) => {
              if (filterSet && !filterSet.has(q.id)) return null;
              return (
                <div key={q.id}>
                  <QuestionFlowCard q={q} idx={idx} />
                  {idx < questions.length - 1 && <div className={styles.flowConnector} />}
                </div>
              );
            })}

            {filterSet && filterSet.size === 0 && (
              <div className={styles.flowEmptyState}>
                <p>No branch tags this audience yet. Add a branch and set “tag as” to route respondents here.</p>
              </div>
            )}

            <div className={styles.flowConnector} />
            <div id="logic-end" className={styles.flowTerminal}>
              <Flag size={18} strokeWidth={1.75} aria-hidden />
              <div>
                <div className={styles.flowTerminalTitle}>Results / End</div>
                <div className={styles.flowTerminalDesc}>
                  Score is calculated and a Result page is shown. Author result pages in the Result
                  tab.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Read-only flow map ─────────────────────────────────────────── */

const NODE_W = 104;
const NODE_H = 40;
const NODE_Y = 96;
const STEP = 132;
const MAP_H = 150;

function FlowMap({
  questions,
  branches,
  highlightIds,
}: {
  questions: Question[];
  branches: QuestionBranch[];
  highlightIds: Set<string> | null;
}) {
  const nodes = [
    ...questions.map((q, i) => ({ id: `logic-q-${q.id}`, qid: q.id as string | null, label: `Q${i + 1}`, title: q.title })),
    { id: 'logic-end', qid: null as string | null, label: 'End', title: 'Results / End' },
  ];
  const endIdx = nodes.length - 1;
  const cx = (i: number) => i * STEP + NODE_W / 2;
  const width = nodes.length * STEP - (STEP - NODE_W);

  // When a tab filter is active, dim everything not in the audience's subgraph.
  const isDim = (idx: number) => {
    if (!highlightIds) return false;
    const n = nodes[idx];
    return n.qid != null && !highlightIds.has(n.qid);
  };

  const jumps = branches
    .map((b) => {
      const from = questions.findIndex((q) => q.id === b.question_id);
      if (from < 0) return null;
      if (b.is_end) return { from, to: endIdx, kind: 'end' as const };
      if (b.target_question_id) {
        const to = questions.findIndex((q) => q.id === b.target_question_id);
        if (to >= 0) return { from, to, kind: 'jump' as const };
      }
      return null;
    })
    .filter((j): j is { from: number; to: number; kind: 'end' | 'jump' } => j !== null);

  return (
    <div className={styles.flowMap}>
      <svg width={width} height={MAP_H} role="img" aria-label="Flow overview">
        <defs>
          <marker id="fm-arrow-jump" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" className={styles.flowMapArrowJump} />
          </marker>
          <marker id="fm-arrow-end" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" className={styles.flowMapArrowEnd} />
          </marker>
        </defs>

        {/* Default sequential edges */}
        {nodes.slice(0, -1).map((_, i) => (
          <line
            key={`def-${i}`}
            x1={i * STEP + NODE_W}
            y1={NODE_Y + NODE_H / 2}
            x2={(i + 1) * STEP}
            y2={NODE_Y + NODE_H / 2}
            className={styles.flowMapDefaultEdge}
            style={highlightIds && (isDim(i) || isDim(i + 1)) ? { opacity: 0.15 } : undefined}
          />
        ))}

        {/* Jump / end arcs */}
        {jumps.map((j, i) => {
          const x1 = cx(j.from);
          const x2 = cx(j.to);
          const arcH = Math.min(82, 26 + Math.abs(j.to - j.from) * 14);
          const midX = (x1 + x2) / 2;
          const d = `M ${x1} ${NODE_Y} Q ${midX} ${NODE_Y - arcH} ${x2} ${NODE_Y}`;
          const dim = highlightIds && isDim(j.from) && isDim(j.to);
          return (
            <path
              key={`jmp-${i}`}
              d={d}
              fill="none"
              className={j.kind === 'end' ? styles.flowMapEndEdge : styles.flowMapJumpEdge}
              markerEnd={j.kind === 'end' ? 'url(#fm-arrow-end)' : 'url(#fm-arrow-jump)'}
              style={dim ? { opacity: 0.15 } : undefined}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((n, i) => (
          <g
            key={n.id}
            className={styles.flowMapNode}
            onClick={() => scrollToCard(n.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') scrollToCard(n.id);
            }}
            style={isDim(i) ? { opacity: 0.25 } : undefined}
          >
            <title>{n.title}</title>
            <rect
              x={i * STEP}
              y={NODE_Y}
              width={NODE_W}
              height={NODE_H}
              rx={8}
              className={i === endIdx ? styles.flowMapNodeRectEnd : styles.flowMapNodeRect}
            />
            <text x={cx(i)} y={NODE_Y + NODE_H / 2 + 4} textAnchor="middle" className={styles.flowMapNodeText}>
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ─── Per-question card ──────────────────────────────────────────── */

function QuestionFlowCard({ q, idx }: { q: Question; idx: number }) {
  const { questions, branches, addBranch, reorderBranches } = useQuestionnaireStore();
  const qBranches = branches
    .filter((b) => b.question_id === q.id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const ids = qBranches.map((b) => b.id);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorderBranches(q.id, from, to);
  };

  const nextQ = idx < questions.length - 1 ? questions[idx + 1] : null;
  const defaultLabel = nextQ ? `Q${idx + 2}: ${trunc(nextQ.title)}` : 'End (results)';

  return (
    <div id={`logic-q-${q.id}`} className={styles.flowQuestionNode}>
      <div className={styles.flowQuestionHead}>
        <div className={styles.questionNumber}>{idx + 1}</div>
        <div className={styles.flowQuestionMeta}>
          <div className={styles.flowQuestionTitle}>{q.title}</div>
          <div className={styles.flowQuestionType}>
            {q.type}
            {q.required && ' • required'}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => addBranch(q.id)}>
          <Plus size={12} strokeWidth={2.25} /> Add branch
        </button>
      </div>

      {qBranches.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className={styles.branchList}>
              {qBranches.map((branch) => (
                <SortableBranchRow key={branch.id} branch={branch} q={q} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className={styles.branchDefault}>
        <CornerDownRight size={13} strokeWidth={1.75} aria-hidden /> Otherwise → {defaultLabel}
      </div>
    </div>
  );
}

/* ─── Branch row (sortable) ──────────────────────────────────────── */

function SortableBranchRow({ branch, q }: { branch: QuestionBranch; q: Question }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: branch.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <BranchRow branch={branch} q={q} dragHandle={{ attributes, listeners }} />
    </div>
  );
}

function BranchRow({
  branch,
  q,
  dragHandle,
}: {
  branch: QuestionBranch;
  q: Question;
  dragHandle: Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>;
}) {
  const { questions, audiences, updateBranch, removeBranch } = useQuestionnaireStore();
  const isChoice = hasOptions(q.type);
  const operators = operatorOptions(q.type);
  const incomplete = branch.condition.value === '';

  const targetValue = branch.is_end ? '__end__' : branch.target_question_id || '';
  const onTargetChange = (v: string) => {
    if (v === '__end__') updateBranch(branch.id, { is_end: true, target_question_id: null });
    else if (v === '') updateBranch(branch.id, { is_end: false, target_question_id: null });
    else updateBranch(branch.id, { is_end: false, target_question_id: v });
  };

  return (
    <div className={styles.branchRow}>
      <button
        className={styles.branchHandle}
        aria-label="Reorder branch"
        {...dragHandle.attributes}
        {...dragHandle.listeners}
      >
        <GripVertical size={14} strokeWidth={1.75} />
      </button>

      <span className={styles.branchPrefix}>If answer</span>

      <select
        className={styles.branchSelect}
        value={branch.condition.operator}
        onChange={(e) =>
          updateBranch(branch.id, {
            condition: {
              ...branch.condition,
              field: isChoice ? 'option' : 'value',
              operator: e.target.value as BranchOperator,
            },
          })
        }
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {isChoice ? (
        <select
          className={styles.branchSelect}
          value={branch.condition.value}
          onChange={(e) =>
            updateBranch(branch.id, {
              condition: { ...branch.condition, field: 'option', value: e.target.value },
            })
          }
        >
          <option value="">{q.options.length ? 'Select option…' : 'Add options first'}</option>
          {q.options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={styles.branchSelect}
          value={branch.condition.value}
          onChange={(e) =>
            updateBranch(branch.id, {
              condition: { ...branch.condition, field: 'value', value: e.target.value },
            })
          }
          placeholder={q.type === 'number' || q.type === 'rating' ? 'Number…' : 'Value…'}
          inputMode={q.type === 'number' || q.type === 'rating' ? 'numeric' : undefined}
          style={{ flex: 1, minWidth: 80 }}
        />
      )}

      <CornerDownRight size={14} strokeWidth={1.75} className={styles.branchArrow} aria-hidden />

      <select className={styles.branchSelect} value={targetValue} onChange={(e) => onTargetChange(e.target.value)}>
        <option value="">Next question (default)</option>
        {questions
          .filter((tq) => tq.id !== q.id)
          .map((tq) => (
            <option key={tq.id} value={tq.id}>
              Q{questions.indexOf(tq) + 1}: {trunc(tq.title)}
            </option>
          ))}
        <option value="__end__">End questionnaire</option>
      </select>

      {audiences.length > 0 && (
        <select
          className={styles.branchSelect}
          value={branch.assign_audience_id ?? ''}
          onChange={(e) => updateBranch(branch.id, { assign_audience_id: e.target.value || null })}
          title="Tag the visitor with an audience when this branch matches"
        >
          <option value="">— no tag —</option>
          {audiences.map((a) => (
            <option key={a.id} value={a.id}>
              tag: {a.name}
            </option>
          ))}
        </select>
      )}

      {incomplete && (
        <span className={styles.branchInvalid} title="Incomplete — this branch won't fire">
          <AlertTriangle size={13} strokeWidth={2} aria-hidden /> incomplete
        </span>
      )}

      <button className={styles.removeBtn} onClick={() => removeBranch(branch.id)} aria-label="Remove branch">
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
