'use client';

import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import type { BranchOperator } from '@/lib/types';
import { GitBranch, ArrowRight, Plus, X, Flag, Target } from 'lucide-react';
import styles from '../editor.module.css';

const OPERATORS: { value: BranchOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
];

const hasOptions = (type: string) => ['radio', 'checkbox', 'dropdown'].includes(type);

export default function LogicEditor() {
  const { questions, branches, addBranch, updateBranch, removeBranch, scoringRules, updateScoringRule } =
    useQuestionnaireStore();

  return (
    <div className={styles.editorPanel}>
      <div className={styles.flowContainer}>
        <div style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '-0.018em' }}>
            Logic & Flow
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', letterSpacing: '-0.008em' }}>
            Define conditional paths and per-question scoring. Without branches, questions follow their natural order.
          </p>
        </div>

        {questions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-xl)', background: 'var(--fill-quaternary)',
            }}>
              <GitBranch size={28} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: '0.9375rem' }}>Add questions in the Content tab first.</p>
          </div>
        ) : (
          <>
            {questions.map((q, idx) => {
              const qBranches = branches.filter((b) => b.question_id === q.id);

              return (
                <div key={q.id}>
                  <div className={styles.flowQuestionNode}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: qBranches.length > 0 ? '1rem' : 0 }}>
                      <div className={styles.questionNumber}>{idx + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{q.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          {q.type} {q.required && '• required'}
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => addBranch(q.id)}>
                        <Plus size={12} strokeWidth={2.25} /> Add Branch
                      </button>
                    </div>

                    {/* Branches */}
                    {qBranches.map((branch) => (
                      <div key={branch.id} className={styles.branchRow}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', flexShrink: 0 }}>If</span>

                        {/* Condition value */}
                        {hasOptions(q.type) ? (
                          <select
                            className={styles.branchSelect}
                            value={branch.condition.value}
                            onChange={(e) =>
                              updateBranch(branch.id, {
                                condition: { ...branch.condition, field: 'option', operator: 'equals', value: e.target.value },
                              })
                            }
                          >
                            <option value="">Select option...</option>
                            {q.options.map((opt) => (
                              <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <select
                              className={styles.branchSelect}
                              value={branch.condition.operator}
                              onChange={(e) =>
                                updateBranch(branch.id, {
                                  condition: { ...branch.condition, operator: e.target.value as BranchOperator },
                                })
                              }
                            >
                              {OPERATORS.map((op) => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </select>
                            <input
                              className={styles.branchSelect}
                              value={branch.condition.value}
                              onChange={(e) =>
                                updateBranch(branch.id, {
                                  condition: { ...branch.condition, value: e.target.value },
                                })
                              }
                              placeholder="Value..."
                              style={{ flex: 1, minWidth: '80px' }}
                            />
                          </>
                        )}

                        <ArrowRight size={14} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden />

                        {/* Target */}
                        {branch.is_end ? (
                          <span className="badge badge-error" style={{ flexShrink: 0 }}>End</span>
                        ) : (
                          <select
                            className={styles.branchSelect}
                            value={branch.target_question_id || ''}
                            onChange={(e) => {
                              if (e.target.value === '__end__') {
                                updateBranch(branch.id, { target_question_id: null, is_end: true });
                              } else {
                                updateBranch(branch.id, { target_question_id: e.target.value || null, is_end: false });
                              }
                            }}
                          >
                            <option value="">Next question (default)</option>
                            {questions
                              .filter((tq) => tq.id !== q.id)
                              .map((tq) => (
                                <option key={tq.id} value={tq.id}>
                                  Q{questions.indexOf(tq) + 1}: {tq.title.substring(0, 30)}
                                </option>
                              ))}
                            <option value="__end__">End questionnaire</option>
                          </select>
                        )}

                        <button className={styles.removeBtn} onClick={() => removeBranch(branch.id)} aria-label="Remove branch">
                          <X size={14} strokeWidth={2} />
                        </button>
                      </div>
                    ))}

                    {/* Default flow indicator */}
                    {qBranches.length > 0 && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Default: → {idx < questions.length - 1 ? `Q${idx + 2}: ${questions[idx + 1].title.substring(0, 30)}` : 'End (results)'}
                      </div>
                    )}
                  </div>

                  {/* Connector */}
                  {idx < questions.length - 1 && (
                    <div className={styles.flowConnector} />
                  )}
                </div>
              );
            })}

            <div className={styles.flowConnector} />
            <div className={styles.flowQuestionNode} style={{ borderColor: 'var(--success)', background: 'var(--success-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Flag size={18} strokeWidth={1.75} style={{ color: 'var(--success)' }} aria-hidden />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--success)' }}>Results / End</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Score is calculated and a Result page is shown. Author result pages in the Result tab.
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Per-question Scoring ──────────────────────── */}
            <div style={{ marginTop: '3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Target size={18} strokeWidth={1.75} style={{ color: 'var(--text-secondary)' }} aria-hidden />
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Scoring</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.125rem' }}>
                    Assign points to each answer. Open-ended questions can be scored by AI.
                  </p>
                </div>
              </div>

              {questions.map((q, idx) => {
                const rule = scoringRules.find((r) => r.question_id === q.id);

                return (
                  <div key={q.id} className={styles.scoringCard}>
                    <div className={styles.scoringHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className={styles.questionNumber}>{idx + 1}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{q.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{q.type}</div>
                        </div>
                      </div>

                      {!hasOptions(q.type) && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className={`btn btn-sm ${rule?.type === 'fixed' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => updateScoringRule(q.id, { type: 'fixed' })}
                          >
                            Fixed
                          </button>
                          <button
                            className={`btn btn-sm ${rule?.type === 'ai' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => updateScoringRule(q.id, { type: 'ai' })}
                          >
                            AI
                          </button>
                        </div>
                      )}
                    </div>

                    {hasOptions(q.type) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {q.options.map((opt) => (
                          <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{opt.label}</span>
                            <input
                              type="number"
                              className={styles.scoreInput}
                              value={rule?.option_scores?.[opt.id] ?? 0}
                              onChange={(e) =>
                                updateScoringRule(q.id, {
                                  type: 'fixed',
                                  option_scores: {
                                    ...(rule?.option_scores || {}),
                                    [opt.id]: Number(e.target.value),
                                  },
                                })
                              }
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>pts</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!hasOptions(q.type) && rule?.type === 'ai' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <div style={{ flex: 1 }}>
                            <label className="input-label">Min Score</label>
                            <input
                              type="number"
                              className="input"
                              value={rule.ai_score_min}
                              onChange={(e) => updateScoringRule(q.id, { ai_score_min: Number(e.target.value) })}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="input-label">Max Score</label>
                            <input
                              type="number"
                              className="input"
                              value={rule.ai_score_max}
                              onChange={(e) => updateScoringRule(q.id, { ai_score_max: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="input-label">AI Scoring Criteria</label>
                          <textarea
                            className="input"
                            rows={4}
                            value={rule.ai_prompt || ''}
                            onChange={(e) => updateScoringRule(q.id, { ai_prompt: e.target.value })}
                            placeholder="Describe what makes a good answer. E.g.: 'Score higher if the answer demonstrates specific technical knowledge and provides concrete examples. Score lower for vague or generic responses.'"
                            style={{ resize: 'vertical' }}
                          />
                        </div>
                      </div>
                    )}

                    {!hasOptions(q.type) && (!rule || rule.type === 'fixed') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Points for any answer:</span>
                        <input
                          type="number"
                          className={styles.scoreInput}
                          value={rule?.option_scores?.['_any'] ?? 0}
                          onChange={(e) =>
                            updateScoringRule(q.id, {
                              type: 'fixed',
                              option_scores: { _any: Number(e.target.value) },
                            })
                          }
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>pts</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
