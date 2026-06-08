'use client';

/**
 * Result-page template gallery. A modal opened from the Pages tab: a grid of
 * a "Blank page" card plus every entry in the global RESULT_TEMPLATES library,
 * each with a live, brand-themed preview rendered through ResultPageRenderer.
 *
 * Picking a card creates the page in the store and hands the new id back so
 * the editor can select it.
 */

import { useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import ResultPageRenderer from '@/components/ResultPageRenderer';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { resolveDesign } from '@/lib/designResolve';
import { RESULT_TEMPLATES } from '@/lib/resultTemplates';
import { projectAnswers, type ResultRenderContext } from '@/lib/resultVariables';
import type { ResultPage } from '@/lib/types';
import styles from './result.module.css';

interface Props {
  onClose: () => void;
  onCreated: (pageId: string) => void;
}

/** Width the preview is laid out at before being scaled down to fit a card. */
const PREVIEW_BASE_WIDTH = 520;
const PREVIEW_SCALE = 0.4;

export default function TemplateGallery({ onClose, onCreated }: Props) {
  const { design, brand, questions, addResultPage, addResultPageFromTemplate } =
    useQuestionnaireStore();

  const resolvedDesign = useMemo(() => resolveDesign(design, brand), [design, brand]);

  const sampleCtx: ResultRenderContext = useMemo(
    () => ({ score: 75, page: null, answers: projectAnswers(questions, {}), leadFields: {} }),
    [questions],
  );

  // Build each template's preview page once (build() mints fresh ids).
  const previews = useMemo(
    () =>
      RESULT_TEMPLATES.map((tpl) => ({
        tpl,
        page: {
          id: `preview-${tpl.id}`,
          questionnaire_id: '',
          name: tpl.pageName,
          min_score: 0,
          max_score: 10,
          sort_order: 0,
          content: tpl.build(),
        } as ResultPage,
      })),
    [],
  );

  const pageBackground =
    design.background.type === 'image' ? undefined : design.background.value;

  const finish = (create: () => void) => {
    create();
    const fresh = useQuestionnaireStore.getState().resultPages;
    const newest = fresh[fresh.length - 1];
    if (newest) onCreated(newest.id);
    onClose();
  };

  return (
    <div className={styles.galleryOverlay} onClick={onClose}>
      <div
        className={styles.galleryModal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Result page templates"
      >
        <div className={styles.galleryHeader}>
          <span className={styles.galleryTitle}>New result page</span>
          <button className={styles.galleryClose} onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.galleryGrid}>
          {/* Blank */}
          <button className={styles.galleryCard} onClick={() => finish(addResultPage)}>
            <div className={styles.galleryBlankPreview}>
              <Plus size={22} strokeWidth={1.75} />
            </div>
            <div className={styles.galleryCardMeta}>
              <span className={styles.galleryCardName}>Blank page</span>
              <span className={styles.galleryCardDesc}>Start from an empty layout.</span>
            </div>
          </button>

          {/* Templates */}
          {previews.map(({ tpl, page }) => (
            <button
              key={tpl.id}
              className={styles.galleryCard}
              onClick={() => finish(() => addResultPageFromTemplate(tpl.id))}
            >
              <div className={styles.galleryPreview} style={{ background: pageBackground }}>
                <div
                  className={styles.galleryPreviewScale}
                  style={{
                    width: PREVIEW_BASE_WIDTH,
                    transform: `translateX(-50%) scale(${PREVIEW_SCALE})`,
                  }}
                >
                  <ResultPageRenderer
                    page={page}
                    ctx={sampleCtx}
                    design={resolvedDesign}
                    brand={brand}
                  />
                </div>
              </div>
              <div className={styles.galleryCardMeta}>
                <span className={styles.galleryCardName}>{tpl.name}</span>
                <span className={styles.galleryCardDesc}>{tpl.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
