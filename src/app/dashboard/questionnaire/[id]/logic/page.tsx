'use client';

import { useState } from 'react';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import type { QuestionBranch } from '@/lib/types';
import { GitBranch } from 'lucide-react';
import FlowGraph from './FlowGraph';
import styles from '../editor.module.css';

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

  // Editor-only view filter. Selecting an audience focuses the graph on that
  // audience's routing; it never affects what a respondent sees.
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
            Drag an answer to another question to branch. Drag to empty space to add a question, or
            to the End node to finish. Click a connection to edit it.
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

            <FlowGraph questions={questions} branches={branches} highlightIds={filterSet} />

            {filterSet && filterSet.size === 0 && (
              <div className={styles.flowEmptyState}>
                <p>No branch tags this audience yet. Wire a branch and set its tag to route respondents here.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
