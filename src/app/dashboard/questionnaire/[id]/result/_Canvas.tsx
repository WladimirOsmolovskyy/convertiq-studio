'use client';

/**
 * Center column of the Result editor: live-rendered selected page with
 * a click-to-select overlay, plus an "Add block" toolbar that drops new
 * nodes into the page's root frame.
 *
 * Authoring uses sample data for variable resolution so authors see
 * realistic content as they design. Real values are interpolated at
 * runtime in the public renderer.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import ResultPageRenderer from '@/components/ResultPageRenderer';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import {
  newFrameNode,
  newImageNode,
  newNavWithLogoNode,
  newSubtitleNode,
  newTextNode,
  newTitleNode,
  type ResultNode,
  type ResultPage,
} from '@/lib/types';
import { findNode, findParent } from '@/lib/resultPage';
import { projectAnswers, type ResultRenderContext } from '@/lib/resultVariables';
import styles from './result.module.css';

interface Props {
  page: ResultPage;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}

interface BlockOption {
  label: string;
  build: () => ResultNode;
}

const BLOCK_PRESETS: BlockOption[] = [
  { label: 'Nav with logo', build: newNavWithLogoNode },
  { label: 'Title', build: newTitleNode },
  { label: 'Subtitle', build: newSubtitleNode },
  { label: 'Text', build: newTextNode },
  { label: 'Image', build: newImageNode },
  { label: 'Frame', build: newFrameNode },
];

export default function Canvas({ page, selectedNodeId, onSelectNode }: Props) {
  const { design, questions, addResultPageNode } = useQuestionnaireStore();
  const [showBlockMenu, setShowBlockMenu] = useState(false);

  // Editor uses synthetic sample data so authors see real-looking content.
  const sampleCtx: ResultRenderContext = {
    score: 75,
    page,
    answers: projectAnswers(questions, {}),
    leadFields: {},
  };

  /** Where should a new block be inserted, given the current selection?
   *   - Selected node is a frame → inside it
   *   - Selected node is a leaf → as a sibling (= inside its parent)
   *   - Nothing selected         → into the root */
  const resolveAddTarget = (): string => {
    if (!selectedNodeId) return page.content.id;
    const selected = findNode(page.content, selectedNodeId);
    if (!selected) return page.content.id;
    if (selected.type === 'frame') return selected.id;
    const parent = findParent(page.content, selected.id);
    return parent?.id ?? page.content.id;
  };

  const handleAdd = (build: () => ResultNode) => {
    const node = build();
    addResultPageNode(page.id, resolveAddTarget(), node);
    setShowBlockMenu(false);
    onSelectNode(node.id);
  };

  return (
    <div className={styles.canvas}>
      <div className={styles.canvasToolbar}>
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowBlockMenu((v) => !v)}
          >
            <Plus size={12} strokeWidth={2.25} /> Add block
          </button>
          {showBlockMenu && (
            <>
              {/* Click-away catcher */}
              <div
                onClick={() => setShowBlockMenu(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 10,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  zIndex: 11,
                  background: 'var(--surface)',
                  border: '1px solid var(--separator)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                  minWidth: 260,
                }}
              >
                <div className={styles.blockMenu}>
                  {BLOCK_PRESETS.map((b) => (
                    <button
                      key={b.label}
                      className={styles.blockMenuItem}
                      onClick={() => handleAdd(b.build)}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {selectedNodeId
            ? `Next block → ${resolveAddTarget() === page.content.id ? 'root' : 'selected frame'}`
            : 'Sample preview · score 75'}
        </span>
      </div>

      <div className={styles.canvasStage} onClick={() => onSelectNode(null)}>
        <div className={styles.canvasFrame} onClick={(e) => e.stopPropagation()}>
          <ResultPageRenderer
            page={page}
            ctx={sampleCtx}
            design={design}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
          />
        </div>
      </div>
    </div>
  );
}
