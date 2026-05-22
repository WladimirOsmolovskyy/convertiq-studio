'use client';

/**
 * Editor preview wrapper. Hands the shared renderer the preview CSS module and
 * sets mode='preview' (banner + restart UI + is_preview metadata bit).
 */

import QuestionnaireRenderer, {
  type QuestionnaireRendererProps,
} from '@/components/QuestionnaireRenderer';
import styles from './preview.module.css';

type Props = Omit<QuestionnaireRendererProps, 'styles' | 'mode' | 'templateLeadFields'>;

export default function PreviewRenderer(props: Props) {
  return <QuestionnaireRenderer {...props} styles={styles} mode="preview" />;
}
