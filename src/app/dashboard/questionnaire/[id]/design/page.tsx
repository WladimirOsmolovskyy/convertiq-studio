'use client';

/**
 * Design tab — selection-driven inspector + global variables, two-tab layout.
 *
 *   Variables tab → the GLOBAL design tokens (colors, typography, layout,
 *                   background, button, progress, presets). Was the only
 *                   thing in this tab before.
 *   Inspector tab → per-element overrides for the currently selected
 *                   canvas element. UI shell is in place; controls are
 *                   stubbed/disabled until Commit C wires them.
 *
 * Selection state is local to this shell. Default selection is `null` —
 * the Inspector tab shows an empty-state hint until canvas click lands
 * in Commit B.
 */

import { useState } from 'react';
import type { ElementId } from '@/lib/types';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import PreviewRenderer from '../PreviewRenderer';
import PreviewViewportShell from '../PreviewViewportShell';
import VariablesPanel from './_VariablesPanel';
import InspectorPanel from './_InspectorPanel';
import styles from './design.module.css';

type Tab = 'variables' | 'inspector';

export default function DesignEditor() {
  const store = useQuestionnaireStore();
  const [tab, setTab] = useState<Tab>('variables');
  const [selectedElementId, setSelectedElementId] = useState<ElementId | null>(null);

  // Selecting on the canvas auto-switches to the Inspector tab so the user
  // sees the relevant properties immediately.
  const handleSelectElement = (id: ElementId) => {
    setSelectedElementId(id);
    setTab('inspector');
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.leftPanel}>
        <div className={styles.tabStrip}>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === 'variables' ? styles.tabBtnActive : ''}`}
            onClick={() => setTab('variables')}
            aria-pressed={tab === 'variables'}
          >
            Variables
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === 'inspector' ? styles.tabBtnActive : ''}`}
            onClick={() => setTab('inspector')}
            aria-pressed={tab === 'inspector'}
          >
            Inspector
          </button>
        </div>
        <div className={styles.panelBody}>
          {tab === 'variables'
            ? <VariablesPanel />
            : <InspectorPanel selectedElementId={selectedElementId} />}
        </div>
      </aside>

      <PreviewViewportShell>
        {store.questionnaire ? (
          <PreviewRenderer
            questionnaire={store.questionnaire}
            questions={store.questions}
            branches={store.branches}
            scoringRules={store.scoringRules}
            resultPages={store.resultPages}
            design={store.design}
            selectableMode
            selectedElementId={selectedElementId}
            onSelectElement={handleSelectElement}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <p>Loading questionnaire...</p>
          </div>
        )}
      </PreviewViewportShell>
    </div>
  );
}
