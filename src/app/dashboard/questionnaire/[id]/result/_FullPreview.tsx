'use client';

/**
 * Full-screen, read-only preview of a single result page — rendered on the
 * page's actual background with sample data, exactly as a visitor would see
 * it after finishing. Opened from the canvas toolbar; closes on the X or Esc.
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import ResultPageRenderer from '@/components/ResultPageRenderer';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { resolveDesign } from '@/lib/designResolve';
import { projectAnswers, type ResultRenderContext } from '@/lib/resultVariables';
import type { ResultPage } from '@/lib/types';
import { pageBackgroundCss } from './_pageBackground';
import styles from './result.module.css';

interface Props {
  page: ResultPage;
  onClose: () => void;
}

export default function FullPreview({ page, onClose }: Props) {
  const { design, brand, questions } = useQuestionnaireStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const resolvedDesign = resolveDesign(design, brand);
  const ctx: ResultRenderContext = {
    score: 75,
    page,
    answers: projectAnswers(questions, {}),
    leadFields: {},
  };

  return createPortal(
    <div className={styles.previewOverlay} style={{ background: pageBackgroundCss(design, resolvedDesign) }}>
      <button className={styles.previewClose} onClick={onClose} aria-label="Close preview">
        <X size={18} strokeWidth={2} />
      </button>
      <div className={styles.previewScroll}>
        <ResultPageRenderer page={page} ctx={ctx} design={resolvedDesign} brand={brand} />
      </div>
    </div>,
    document.body,
  );
}
