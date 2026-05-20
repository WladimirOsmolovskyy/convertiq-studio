'use client';

import { useState } from 'react';
import { X, Pencil, Check } from 'lucide-react';
import { useEditorStore } from '../_store/editor';
import styles from '../ads.module.css';

export default function VariablesPanel() {
  const variables = useEditorStore((s) => s.variables);
  const renameVariable = useEditorStore((s) => s.renameVariable);
  const removeVariable = useEditorStore((s) => s.removeVariable);
  const setSelected = useEditorStore((s) => s.setSelected);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');

  if (variables.length === 0) {
    return (
      <div className={styles.varsPanel}>
        <div className={styles.varsTitle}>Variables</div>
        <div className={styles.varsEmpty}>
          Click the link icon next to any text, font, size, or color to make it a variable.
        </div>
      </div>
    );
  }

  const startEdit = (id: string, label: string) => {
    setEditingId(id);
    setDraftLabel(label);
  };
  const commitEdit = (id: string) => {
    const next = draftLabel.trim();
    if (next) renameVariable(id, next);
    setEditingId(null);
  };

  const typeLabel: Record<string, string> = {
    text: 'text',
    number: 'number',
    color: 'color',
  };

  return (
    <div className={styles.varsPanel}>
      <div className={styles.varsTitle}>Variables · {variables.length}</div>
      <div className={styles.varsList}>
        {variables.map((v) => (
          <div key={v.id} className={styles.varsRow}>
            <button
              className={styles.varsRowName}
              onClick={() => setSelected(v.nodeId)}
              title="Select bound layer"
            >
              {editingId === v.id ? (
                <input
                  className={styles.varsRename}
                  autoFocus
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                  onBlur={() => commitEdit(v.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(v.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className={styles.varsLabel}>{v.label}</span>
                  <span className={styles.varsKind}>{typeLabel[v.type]}</span>
                </>
              )}
            </button>
            {editingId === v.id ? (
              <button
                className={styles.varsAction}
                onClick={() => commitEdit(v.id)}
                title="Save label"
              >
                <Check size={12} strokeWidth={2.25} />
              </button>
            ) : (
              <button
                className={styles.varsAction}
                onClick={(e) => { e.stopPropagation(); startEdit(v.id, v.label); }}
                title="Rename"
              >
                <Pencil size={11} strokeWidth={2} />
              </button>
            )}
            <button
              className={styles.varsAction}
              onClick={(e) => { e.stopPropagation(); removeVariable(v.id); }}
              title="Remove variable"
            >
              <X size={12} strokeWidth={2.25} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
