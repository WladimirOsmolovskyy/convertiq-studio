'use client';

/**
 * Public-route wrapper. Hands the shared renderer the published CSS module and
 * sets mode='public'. All rendering logic lives in components/QuestionnaireRenderer.
 */

import QuestionnaireRenderer, {
  type QuestionnaireRendererProps,
} from '@/components/QuestionnaireRenderer';
import styles from './published.module.css';

type Props = Omit<QuestionnaireRendererProps, 'styles' | 'mode'>;

export default function QuestionnaireRendererPublic(props: Props) {
  return <QuestionnaireRenderer {...props} styles={styles} mode="public" />;
}
