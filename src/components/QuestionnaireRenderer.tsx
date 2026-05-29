'use client';

/**
 * Single source of truth for rendering a questionnaire end-to-end.
 *
 * Used by:
 *   - /q/[slug] (public visitor flow, via QuestionnaireRendererPublic wrapper)
 *   - dashboard preview tab (via QuestionnaireRendererPreview wrapper)
 *
 * Both wrappers pass their own CSS module (`styles`) plus a `mode` flag that
 * toggles preview-only chrome (banner, restart button); preview mode also
 * skips persistence entirely. The class names used inside this file must exist on every
 * styles module passed in — `page`, `container`, `input`, `textarea`,
 * `progressWrap`, `progressBar`, `progressFill`, `progressLabel`,
 * `questionWrap`, `questionTitle`, `questionDescription`, `requiredStar`,
 * `optionsList`, `optionsGrid`, `optionRadio`, `optionButton`, `optionIndicator`,
 * `selected`, `checkbox`, `ratingStars`, `ratingStar`, `navButtons`, `navBtn`,
 * `backBtn`, `resultsPage`, `resultsIcon`, `resultsTitle`, `resultsScore`,
 * `resultsDescription`.
 *
 * Preview-only classes (only consulted when `mode === 'preview'`):
 *   `previewBanner`, `previewBannerInner`, `previewBadge`, `previewBannerText`,
 *   `previewRestartBtn`, `previewRestartBtnLarge`.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from 'nanoid';
import type {
  AnswersMap,
  Audience,
  DesignConfig,
  ElementId,
  LeadField,
  Question,
  QuestionBranch,
  Questionnaire,
  ResultPage,
  ScoringRule,
} from '@/lib/types';
import { isCustomField, resolveLeadFields } from '@/lib/leadFields';
import { buildLeadPayload } from '@/lib/leadPayload';
import { assignAudience, countRedFlags } from '@/lib/audiences/assign';
import { calculateTotalScore } from '@/lib/scoring';
import ResultPageRenderer from '@/components/ResultPageRenderer';
import { projectAnswers, type ResultRenderContext } from '@/lib/resultVariables';

type StylesMap = Record<string, string>;

export interface QuestionnaireRendererProps {
  questionnaire: Questionnaire;
  questions: Question[];
  branches: QuestionBranch[];
  scoringRules: ScoringRule[];
  resultPages: ResultPage[];
  design: DesignConfig;
  /** Audiences (with score ranges) configured on this questionnaire.
   *  Used to assign a bucket to each completed response. */
  audiences?: Audience[];
  /** CSS module providing the class surface this component uses. */
  styles: StylesMap;
  /** 'public' (default) or 'preview'. Preview shows banner + restart UI and
   *  does not persist responses. */
  mode?: 'public' | 'preview';
  /** Optional template-level lead fields. Public path loads them server-side
   *  and passes them in; preview omits them. */
  templateLeadFields?: LeadField[];
  /** When true, addressable elements gain click-to-select behavior and
   *  outline classes. The renderer also suppresses each element's normal
   *  click action (e.g. a radio option won't auto-advance). Wired only by
   *  the Design tab's preview pane. */
  selectableMode?: boolean;
  /** Currently selected element id from the inspector. Highlights the
   *  matching element. */
  selectedElementId?: ElementId | null;
  /** Fired when the user clicks a selectable element in selectableMode. */
  onSelectElement?: (id: ElementId) => void;
}

const hasOptions = (type: string) => ['radio', 'checkbox', 'dropdown'].includes(type);

/** Convert sparse `design.elements[id]` overrides into inline CSS. Only the
 *  fields wired in Commit C are emitted (fill, radius, padding); VarRefs are
 *  ignored for now and will be resolved in phase 2. */
function elementOverrideStyle(design: DesignConfig, id: ElementId): CSSProperties {
  const o = design.elements?.[id];
  if (!o) return {};
  const s: CSSProperties = {};
  if (typeof o.fill === 'string') s.background = o.fill;
  if (typeof o.radius === 'number') s.borderRadius = `${o.radius}px`;
  if (typeof o.padding === 'number') s.padding = `${o.padding}rem`;
  return s;
}

export default function QuestionnaireRenderer({
  questionnaire,
  questions,
  branches,
  scoringRules,
  resultPages,
  design,
  audiences,
  styles,
  mode = 'public',
  templateLeadFields,
  selectableMode,
  selectedElementId,
  onSelectElement,
}: QuestionnaireRendererProps) {
  const isPreview = mode === 'preview';

  /**
   * Build the className + onClick props for an addressable element.
   * In selectableMode, original click handlers are SUPPRESSED — clicks
   * select the element instead of triggering its UI behavior (so e.g.
   * clicking a radio option in the editor doesn't auto-advance).
   * Outside selectableMode this is a passthrough.
   */
  const interact = (id: ElementId, originalOnClick?: (e: React.MouseEvent) => void) => {
    if (!selectableMode) {
      return { className: '', onClick: originalOnClick };
    }
    return {
      className: `${styles.selectable ?? ''} ${selectedElementId === id ? styles.canvasSelected ?? '' : ''}`.trim(),
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onSelectElement?.(id);
      },
    };
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [questionPath, setQuestionPath] = useState<number[]>([0]);
  const [completed, setCompleted] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [matchedPage, setMatchedPage] = useState<ResultPage | null>(null);
  const [sessionId] = useState(() => nanoid());
  const [submitting, setSubmitting] = useState(false);
  const [, setRating] = useState(0);
  const [capturedFields, setCapturedFields] = useState<Record<string, string>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [leadCaptureError, setLeadCaptureError] = useState<string | null>(null);

  const effectiveLeadFields = useMemo(
    () => resolveLeadFields(templateLeadFields, questionnaire.lead_fields),
    [templateLeadFields, questionnaire.lead_fields],
  );
  const customLeadFields = useMemo(
    () => effectiveLeadFields.filter(isCustomField),
    [effectiveLeadFields],
  );

  /** Aggregated lead-field values from all sources (URL params, custom
   *  inputs, and answers bound by `kind='question'` fields). Used both for
   *  webhook persistence in submitAndFinish and for variable resolution
   *  when rendering the result page. */
  const leadFieldValues = useMemo(() => {
    const values: Record<string, string> = { ...capturedFields };
    for (const [id, v] of Object.entries(customFieldValues)) {
      const trimmed = v.trim();
      if (trimmed) values[id] = trimmed;
    }
    for (const f of effectiveLeadFields) {
      if (f.kind !== 'question' || !f.questionId) continue;
      const ans = answers[f.questionId];
      if (!ans) continue;
      const value =
        ans.value ??
        (ans.selected_options && ans.selected_options.length > 0
          ? ans.selected_options.join(', ')
          : null);
      if (value) values[f.id] = value;
    }
    return values;
  }, [capturedFields, customFieldValues, effectiveLeadFields, answers]);

  // Capture URL-kind fields on mount (public only — preview ignores URL params).
  useEffect(() => {
    if (isPreview || effectiveLeadFields.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const captured: Record<string, string> = {};
    for (const f of effectiveLeadFields) {
      if ((f.kind ?? 'url') !== 'url' || !f.urlParam) continue;
      const v = params.get(f.urlParam);
      if (v) captured[f.id] = v;
    }
    setCapturedFields(captured);
  }, [isPreview, effectiveLeadFields]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? (questionPath.length / questions.length) * 100 : 0;

  const getBackgroundCSS = () => {
    if (design.background.type === 'gradient') return design.background.value;
    if (design.background.type === 'image')
      return `url(${design.background.value}) center/cover no-repeat`;
    return design.colors.background;
  };

  const getNextQuestionIndex = useCallback(
    (qIndex: number, answer: AnswersMap) => {
      const q = questions[qIndex];
      const qBranches = branches.filter((b) => b.question_id === q.id);

      for (const branch of qBranches) {
        if (branch.is_end) {
          const ans = answer[q.id];
          if (branch.condition.operator === 'equals') {
            if (
              ans?.selected_options?.includes(branch.condition.value) ||
              ans?.value === branch.condition.value
            ) {
              return -1;
            }
          }
        }
        if (branch.target_question_id) {
          const ans = answer[q.id];
          let matches = false;
          if (branch.condition.operator === 'equals') {
            matches =
              ans?.selected_options?.includes(branch.condition.value) ||
              ans?.value === branch.condition.value ||
              false;
          }
          if (matches) {
            const targetIdx = questions.findIndex((tq) => tq.id === branch.target_question_id);
            if (targetIdx >= 0) return targetIdx;
          }
        }
      }
      return qIndex + 1 < questions.length ? qIndex + 1 : -1;
    },
    [questions, branches],
  );

  const calculateScore = useCallback(
    (src: AnswersMap) => calculateTotalScore(questions, scoringRules, src),
    [questions, scoringRules],
  );

  const handleAnswer = (
    questionId: string,
    answer: { value?: string; selected_options?: string[] },
  ) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleRadioSelect = async (optionId: string) => {
    if (!currentQuestion || submitting) return;
    const newAnswers: AnswersMap = {
      ...answers,
      [currentQuestion.id]: { selected_options: [optionId] },
    };
    setAnswers(newAnswers);

    const nextIdx = getNextQuestionIndex(currentIndex, newAnswers);
    const reachedEnd = nextIdx === -1 || nextIdx >= questions.length;
    if (reachedEnd) {
      if (customLeadFields.length > 0 && !showLeadCapture) {
        setShowLeadCapture(true);
        return;
      }
      await submitAndFinish(newAnswers);
    } else {
      setCurrentIndex(nextIdx);
      setQuestionPath((prev) => [...prev, nextIdx]);
    }
  };

  const handleOptionSelect = (optionId: string) => {
    if (!currentQuestion) return;
    if (currentQuestion.type === 'checkbox') {
      const current = answers[currentQuestion.id]?.selected_options || [];
      const updated = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      handleAnswer(currentQuestion.id, { selected_options: updated });
    } else {
      handleAnswer(currentQuestion.id, { selected_options: [optionId] });
    }
  };

  const handleNext = async () => {
    const nextIdx = getNextQuestionIndex(currentIndex, answers);
    const reachedEnd = nextIdx === -1 || nextIdx >= questions.length;
    if (reachedEnd) {
      if (customLeadFields.length > 0 && !showLeadCapture) {
        setShowLeadCapture(true);
        return;
      }
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

  const handleLeadCaptureSubmit = async () => {
    const missing = customLeadFields.find(
      (f) => f.required && !(customFieldValues[f.id] ?? '').trim(),
    );
    if (missing) {
      setLeadCaptureError(`Please fill in: ${missing.label || 'required field'}`);
      return;
    }
    setLeadCaptureError(null);
    await submitAndFinish();
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setAnswers({});
    setQuestionPath([0]);
    setCompleted(false);
    setTotalScore(0);
    setMatchedPage(null);
    setSubmitting(false);
    setCustomFieldValues({});
    setShowLeadCapture(false);
    setLeadCaptureError(null);
  };

  const submitAndFinish = async (finalAnswers: AnswersMap = answers) => {
    setSubmitting(true);
    const score = calculateScore(finalAnswers);
    setTotalScore(score);

    const matched = resultPages.find((r) => score >= r.min_score && score <= r.max_score);
    setMatchedPage(matched || null);

    const redFlagCount = countRedFlags(questions, finalAnswers);
    const audienceList = audiences ?? [];
    const audienceId = assignAudience({
      totalScore: score,
      redFlagCount,
      redFlagThreshold: questionnaire.red_flag_threshold ?? null,
      redFlagAudienceId: questionnaire.red_flag_audience_id ?? null,
      audiences: audienceList,
    });
    const matchedAudience = audienceId
      ? audienceList.find((a) => a.id === audienceId) ?? null
      : null;

    // Rebuild lead-field values against `finalAnswers` rather than the
    // memoized snapshot — submitAndFinish may be called with a fresher
    // answers map than what's in state right now.
    const submitLeadFieldValues: Record<string, string> = { ...capturedFields };
    for (const [id, v] of Object.entries(customFieldValues)) {
      const trimmed = v.trim();
      if (trimmed) submitLeadFieldValues[id] = trimmed;
    }
    for (const f of effectiveLeadFields) {
      if (f.kind !== 'question' || !f.questionId) continue;
      const ans = finalAnswers[f.questionId];
      if (!ans) continue;
      const value =
        ans.value ??
        (ans.selected_options && ans.selected_options.length > 0
          ? ans.selected_options.join(', ')
          : null);
      if (value) submitLeadFieldValues[f.id] = value;
    }

    if (!isPreview) {
      try {
        const supabase = createClient();
        const responseId = crypto.randomUUID();
        const completedAtIso = new Date().toISOString();

        const payload = buildLeadPayload({
          responseId,
          sessionId,
          startedAt: completedAtIso,
          completedAt: completedAtIso,
          totalScore: score,
          matchedResult: matched ?? null,
          matchedAudience,
          host: typeof window !== 'undefined' ? window.location.hostname : null,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          questionnaire,
          templateLeadFields,
          questions,
          answers: finalAnswers,
          leadFieldValues: submitLeadFieldValues,
          scoringRules,
        });

        const { error: insertErr } = await supabase.from('responses').insert({
          id: responseId,
          questionnaire_id: questionnaire.id,
          session_id: sessionId,
          total_score: score,
          result_id: matched?.id || null,
          audience_id: audienceId,
          completed_at: completedAtIso,
          metadata: {
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            host: typeof window !== 'undefined' ? window.location.hostname : null,
            lead_fields: submitLeadFieldValues,
          },
        });

        if (!insertErr) {
          const answerRows = Object.entries(finalAnswers).map(([questionId, ans]) => {
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
              response_id: responseId,
              question_id: questionId,
              answer: ans,
              score: qScore,
              answered_at: new Date().toISOString(),
            };
          });
          await supabase.from('response_answers').insert(answerRows);

          // Fire-and-forget webhook delivery. The fire endpoint logs
          // per-destination status; we don't block the visitor on it.
          void fetch('/api/lead-webhooks/fire', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ response_id: responseId, payload }),
            keepalive: true,
          }).catch(() => {});
        }
      } catch (err) {
        console.error('Failed to save response:', err);
      }
    }

    setCompleted(true);
    setSubmitting(false);
  };

  const isAnswered = currentQuestion
    ? hasOptions(currentQuestion.type)
      ? (answers[currentQuestion.id]?.selected_options?.length ?? 0) > 0
      : !!answers[currentQuestion.id]?.value
    : false;
  const canProceed = !currentQuestion?.required || isAnswered;

  if (questions.length === 0) {
    return (
      <div
        className={styles.page}
        style={{
          background: getBackgroundCSS(),
          color: design.colors.text,
          fontFamily: design.typography.fontFamily,
        }}
      >
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>📝</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>No questions yet</h1>
          <p style={{ color: design.colors.textMuted }}>
            {isPreview ? 'Add questions in the Content tab first.' : 'This questionnaire is empty.'}
          </p>
        </div>
      </div>
    );
  }

  const pageInteract = interact('page');
  return (
    <div
      className={`${styles.page} ${pageInteract.className}`.trim()}
      onClick={pageInteract.onClick}
      style={{
        background: getBackgroundCSS(),
        color: design.typography.body?.color ?? design.colors.text,
        fontFamily: design.typography.fontFamily,
        fontSize: `${design.typography.body?.size ?? design.typography.baseFontSize}px`,
        fontWeight: design.typography.body?.weight ?? 400,
        lineHeight: design.typography.body?.lineHeight ?? design.typography.lineHeight,
        letterSpacing: `${design.typography.body?.letterSpacing ?? 0}em`,
        ...elementOverrideStyle(design, 'page'),
      }}
    >
      {isPreview && (
        <div className={styles.previewBanner}>
          <div className={styles.previewBannerInner}>
            <span className={styles.previewBadge}>👁 PREVIEW</span>
            <span className={styles.previewBannerText}>
              Preview mode — responses are not saved
            </span>
            <button className={styles.previewRestartBtn} onClick={handleRestart}>
              ↻ Restart
            </button>
          </div>
        </div>
      )}

      <div
        className={styles.container}
        style={{
          maxWidth: `${design.layout.maxWidth}px`,
          padding: `0 ${design.layout.padding}rem`,
        }}
      >
        {!completed ? (
          <>
            {/* Progress */}
            {(() => {
              const sel = interact('progress');
              return (
                <div
                  className={`${styles.progressWrap} ${sel.className}`.trim()}
                  onClick={sel.onClick}
                  style={{
                    marginBottom: `${design.layout.questionSpacing}rem`,
                    ...elementOverrideStyle(design, 'progress'),
                  }}
                >
                  <div className={styles.progressLabel} style={{ color: design.colors.textMuted }}>
                    <span>{questionnaire.title}</span>
                    <span>{showLeadCapture ? 100 : Math.round(progress)}%</span>
                  </div>
                  <div
                    className={styles.progressBar}
                    style={{
                      background: design.components.progress.background,
                      height: `${design.components.progress.height}px`,
                    }}
                  >
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${showLeadCapture ? 100 : progress}%`,
                        background: design.components.progress.fillColor,
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Lead-capture step */}
            {showLeadCapture && (() => {
              const cardSel = interact('questionCard');
              const titleSel = interact('questionTitle');
              const descSel = interact('questionDescription');
              return (
              <div
                className={`${styles.questionWrap} ${cardSel.className}`.trim()}
                onClick={cardSel.onClick}
                style={{
                  background: design.components.question.background,
                  border: design.components.question.border,
                  boxShadow: design.components.question.shadow,
                  padding: design.components.question.padding,
                  borderRadius: `${design.layout.borderRadius}px`,
                  ...elementOverrideStyle(design, 'questionCard'),
                }}
              >
                <h2
                  className={`${styles.questionTitle} ${titleSel.className}`.trim()}
                  onClick={titleSel.onClick}
                  style={{
                    fontFamily: design.typography.headingFont,
                    fontWeight: design.typography.heading?.weight ?? design.typography.headingWeight,
                    fontSize: `${design.typography.heading?.size ?? Math.round(design.typography.baseFontSize * 1.375)}px`,
                    lineHeight: design.typography.heading?.lineHeight ?? 1.2,
                    letterSpacing: `${design.typography.heading?.letterSpacing ?? -0.02}em`,
                    color: design.typography.heading?.color ?? design.colors.text,
                    ...elementOverrideStyle(design, 'questionTitle'),
                  }}
                >
                  Almost done
                </h2>
                <p
                  className={`${styles.questionDescription} ${descSel.className}`.trim()}
                  onClick={descSel.onClick}
                  style={{
                    color: design.colors.textMuted,
                    ...elementOverrideStyle(design, 'questionDescription'),
                  }}
                >
                  Tell us a little about yourself to see your result.
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.875rem',
                    marginTop: '1rem',
                  }}
                >
                  {customLeadFields.map((f) => (
                    <label
                      key={f.id}
                      style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}
                    >
                      <span
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: design.colors.text,
                        }}
                      >
                        {f.label}
                        {f.required && (
                          <span className={styles.requiredStar} aria-hidden>
                            *
                          </span>
                        )}
                      </span>
                      <input
                        className={styles.input}
                        type={f.inputType ?? 'text'}
                        value={customFieldValues[f.id] ?? ''}
                        onChange={(e) =>
                          setCustomFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                        }
                        required={f.required}
                        autoComplete={
                          f.inputType === 'email'
                            ? 'email'
                            : f.inputType === 'tel'
                              ? 'tel'
                              : undefined
                        }
                        style={{
                          background: design.components.input.background,
                          border: design.components.input.border,
                          borderRadius: `${design.components.input.borderRadius}px`,
                          color: design.colors.text,
                        }}
                      />
                    </label>
                  ))}

                  {leadCaptureError && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--error, #e44)' }}>
                      {leadCaptureError}
                    </div>
                  )}
                </div>
              </div>
              );
            })()}

            {/* Current Question */}
            {currentQuestion && !showLeadCapture && (() => {
              const cardSel = interact('questionCard');
              const titleSel = interact('questionTitle');
              const descSel = interact('questionDescription');
              return (
              <div
                className={`${styles.questionWrap} ${cardSel.className}`.trim()}
                onClick={cardSel.onClick}
                key={currentQuestion.id}
                style={{
                  background: design.components.question.background,
                  border: design.components.question.border,
                  boxShadow: design.components.question.shadow,
                  padding: design.components.question.padding,
                  borderRadius: `${design.layout.borderRadius}px`,
                  ...elementOverrideStyle(design, 'questionCard'),
                }}
              >
                <h2
                  className={`${styles.questionTitle} ${titleSel.className}`.trim()}
                  onClick={titleSel.onClick}
                  style={{
                    fontFamily: design.typography.headingFont,
                    fontWeight: design.typography.heading?.weight ?? design.typography.headingWeight,
                    fontSize: `${design.typography.heading?.size ?? Math.round(design.typography.baseFontSize * 1.375)}px`,
                    lineHeight: design.typography.heading?.lineHeight ?? 1.2,
                    letterSpacing: `${design.typography.heading?.letterSpacing ?? -0.02}em`,
                    color: design.typography.heading?.color ?? design.colors.text,
                    ...elementOverrideStyle(design, 'questionTitle'),
                  }}
                >
                  {currentQuestion.title}
                  {currentQuestion.required && <span className={styles.requiredStar}>*</span>}
                </h2>

                {currentQuestion.description && (
                  <p
                    className={`${styles.questionDescription} ${descSel.className}`.trim()}
                    onClick={descSel.onClick}
                    style={{
                      color: design.colors.textMuted,
                      ...elementOverrideStyle(design, 'questionDescription'),
                    }}
                  >
                    {currentQuestion.description}
                  </p>
                )}

                {hasOptions(currentQuestion.type) && (
                  <div
                    className={
                      currentQuestion.type === 'radio'
                        ? styles.optionsGrid
                        : styles.optionsList
                    }
                  >
                    {currentQuestion.options.map((opt) => {
                      const isSelected = answers[currentQuestion.id]?.selected_options?.includes(
                        opt.id,
                      );
                      const isRadio = currentQuestion.type === 'radio';
                      const optElementId: ElementId = isRadio ? 'radio.option' : 'checkbox.option';
                      const optSel = interact(optElementId, () =>
                        isRadio ? handleRadioSelect(opt.id) : handleOptionSelect(opt.id),
                      );
                      return (
                        <button
                          key={opt.id}
                          className={`${styles.optionButton} ${isSelected ? styles.selected : ''} ${isRadio ? styles.optionRadio : ''} ${optSel.className}`.trim()}
                          onClick={optSel.onClick}
                          disabled={isRadio && submitting}
                          style={{
                            background: isSelected
                              ? design.components.option.selectedBackground
                              : design.components.option.background,
                            border: isSelected
                              ? design.components.option.selectedBorder
                              : design.components.option.border,
                            borderRadius: `${design.layout.borderRadius * 0.6}px`,
                            color: design.colors.text,
                            ...elementOverrideStyle(design, optElementId),
                          }}
                        >
                          {!isRadio && (
                            <div
                              className={`${styles.optionIndicator} ${currentQuestion.type === 'checkbox' ? styles.checkbox : ''}`}
                              style={{ color: design.colors.accent }}
                            />
                          )}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === 'text' && (() => {
                  const sel = interact('text.input', (e: React.MouseEvent) => e.stopPropagation());
                  return (
                    <input
                      className={`${styles.input} ${sel.className}`.trim()}
                      onClick={sel.onClick}
                      value={answers[currentQuestion.id]?.value || ''}
                      onChange={(e) => handleAnswer(currentQuestion.id, { value: e.target.value })}
                      placeholder="Type your answer..."
                      style={{
                        background: design.components.input.background,
                        border: design.components.input.border,
                        borderRadius: `${design.components.input.borderRadius}px`,
                        color: design.colors.text,
                        ...elementOverrideStyle(design, 'text.input'),
                      }}
                    />
                  );
                })()}

                {currentQuestion.type === 'textarea' && (() => {
                  const sel = interact('textarea.input', (e: React.MouseEvent) => e.stopPropagation());
                  return (
                    <textarea
                      className={`${styles.textarea} ${sel.className}`.trim()}
                      onClick={sel.onClick}
                      value={answers[currentQuestion.id]?.value || ''}
                      onChange={(e) => handleAnswer(currentQuestion.id, { value: e.target.value })}
                      placeholder="Type your answer..."
                      style={{
                        background: design.components.input.background,
                        border: design.components.input.border,
                        borderRadius: `${design.components.input.borderRadius}px`,
                        color: design.colors.text,
                        ...elementOverrideStyle(design, 'textarea.input'),
                      }}
                    />
                  );
                })()}

                {currentQuestion.type === 'number' && (() => {
                  const sel = interact('text.input', (e: React.MouseEvent) => e.stopPropagation());
                  return (
                    <input
                      type="number"
                      className={`${styles.input} ${sel.className}`.trim()}
                      onClick={sel.onClick}
                      value={answers[currentQuestion.id]?.value || ''}
                      onChange={(e) => handleAnswer(currentQuestion.id, { value: e.target.value })}
                      placeholder="0"
                      style={{
                        background: design.components.input.background,
                        border: design.components.input.border,
                        borderRadius: `${design.components.input.borderRadius}px`,
                        color: design.colors.text,
                        maxWidth: '200px',
                        ...elementOverrideStyle(design, 'text.input'),
                      }}
                    />
                  );
                })()}

                {currentQuestion.type === 'email' && (() => {
                  const sel = interact('text.input', (e: React.MouseEvent) => e.stopPropagation());
                  return (
                    <input
                      type="email"
                      className={`${styles.input} ${sel.className}`.trim()}
                      onClick={sel.onClick}
                      value={answers[currentQuestion.id]?.value || ''}
                      onChange={(e) => handleAnswer(currentQuestion.id, { value: e.target.value })}
                      placeholder="email@example.com"
                      style={{
                        background: design.components.input.background,
                        border: design.components.input.border,
                        borderRadius: `${design.components.input.borderRadius}px`,
                        color: design.colors.text,
                        ...elementOverrideStyle(design, 'text.input'),
                      }}
                    />
                  );
                })()}

                {currentQuestion.type === 'rating' && (() => {
                  const sel = interact('rating.starsContainer');
                  return (
                    <div
                      className={`${styles.ratingStars} ${sel.className}`.trim()}
                      onClick={sel.onClick}
                      style={elementOverrideStyle(design, 'rating.starsContainer')}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          className={styles.ratingStar}
                          onClick={() => {
                            setRating(star);
                            handleAnswer(currentQuestion.id, { value: String(star) });
                          }}
                          style={{
                            color:
                              star <= (Number(answers[currentQuestion.id]?.value) || 0)
                                ? design.colors.accent
                                : design.colors.textMuted,
                          }}
                        >
                          {star <= (Number(answers[currentQuestion.id]?.value) || 0) ? '★' : '☆'}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
              );
            })()}

            {/* Navigation */}
            <div className={styles.navButtons} style={{ marginTop: `${design.layout.questionSpacing}rem` }}>
              <button
                className={styles.backBtn}
                onClick={() => {
                  if (showLeadCapture) {
                    setShowLeadCapture(false);
                    setLeadCaptureError(null);
                  } else {
                    handleBack();
                  }
                }}
                disabled={!showLeadCapture && questionPath.length <= 1}
                style={{ color: design.colors.textMuted }}
              >
                ← Back
              </button>
              {/* Radio questions auto-advance on click — Next button is redundant
                  there. Keep it for every other input type and the lead-capture step. */}
              {(showLeadCapture || currentQuestion?.type !== 'radio') && (() => {
                const sel = interact('button', showLeadCapture ? handleLeadCaptureSubmit : handleNext);
                return (
                  <button
                    className={`${styles.navBtn} ${sel.className}`.trim()}
                    onClick={sel.onClick}
                    disabled={(!showLeadCapture && !canProceed) || submitting}
                    style={{
                      background: design.components.button.background,
                      color: design.components.button.color,
                      borderRadius: `${design.components.button.borderRadius}px`,
                      padding: design.components.button.padding,
                      fontSize: `${design.components.button.fontSize}px`,
                      opacity: !showLeadCapture && !canProceed ? 0.5 : 1,
                      ...elementOverrideStyle(design, 'button'),
                    }}
                  >
                    {submitting
                      ? 'Submitting...'
                      : showLeadCapture
                        ? 'Submit'
                        : getNextQuestionIndex(currentIndex, answers) === -1
                          ? customLeadFields.length > 0
                            ? 'Continue'
                            : 'Submit'
                          : 'Next'}
                  </button>
                );
              })()}
            </div>
          </>
        ) : (
          /* Results — render the matched ResultPage's authored content
             tree, with all variable spans resolved against the visitor's
             score + answers + lead-field values. */
          (() => {
            const resultCtx: ResultRenderContext = {
              score: totalScore,
              page: matchedPage,
              answers: projectAnswers(questions, answers),
              leadFields: leadFieldValues,
            };
            return (
              <div className={styles.resultsPage}>
                {matchedPage ? (
                  <ResultPageRenderer page={matchedPage} ctx={resultCtx} design={design} />
                ) : (
                  /* No score range matched — minimal fallback. */
                  <>
                    <h1
                      className={styles.resultsTitle}
                      style={{
                        fontFamily: design.typography.headingFont,
                        fontWeight: design.typography.heading?.weight ?? design.typography.headingWeight,
                        letterSpacing: `${design.typography.heading?.letterSpacing ?? -0.02}em`,
                        color: design.typography.heading?.color ?? design.colors.text,
                      }}
                    >
                      Thank you!
                    </h1>
                    <p
                      className={styles.resultsDescription}
                      style={{ color: design.colors.textMuted }}
                    >
                      Your responses have been recorded.
                    </p>
                  </>
                )}

                {isPreview && (
                  <button className={styles.previewRestartBtnLarge} onClick={handleRestart}>
                    ↻ Restart preview
                  </button>
                )}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
