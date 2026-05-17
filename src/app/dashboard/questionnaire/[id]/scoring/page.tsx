'use client';

import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { Target, Plus, X } from 'lucide-react';
import styles from '../editor.module.css';

export default function ScoringEditor() {
  const { questions, scoringRules, updateScoringRule, scoreResults, addScoreResult, updateScoreResult, removeScoreResult } =
    useQuestionnaireStore();

  const hasOptions = (type: string) => ['radio', 'checkbox', 'dropdown'].includes(type);

  return (
    <div className={styles.editorPanel}>
      <div style={{ maxWidth: '720px' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '-0.018em' }}>Scoring</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', letterSpacing: '-0.008em' }}>
            Assign scores to each answer. Open-ended questions can be scored by AI.
          </p>
        </div>

        {questions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-xl)', background: 'var(--fill-quaternary)',
            }}>
              <Target size={28} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: '0.9375rem' }}>Add questions in the Content tab first.</p>
          </div>
        ) : (
          <>
            {/* Per-question scoring */}
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

                    {/* Scoring type toggle (only for text-based) */}
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

                  {/* Fixed scoring for options */}
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

                  {/* AI scoring for open questions */}
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

                  {/* Fixed scoring for open questions (simple point value) */}
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

            {/* Score Result Ranges */}
            <div style={{ marginTop: '3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Result Ranges</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                    Define what message to show based on the total score
                  </p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={addScoreResult}>
                  <Plus size={12} strokeWidth={2.25} /> Add Range
                </button>
              </div>

              {scoreResults.map((result) => (
                <div key={result.id} className={styles.resultCard}>
                  <div className={styles.resultRange}>
                    <span className={styles.rangeLabel}>From</span>
                    <input
                      type="number"
                      className={styles.scoreInput}
                      value={result.min_score}
                      onChange={(e) => updateScoreResult(result.id, { min_score: Number(e.target.value) })}
                    />
                    <span className={styles.rangeLabel}>To</span>
                    <input
                      type="number"
                      className={styles.scoreInput}
                      value={result.max_score}
                      onChange={(e) => updateScoreResult(result.id, { max_score: Number(e.target.value) })}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>points</span>
                    <button
                      className={styles.removeBtn}
                      onClick={() => removeScoreResult(result.id)}
                      style={{ marginLeft: 'auto' }}
                      aria-label="Remove range"
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <input
                      className="input"
                      value={result.title}
                      onChange={(e) => updateScoreResult(result.id, { title: e.target.value })}
                      placeholder="Result title..."
                    />
                    <textarea
                      className="input"
                      rows={2}
                      value={result.description}
                      onChange={(e) => updateScoreResult(result.id, { description: e.target.value })}
                      placeholder="Result description..."
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
