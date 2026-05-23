'use client';

import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import PreviewRenderer from '../PreviewRenderer';
import PreviewViewportShell from '../PreviewViewportShell';

export default function PreviewPage() {
  const store = useQuestionnaireStore();

  if (!store.questionnaire) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        <p>Loading questionnaire...</p>
      </div>
    );
  }

  return (
    <PreviewViewportShell>
      <PreviewRenderer
        questionnaire={store.questionnaire}
        questions={store.questions}
        branches={store.branches}
        scoringRules={store.scoringRules}
        resultPages={store.resultPages}
        design={store.design}
        audiences={store.audiences}
      />
    </PreviewViewportShell>
  );
}
