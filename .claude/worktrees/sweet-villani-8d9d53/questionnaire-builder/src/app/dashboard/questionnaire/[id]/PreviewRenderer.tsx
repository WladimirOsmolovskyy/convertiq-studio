'use client';

import { useState, useCallback } from 'react';
import type { Question, QuestionBranch, ScoringRule, ScoreResult, DesignConfig, Questionnaire } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from 'nanoid';
import styles from './preview.module.css';

interface Props {
  questionnaire: Questionnaire;
  questions: Question[];
  branches: QuestionBranch[];
  scoringRules: ScoringRule[];
  scoreResults: ScoreResult[];
  design: DesignConfig;
  isPreview?: boolean;
  onRestart?: () => void;
}

export default function PreviewRenderer({ questionnaire, questions, branches, scoringRules, scoreResults, design, isPreview, onRestart }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { value?: string; selected_options?: string[] }>>({});
  const [questionPath, setQuestionPath] = useState<number[]>([0]);
  const [completed, setCompleted] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [matchedResult, setMatchedResult] = useState<ScoreResult | null>(null);
  const [sessionId] = useState(() => nanoid());
  const [submitting, setSubmitting] = useState(false);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((questionPath.length) / questions.length) * 100 : 0;
  const hasOptions = (type: string) => ['radio', 'checkbox', 'dropdown'].includes(type);

  const getBackgroundCSS = () => {
    if (design.background.type === 'gradient') return design.background.value;
    if (design.background.type === 'image') return `url(${design.background.value}) center/cover no-repeat`;
    return design.colors.background;
  };

  const getNextQuestionIndex = useCallback((qIndex: number, answer: Record<string, { value?: string; selected_options?: string[] }>) => {
    const q = questions[qIndex];
    const qBranches = branches.filter((b) => b.question_id === q.id);

    for (const branch of qBranches) {
      if (branch.is_end) {
        const ans = answer[q.id];
        if (branch.condition.operator === 'equals') {
          if (ans?.selected_options?.includes(branch.condition.value) || ans?.value === branch.condition.value) {
            return -1;
          }
        }
      }

      if (branch.target_question_id) {
        const ans = answer[q.id];
        let matches = false;
        if (branch.condition.operator === 'equals') {
          matches = ans?.selected_options?.includes(branch.condition.value) || ans?.value === branch.condition.value || false;
        }
        if (matches) {
          const targetIdx = questions.findIndex((tq) => tq.id === branch.target_question_id);
          if (targetIdx >= 0) return targetIdx;
        }
      }
    }

    return qIndex + 1 < questions.length ? qIndex + 1 : -1;
  }, [questions, branches]);

  const calculateScore = useCallback(() => {
    let score = 0;
    for (const q of questions) {
      const rule = scoringRules.find((r) => r.question_id === q.id);
      if (!rule) continue;
      const ans = answers[q.id];
      if (!ans) continue;

      if (rule.type === 'fixed' && hasOptions(q.type)) {
        for (const optId of ans.selected_options || []) {
          score += rule.option_scores?.[optId] ?? 0;
        }
      } else if (rule.type === 'fixed') {
        score += rule.option_scores?.['_any'] ?? 0;
      }
    }
    return score;
  }, [questions, scoringRules, answers]);

  const handleAnswer = (questionId: string, answer: { value?: string; selected_options?: string[] }) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleOptionSelect = (optionId: string) => {
    if (!currentQuestion) return;

    if (currentQuestion.type === 'checkbox') {
      const current = answers[currentQuestion.id]?.selected_options || [];
      const updated = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      handleAnswer(currentQuestion.id, { selected_options: updated });
    } else {
      handleAnswer(currentQuestion.id, { selected_options: [optionId] });
    }
  };

  const handleNext = async () => {
    const nextIdx = getNextQuestionIndex(currentIndex, answers);
    if (nextIdx === -1 || nextIdx >= questions.length) {
      await submitAndFinish();
    } else {
      setCurrentIndex(nextIdx);
      setQuestionPath((prev) => [...prev, nextIdx]);
    }
  };

  const handleBack = () => {
    if (questionPath.length > 1) {
      const newPath = questionPath.slice(0, -1);
      setQuestionPath(newPath);
      setCurrentIndex(newPath[newPath.length - 1]);
    }
  };

  const submitAndFinish = async () => {
    setSubmitting(true);
    const score = calculateScore();
    setTotalScore(score);

    const matched = scoreResults.find((r) => score >= r.min_score && score <= r.max_score);
    setMatchedResult(matched || null);

    // Save response to Supabase (even in preview mode for testing)
    try {
      const supabase = createClient();
      const { data: response } = await supabase.from('responses').insert({
        questionnaire_id: questionnaire.id,
        session_id: sessionId,
        total_score: score,
        result_id: matched?.id || null,
        completed_at: new Date().toISOString(),
        metadata: { user_agent: navigator.userAgent, is_preview: isPreview || false },
      }).select().single();

      if (response) {
        const answerRows = Object.entries(answers).map(([questionId, ans]) => {
          const rule = scoringRules.find((r) => r.question_id === questionId);
          let qScore = 0;
          const q = questions.find((qq) => qq.id === questionId);
          if (rule && q) {
            if (rule.type === 'fixed' && hasOptions(q.type)) {
              for (const optId of ans.selected_options || []) {
                qScore += rule.option_scores?.[optId] ?? 0;
              }
            } else if (rule.type === 'fixed') {
              qScore = rule.option_scores?.['_any'] ?? 0;
            }
          }

          return {
            response_id: response.id,
            question_id: questionId,
            answer: ans,
            score: qScore,
            answered_at: new Date().toISOString(),
          };
        });

        await supabase.from('response_answers').insert(answerRows);
      }
    } catch (err) {
      console.error('Failed to save response:', err);
    }

    setCompleted(true);
    setSubmitting(false);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setAnswers({});
    setQuestionPath([0]);
    setCompleted(false);
    setTotalScore(0);
    setMatchedResult(null);
    setSubmitting(false);
    onRestart?.();
  };

  const isAnswered = currentQuestion
    ? hasOptions(currentQuestion.type)
      ? (answers[currentQuestion.id]?.selected_options?.length ?? 0) > 0
      : !!answers[currentQuestion.id]?.value
    : false;

  const canProceed = !currentQuestion?.required || isAnswered;

  if (questions.length === 0) {
    return (
      <div className={styles.previewPage} style={{ background: getBackgroundCSS(), color: design.colors.text, fontFamily: design.typography.fontFamily }}>
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>📝</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>No questions yet</h1>
          <p style={{ color: design.colors.textMuted }}>Add questions in the Content tab first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.previewPage} style={{
      background: getBackgroundCSS(),
      color: design.colors.text,
      fontFamily: design.typography.fontFamily,
      fontSize: `${design.typography.baseFontSize}px`,
      lineHeight: design.typography.lineHeight,
    }}>
      {/* Preview banner */}
      {isPreview && (
        <div className={styles.previewBanner}>
          <div className={styles.previewBannerInner}>
            <span className={styles.previewBadge}>👁 PREVIEW</span>
            <span className={styles.previewBannerText}>Responses are saved — test your questionnaire end-to-end</span>
            <button className={styles.previewRestartBtn} onClick={handleRestart}>
              ↻ Restart
            </button>
          </div>
        </div>
      )}

      <div className={styles.previewContainer} style={{ maxWidth: `${design.layout.maxWidth}px`, padding: `0 ${design.layout.padding}rem` }}>
        {!completed ? (
          <>
            {/* Progress */}
            <div className={styles.progressWrap}>
              <div className={styles.progressLabel} style={{ color: design.colors.textMuted }}>
                <span>{questionnaire.title}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className={styles.progressBar} style={{ background: design.components.progress.background, height: `${design.components.progress.height}px` }}>
                <div className={styles.progressFill} style={{ width: `${progress}%`, background: design.components.progress.fillColor }} />
              </div>
            </div>

            {/* Current Question */}
            {currentQuestion && (
              <div className={styles.questionWrap} key={currentQuestion.id} style={{
                background: design.components.question.background,
                border: design.components.question.border,
                boxShadow: design.components.question.shadow,
                padding: design.components.question.padding,
                borderRadius: `${design.layout.borderRadius}px`,
              }}>
                <h2 className={styles.questionTitle} style={{
                  fontFamily: design.typography.headingFont,
                  fontWeight: design.typography.headingWeight,
                  fontSize: `${design.typography.baseFontSize * 1.375}px`,
                  color: design.colors.text,
                }}>
                  {currentQuestion.title}
                  {currentQuestion.required && <span className={styles.requiredStar}>*</span>}
                </h2>

                {currentQuestion.description && (
                  <p className={styles.questionDescription} style={{ color: design.colors.textMuted }}>
                    {currentQuestion.description}
                  </p>
                )}

                {/* Radio / Checkbox / Dropdown Options */}
                {hasOptions(currentQuestion.type) && (
                  <div className={styles.optionsList}>
                    {currentQuestion.options.map((opt) => {
                      const isSelected = answers[currentQuestion.id]?.selected_options?.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          className={`${styles.optionButton} ${isSelected ? styles.selected : ''}`}
                          onClick={() => handleOptionSelect(opt.id)}
                          style={{
                            background: isSelected ? design.components.option.selectedBackground : design.components.option.background,
                            border: isSelected ? design.components.option.selectedBorder : design.components.option.border,
                            borderRadius: `${design.layout.borderRadius * 0.6}px`,
                            color: design.colors.text,
                          }}
                        >
                          <div className={`${styles.optionIndicator} ${currentQuestion.type === 'checkbox' ? styles.checkbox : ''}`} style={{ color: design.colors.accent }} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Text input */}
                {currentQuestion.type === 'text' && (
                  <input
                    className={styles.previewInput}
                    value={answers[currentQuestion.id]?.value || ''}
                    onChange={(e) => handleAnswer(currentQuestion.id, { value: e.target.value })}
                    placeholder="Type your answer..."
                    style={{
                      background: design.components.input.background,
                      border: design.components.input.border,
                      borderRadius: `${design.components.input.borderRadius}px`,
                      color: design.colors.text,
                    }}
                  />
                )}

                {/* Textarea */}
                {currentQuestion.type === 'textarea' && (
                  <textarea
                    className={styles.previewTextarea}
                    value={answers[currentQuestion.id]?.value || ''}
                    onChange={(e) => handleAnswer(currentQuestion.id, { value: e.target.value })}
                    placeholder="Type your answer..."
                    style={{
                      background: design.components.input.background,
                      border: design.components.input.border,
                      borderRadius: `${design.components.input.borderRadius}px`,
                      color: design.colors.text,
                    }}
                  />
                )}

                {/* Number */}
                {currentQuestion.type === 'number' && (
                  <input
                    type="number"
                    className={styles.previewInput}
                    value={answers[currentQuestion.id]?.value || ''}
                    onChange={(e) => handleAnswer(currentQuestion.id, { value: e.target.value })}
                    placeholder="0"
                    style={{
                      background: design.components.input.background,
                      border: design.components.input.border,
                      borderRadius: `${design.components.input.borderRadius}px`,
                      color: design.colors.text,
                      maxWidth: '200px',
                    }}
                  />
                )}

                {/* Email */}
                {currentQuestion.type === 'email' && (
                  <input
                    type="email"
                    className={styles.previewInput}
                    value={answers[currentQuestion.id]?.value || ''}
                    onChange={(e) => handleAnswer(currentQuestion.id, { value: e.target.value })}
                    placeholder="email@example.com"
                    style={{
                      background: design.components.input.background,
                      border: design.components.input.border,
                      borderRadius: `${design.components.input.borderRadius}px`,
                      color: design.colors.text,
                    }}
                  />
                )}

                {/* Rating */}
                {currentQuestion.type === 'rating' && (
                  <div className={styles.ratingStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        className={styles.ratingStar}
                        onClick={() => {
                          handleAnswer(currentQuestion.id, { value: String(star) });
                        }}
                        style={{ color: star <= (Number(answers[currentQuestion.id]?.value) || 0) ? design.colors.accent : design.colors.textMuted }}
                      >
                        {star <= (Number(answers[currentQuestion.id]?.value) || 0) ? '★' : '☆'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className={styles.navButtons}>
              <button
                className={styles.backBtn}
                onClick={handleBack}
                disabled={questionPath.length <= 1}
                style={{ color: design.colors.textMuted }}
              >
                ← Back
              </button>
              <button
                className={styles.navBtn}
                onClick={handleNext}
                disabled={!canProceed || submitting}
                style={{
                  background: design.components.button.background,
                  color: design.components.button.color,
                  borderRadius: `${design.components.button.borderRadius}px`,
                  padding: design.components.button.padding,
                  fontSize: `${design.components.button.fontSize}px`,
                  opacity: canProceed ? 1 : 0.5,
                }}
              >
                {submitting ? 'Submitting...' : getNextQuestionIndex(currentIndex, answers) === -1 ? 'Submit' : 'Next'}
              </button>
            </div>
          </>
        ) : (
          /* Results */
          <div className={styles.resultsPage}>
            <div className={styles.resultsIcon}>🎉</div>
            <h1 className={styles.resultsTitle} style={{
              fontFamily: design.typography.headingFont,
              fontWeight: design.typography.headingWeight,
              color: design.colors.text,
            }}>
              {matchedResult?.title || 'Thank you!'}
            </h1>

            <div className={styles.resultsScore} style={{ background: design.components.option.selectedBackground, color: design.colors.accent }}>
              Score: {totalScore}
            </div>

            {matchedResult ? (
              <p className={styles.resultsDescription} style={{ color: design.colors.textMuted }}>
                {matchedResult.description}
              </p>
            ) : (
              <p className={styles.resultsDescription} style={{ color: design.colors.textMuted }}>
                Your responses have been recorded. Thank you for completing the questionnaire!
              </p>
            )}

            {isPreview && (
              <button className={styles.previewRestartBtnLarge} onClick={handleRestart}>
                ↻ Restart Preview
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
