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
import { AlertTriangle, CornerDownRight, GitBranch, GripVertical, Plus, X } from 'lucide-react';
import FlowGraph from './FlowGraph';
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

  // Editor-only view filter. Selecting an audience focuses the graph + cards on
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

            <FlowGraph
              questions={questions}
              branches={branches}
              highlightIds={filterSet}
              onSelectQuestion={(id) => scrollToCard(`logic-q-${id}`)}
            />

            {questions.map((q, idx) => {
              if (filterSet && !filterSet.has(q.id)) return null;
              return <QuestionFlowCard key={q.id} q={q} idx={idx} />;
            })}

            {filterSet && filterSet.size === 0 && (
              <div className={styles.flowEmptyState}>
                <p>No branch tags this audience yet. Add a branch and set “tag as” to route respondents here.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Per-question card (editing surface) ────────────────────────── */

function QuestionFlowCard({ q, idx }: { q: Question; idx: number }) {
  const { branches, addBranch, reorderBranches } = useQuestionnaireStore();
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
