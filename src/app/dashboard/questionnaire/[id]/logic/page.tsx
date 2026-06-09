'use client';

import { useState } from 'react';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import type { QuestionBranch } from '@/lib/types';
import { GitBranch, Plus } from 'lucide-react';
import FlowGraph from './FlowGraph';
import styles from '../editor.module.css';

/** Questions involved in one audience's routing: questions whose branch tags
 *  this audience, plus everything reachable from them by following branch jump
 *  targets. Editor-only — used to focus the canvas, never the runtime flow. */
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
  const { questions, branches, audiences, addAudience } = useQuestionnaireStore();
  const [activeAudience, setActiveAudience] = useState<string | null>(null);

  const filterSet =
    activeAudience && audiences.some((a) => a.id === activeAudience)
      ? questionsForAudience(activeAudience, branches)
      : null;

  return (
    <div className={styles.logicFull}>
      <div className={styles.canvasTabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeAudience === null}
          className={`${styles.canvasTab} ${activeAudience === null ? styles.canvasTabActive : ''}`}
          onClick={() => setActiveAudience(null)}
        >
          All
        </button>
        {audiences.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={activeAudience === a.id}
            className={`${styles.canvasTab} ${activeAudience === a.id ? styles.canvasTabActive : ''}`}
            onClick={() => setActiveAudience(a.id)}
          >
            <span className={styles.canvasTabDot} style={{ background: a.color ?? 'var(--accent)' }} aria-hidden />
            {a.name}
          </button>
        ))}
        <button type="button" className={styles.canvasTabAdd} onClick={() => addAudience()} title="Add audience">
          <Plus size={15} strokeWidth={2.25} />
        </button>
      </div>

      {questions.length === 0 ? (
        <div className={styles.canvasEmpty}>
          <div className={styles.flowEmptyIcon}>
            <GitBranch size={28} strokeWidth={1.5} />
          </div>
          <p>Add questions in the Content tab first.</p>
        </div>
      ) : (
        <FlowGraph questions={questions} branches={branches} highlightIds={filterSet} />
      )}
    </div>
  );
}
