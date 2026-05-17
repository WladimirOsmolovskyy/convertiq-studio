'use client';

import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import type { QuestionType } from '@/lib/types';
import styles from '../editor.module.css';

const QUESTION_TYPES: { type: QuestionType; label: string; icon: string }[] = [
  { type: 'radio', label: 'Radio', icon: '⭕' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑️' },
  { type: 'dropdown', label: 'Dropdown', icon: '📋' },
  { type: 'text', label: 'Short Text', icon: '✏️' },
  { type: 'textarea', label: 'Long Text', icon: '📝' },
  { type: 'number', label: 'Number', icon: '🔢' },
  { type: 'email', label: 'Email', icon: '📧' },
  { type: 'rating', label: 'Rating', icon: '⭐' },
];

const hasOptions = (type: QuestionType) => ['radio', 'checkbox', 'dropdown'].includes(type);

export default function ContentEditor() {
  const { questions, addQuestion, updateQuestion, removeQuestion, addOption, updateOption, removeOption } =
    useQuestionnaireStore();

  return (
    <div className={styles.editorPanel}>
      <div className={styles.questionList}>
        {questions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>📝</div>
            <p style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              No questions yet
            </p>
            <p style={{ fontSize: '0.875rem' }}>Add your first question from the panel below</p>
          </div>
        )}

        {questions.map((q, idx) => (
          <div key={q.id} className={styles.questionCard}>
            <div className={styles.questionCardHeader}>
              <div className={styles.dragHandle}>⋮⋮</div>
              <div className={styles.questionNumber}>{idx + 1}</div>
              <input
                className={styles.questionTitleInput}
                value={q.title}
                onChange={(e) => updateQuestion(q.id, { title: e.target.value })}
                placeholder="Enter question text..."
              />
              <select
                className={styles.questionTypeBadge}
                value={q.type}
                onChange={(e) => {
                  const newType = e.target.value as QuestionType;
                  const needsOptions = hasOptions(newType);
                  const hadOptions = hasOptions(q.type);
                  updateQuestion(q.id, {
                    type: newType,
                    options: needsOptions && !hadOptions
                      ? [
                          { id: crypto.randomUUID(), label: 'Option 1', value: 'option_1' },
                          { id: crypto.randomUUID(), label: 'Option 2', value: 'option_2' },
                        ]
                      : needsOptions ? q.options : [],
                  });
                }}
                style={{ cursor: 'pointer', background: 'var(--surface-hover)', border: '1px solid var(--border)' }}
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.questionCardBody}>
              {/* Description */}
              <input
                className="input"
                value={q.description || ''}
                onChange={(e) => updateQuestion(q.id, { description: e.target.value })}
                placeholder="Optional description..."
                style={{ marginBottom: '1rem', fontSize: '0.8125rem' }}
              />

              {/* Options for radio/checkbox/dropdown */}
              {hasOptions(q.type) && (
                <div className={styles.optionsList}>
                  {q.options.map((opt) => (
                    <div key={opt.id} className={styles.optionItem}>
                      <div className={`${styles.optionBullet} ${q.type === 'checkbox' ? styles.checkbox : ''}`} />
                      <input
                        className={styles.optionInput}
                        value={opt.label}
                        onChange={(e) => updateOption(q.id, opt.id, e.target.value)}
                        placeholder="Option text..."
                      />
                      <button className={styles.removeBtn} onClick={() => removeOption(q.id, opt.id)} title="Remove option">
                        ×
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={() => addOption(q.id)} style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}>
                    + Add Option
                  </button>
                </div>
              )}

              {/* Preview for other types */}
              {q.type === 'text' && (
                <div className="input" style={{ opacity: 0.5, pointerEvents: 'none' }}>Short text answer...</div>
              )}
              {q.type === 'textarea' && (
                <div className="input" style={{ opacity: 0.5, pointerEvents: 'none', minHeight: '80px' }}>Long text answer...</div>
              )}
              {q.type === 'number' && (
                <div className="input" style={{ opacity: 0.5, pointerEvents: 'none', width: '200px' }}>0</div>
              )}
              {q.type === 'email' && (
                <div className="input" style={{ opacity: 0.5, pointerEvents: 'none' }}>email@example.com</div>
              )}
              {q.type === 'rating' && (
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '1.5rem', opacity: 0.5 }}>
                  {[1, 2, 3, 4, 5].map((s) => <span key={s}>☆</span>)}
                </div>
              )}
            </div>

            <div className={styles.questionCardFooter}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Required
              </label>
              <button className="btn btn-danger btn-sm" onClick={() => removeQuestion(q.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}

        {/* Add Question */}
        <div className={styles.addQuestionArea}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Add Question
          </p>
          <div className={styles.addQuestionGrid}>
            {QUESTION_TYPES.map((t) => (
              <button key={t.type} className={styles.addQuestionBtn} onClick={() => addQuestion(t.type)}>
                <span className={styles.addQuestionBtnIcon}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
