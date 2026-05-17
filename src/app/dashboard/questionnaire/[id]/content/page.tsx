'use client';

import type { ReactNode } from 'react';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import type { QuestionType } from '@/lib/types';
import {
  Circle,
  CheckSquare,
  ChevronDown,
  Type,
  AlignLeft,
  Hash,
  Mail,
  Star,
  GripVertical,
  X,
  Plus,
  FileText,
} from 'lucide-react';
import styles from '../editor.module.css';

const I = { size: 16, strokeWidth: 1.75 } as const;

const QUESTION_TYPES: { type: QuestionType; label: string; icon: ReactNode }[] = [
  { type: 'radio', label: 'Radio', icon: <Circle {...I} /> },
  { type: 'checkbox', label: 'Checkbox', icon: <CheckSquare {...I} /> },
  { type: 'dropdown', label: 'Dropdown', icon: <ChevronDown {...I} /> },
  { type: 'text', label: 'Short Text', icon: <Type {...I} /> },
  { type: 'textarea', label: 'Long Text', icon: <AlignLeft {...I} /> },
  { type: 'number', label: 'Number', icon: <Hash {...I} /> },
  { type: 'email', label: 'Email', icon: <Mail {...I} /> },
  { type: 'rating', label: 'Rating', icon: <Star {...I} /> },
];

const hasOptions = (type: QuestionType) => ['radio', 'checkbox', 'dropdown'].includes(type);

export default function ContentEditor() {
  const { questions, addQuestion, updateQuestion, removeQuestion, addOption, updateOption, removeOption } =
    useQuestionnaireStore();

  return (
    <div className={styles.editorPanel}>
      <div className={styles.questionList}>
        {questions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
            <div style={{
              width: 56, height: 56, margin: '0 auto 1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-xl)', background: 'var(--fill-quaternary)',
            }}>
              <FileText size={28} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text)', letterSpacing: '-0.014em' }}>
              No questions yet
            </p>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
              Add your first question from the panel below.
            </p>
          </div>
        )}

        {questions.map((q, idx) => (
          <div key={q.id} className={styles.questionCard}>
            <div className={styles.questionCardHeader}>
              <div className={styles.dragHandle} aria-hidden>
                <GripVertical size={14} strokeWidth={1.75} />
              </div>
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
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.questionCardBody}>
              <input
                className="input"
                value={q.description || ''}
                onChange={(e) => updateQuestion(q.id, { description: e.target.value })}
                placeholder="Optional description..."
                style={{ marginBottom: '1rem', fontSize: '0.875rem' }}
              />

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
                      <button
                        className={styles.removeBtn}
                        onClick={() => removeOption(q.id, opt.id)}
                        title="Remove option"
                        aria-label="Remove option"
                      >
                        <X size={14} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={() => addOption(q.id)} style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}>
                    <Plus size={12} strokeWidth={2.25} /> Add Option
                  </button>
                </div>
              )}

              {q.type === 'text' && (
                <div className="input" style={{ opacity: 0.5, pointerEvents: 'none' }}>Short text answer…</div>
              )}
              {q.type === 'textarea' && (
                <div className="input" style={{ opacity: 0.5, pointerEvents: 'none', minHeight: '80px' }}>Long text answer…</div>
              )}
              {q.type === 'number' && (
                <div className="input" style={{ opacity: 0.5, pointerEvents: 'none', width: '200px' }}>0</div>
              )}
              {q.type === 'email' && (
                <div className="input" style={{ opacity: 0.5, pointerEvents: 'none' }}>email@example.com</div>
              )}
              {q.type === 'rating' && (
                <div style={{ display: 'flex', gap: '0.375rem', color: 'var(--text-muted)' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={22} strokeWidth={1.5} />
                  ))}
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

        <div className={styles.addQuestionArea}>
          <p style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '0.5rem',
          }}>
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
