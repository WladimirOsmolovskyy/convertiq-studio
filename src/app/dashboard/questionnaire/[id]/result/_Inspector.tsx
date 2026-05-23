'use client';

/**
 * Right rail of the Result editor. Shows properties for the currently
 * selected node (or page-level properties when nothing is selected),
 * plus a read-only reference list of available variables.
 *
 * Per node type:
 *   - frame: direction, gap, padding (linked), align, justify, bg, radius
 *   - text:  font size/weight, color, alignment, plus a span editor that
 *            mixes literal-text inputs with variable chips
 *   - image: src, alt, fit, radius
 *
 * Common: size mode + value (width/height), delete (root excluded).
 */

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import type {
  ResultFrameNode,
  ResultImageNode,
  ResultNode,
  ResultPage,
  ResultSize,
  ResultTextNode,
  TextSpan,
} from '@/lib/types';
import { canMoveNode, findNode } from '@/lib/resultPage';
import { listAvailableVariables, type AvailableVariable } from '@/lib/resultVariables';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import styles from './result.module.css';

interface Props {
  page: ResultPage;
  selectedNodeId: string | null;
}

export default function Inspector({ page, selectedNodeId }: Props) {
  const {
    questionnaire,
    questions,
    updateResultPage,
    updateResultPageNode,
    removeResultPageNode,
    moveResultPageNode,
  } = useQuestionnaireStore();

  const selectedNode = selectedNodeId ? findNode(page.content, selectedNodeId) : null;
  const isRoot = selectedNode?.id === page.content.id;

  const variables = useMemo(
    () => listAvailableVariables(questions, questionnaire?.lead_fields ?? []),
    [questions, questionnaire?.lead_fields],
  );

  /* ─── No selection: page properties ─────────────────────────── */
  if (!selectedNode) {
    return (
      <aside className={styles.inspector}>
        <PagePropsSection page={page} updateResultPage={updateResultPage} />
        <VariableReference variables={variables} />
      </aside>
    );
  }

  /* ─── Node selected ─────────────────────────────────────────── */
  const patch = (p: Partial<ResultNode>) => updateResultPageNode(page.id, selectedNode.id, p);

  return (
    <aside className={styles.inspector}>
      <div className={styles.inspectorSection}>
        <h4 className={styles.inspectorSectionTitle}>
          {selectedNode.type === 'frame' ? 'Frame' : selectedNode.type === 'text' ? 'Text' : 'Image'}
          {isRoot && ' (root)'}
        </h4>

        {selectedNode.type === 'frame' && (
          <FrameProps node={selectedNode} patch={patch} />
        )}
        {selectedNode.type === 'text' && (
          <TextProps node={selectedNode} patch={patch} variables={variables} />
        )}
        {selectedNode.type === 'image' && (
          <ImageProps node={selectedNode} patch={patch} />
        )}
      </div>

      {!isRoot && (
        <SizeSection node={selectedNode} patch={patch} />
      )}

      {!isRoot && (
        <div className={styles.inspectorSection}>
          <div className={styles.inspectorFieldRow}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => moveResultPageNode(page.id, selectedNode.id, 'up')}
              disabled={!canMoveNode(page.content, selectedNode.id, 'up')}
              title="Move up"
            >
              <ArrowUp size={12} strokeWidth={2} /> Up
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => moveResultPageNode(page.id, selectedNode.id, 'down')}
              disabled={!canMoveNode(page.content, selectedNode.id, 'down')}
              title="Move down"
            >
              <ArrowDown size={12} strokeWidth={2} /> Down
            </button>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--error)' }}
            onClick={() => removeResultPageNode(page.id, selectedNode.id)}
          >
            <Trash2 size={12} strokeWidth={2} /> Delete block
          </button>
        </div>
      )}

      <VariableReference variables={variables} />
    </aside>
  );
}

/* ───────────────────────────────────────────────────────────────── */

function PagePropsSection({
  page,
  updateResultPage,
}: {
  page: ResultPage;
  updateResultPage: (id: string, updates: Partial<ResultPage>) => void;
}) {
  return (
    <div className={styles.inspectorSection}>
      <h4 className={styles.inspectorSectionTitle}>Page</h4>
      <div className={styles.inspectorField}>
        <label className={styles.inspectorFieldLabel}>Name (internal)</label>
        <input
          className={styles.inspectorNumberInput}
          value={page.name}
          onChange={(e) => updateResultPage(page.id, { name: e.target.value })}
          placeholder="e.g. High scorers"
        />
      </div>
      <div className={styles.inspectorField}>
        <label className={styles.inspectorFieldLabel}>Score range</label>
        <div className={styles.inspectorFieldRow}>
          <input
            type="number"
            className={styles.inspectorNumberInput}
            value={page.min_score}
            onChange={(e) => updateResultPage(page.id, { min_score: Number(e.target.value) })}
          />
          <span style={{ flex: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
          <input
            type="number"
            className={styles.inspectorNumberInput}
            value={page.max_score}
            onChange={(e) => updateResultPage(page.id, { max_score: Number(e.target.value) })}
          />
        </div>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
        Select a block in the canvas to edit its properties.
      </p>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────── */

function FrameProps({
  node,
  patch,
}: {
  node: ResultFrameNode;
  patch: (p: Partial<ResultNode>) => void;
}) {
  return (
    <>
      <Segmented
        label="Direction"
        value={node.direction}
        options={[
          { value: 'column', label: 'Column' },
          { value: 'row', label: 'Row' },
        ]}
        onChange={(v) => patch({ direction: v as 'row' | 'column' })}
      />
      <Segmented
        label="Align"
        value={node.align}
        options={[
          { value: 'start', label: 'Start' },
          { value: 'center', label: 'Center' },
          { value: 'end', label: 'End' },
          { value: 'stretch', label: 'Stretch' },
        ]}
        onChange={(v) => patch({ align: v as ResultFrameNode['align'] })}
      />
      <Segmented
        label="Justify"
        value={node.justify}
        options={[
          { value: 'start', label: 'Start' },
          { value: 'center', label: 'Center' },
          { value: 'end', label: 'End' },
          { value: 'space-between', label: 'Between' },
        ]}
        onChange={(v) => patch({ justify: v as ResultFrameNode['justify'] })}
      />
      <div className={styles.inspectorField}>
        <label className={styles.inspectorFieldLabel}>Gap (px)</label>
        <input
          type="number"
          className={styles.inspectorNumberInput}
          value={node.gap}
          onChange={(e) => patch({ gap: Number(e.target.value) })}
        />
      </div>
      <div className={styles.inspectorField}>
        <label className={styles.inspectorFieldLabel}>Padding (px) — T R B L</label>
        <div className={styles.inspectorFieldRow}>
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <input
              key={side}
              type="number"
              className={styles.inspectorNumberInput}
              value={node.padding[side]}
              onChange={(e) =>
                patch({ padding: { ...node.padding, [side]: Number(e.target.value) } })
              }
            />
          ))}
        </div>
      </div>
      <div className={styles.inspectorField}>
        <label className={styles.inspectorFieldLabel}>Background</label>
        <input
          className={styles.inspectorNumberInput}
          value={node.background ?? ''}
          onChange={(e) => patch({ background: e.target.value || undefined })}
          placeholder="#ffffff or transparent"
        />
      </div>
      <div className={styles.inspectorField}>
        <label className={styles.inspectorFieldLabel}>Border radius (px)</label>
        <input
          type="number"
          className={styles.inspectorNumberInput}
          value={node.borderRadius ?? 0}
          onChange={(e) => patch({ borderRadius: Number(e.target.value) })}
        />
      </div>
    </>
  );
}

/* ───────────────────────────────────────────────────────────────── */

function TextProps({
  node,
  patch,
  variables,
}: {
  node: ResultTextNode;
  patch: (p: Partial<ResultNode>) => void;
  variables: AvailableVariable[];
}) {
  const setSpans = (spans: TextSpan[]) => patch({ spans });
  const updateSpan = (idx: number, span: TextSpan) =>
    setSpans(node.spans.map((s, i) => (i === idx ? span : s)));
  const removeSpan = (idx: number) =>
    setSpans(node.spans.filter((_, i) => i !== idx));
  const addText = () =>
    setSpans([...node.spans, { type: 'text', value: '' }]);
  const addVar = (key: string) =>
    setSpans([...node.spans, { type: 'var', key }]);

  return (
    <>
      <div className={styles.inspectorField}>
        <label className={styles.inspectorFieldLabel}>Content</label>
        <SpansEditor
          spans={node.spans}
          variables={variables}
          updateSpan={updateSpan}
          removeSpan={removeSpan}
          addText={addText}
          addVar={addVar}
        />
      </div>

      <Segmented
        label="Alignment"
        value={node.textAlign ?? 'left'}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ]}
        onChange={(v) => patch({ textAlign: v as 'left' | 'center' | 'right' })}
      />

      <div className={styles.inspectorField}>
        <label className={styles.inspectorFieldLabel}>Font size (px) · Weight</label>
        <div className={styles.inspectorFieldRow}>
          <input
            type="number"
            className={styles.inspectorNumberInput}
            value={node.fontSize ?? 16}
            onChange={(e) => patch({ fontSize: Number(e.target.value) })}
          />
          <input
            type="number"
            className={styles.inspectorNumberInput}
            value={node.fontWeight ?? 400}
            step={100}
            onChange={(e) => patch({ fontWeight: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className={styles.inspectorField}>
        <label className={styles.inspectorFieldLabel}>Color</label>
        <input
          className={styles.inspectorNumberInput}
          value={node.color ?? ''}
          onChange={(e) => patch({ color: e.target.value || undefined })}
          placeholder="#1d1d1f"
        />
      </div>
    </>
  );
}

function SpansEditor({
  spans,
  variables,
  updateSpan,
  removeSpan,
  addText,
  addVar,
}: {
  spans: TextSpan[];
  variables: AvailableVariable[];
  updateSpan: (idx: number, span: TextSpan) => void;
  removeSpan: (idx: number) => void;
  addText: () => void;
  addVar: (key: string) => void;
}) {
  const [varMenuOpen, setVarMenuOpen] = useState(false);

  return (
    <div className={styles.spansList}>
      {spans.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Empty — add text or a variable below.
        </div>
      )}
      {spans.map((span, idx) =>
        span.type === 'text' ? (
          <div key={idx} className={styles.spansRow}>
            <textarea
              value={span.value}
              onChange={(e) => updateSpan(idx, { type: 'text', value: e.target.value })}
              placeholder="Text…"
              rows={1}
            />
            <button
              className={styles.varChipRemove}
              onClick={() => removeSpan(idx)}
              aria-label="Remove text span"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div key={idx} className={styles.spansRow}>
            <span className={styles.varChip} style={{ flex: 1 }}>
              {variables.find((v) => v.key === span.key)?.label ?? span.key}
              <button
                className={styles.varChipRemove}
                onClick={() => removeSpan(idx)}
                aria-label="Remove variable"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          </div>
        ),
      )}

      <div className={styles.addSpan}>
        <button onClick={addText}>
          <Plus size={10} strokeWidth={2.25} /> Text
        </button>
        <div style={{ position: 'relative', flex: 1 }}>
          <button style={{ width: '100%' }} onClick={() => setVarMenuOpen((v) => !v)}>
            <Plus size={10} strokeWidth={2.25} /> Variable
          </button>
          {varMenuOpen && (
            <>
              <div
                onClick={() => setVarMenuOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 10 }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  zIndex: 11,
                  background: 'var(--surface)',
                  border: '1px solid var(--separator)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                  maxHeight: 280,
                  overflowY: 'auto',
                  minWidth: 220,
                }}
              >
                {variables.map((v) => (
                  <button
                    key={v.key}
                    className={styles.blockMenuItem}
                    style={{ width: '100%', borderRadius: 0, border: 'none', justifyContent: 'flex-start' }}
                    onClick={() => {
                      addVar(v.key);
                      setVarMenuOpen(false);
                    }}
                  >
                    <span className={styles.varChip} style={{ pointerEvents: 'none' }}>{v.label}</span>
                  </button>
                ))}
                {variables.length === 0 && (
                  <div style={{ padding: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    No variables available yet.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────── */

function ImageProps({
  node,
  patch,
}: {
  node: ResultImageNode;
  patch: (p: Partial<ResultNode>) => void;
}) {
  return (
    <>
      <div className={styles.inspectorField}>
        <label className={styles.inspectorFieldLabel}>Image URL</label>
        <input
          className={styles.inspectorNumberInput}
          value={node.src}
          onChange={(e) => patch({ src: e.target.value })}
          placeholder="https://…"
        />
      </div>
      <div className={styles.inspectorField}>
        <label className={styles.inspectorFieldLabel}>Alt text</label>
        <input
          className={styles.inspectorNumberInput}
          value={node.alt ?? ''}
          onChange={(e) => patch({ alt: e.target.value })}
        />
      </div>
      <Segmented
        label="Fit"
        value={node.fit ?? 'cover'}
        options={[
          { value: 'cover', label: 'Cover' },
          { value: 'contain', label: 'Contain' },
        ]}
        onChange={(v) => patch({ fit: v as 'cover' | 'contain' })}
      />
      <div className={styles.inspectorField}>
        <label className={styles.inspectorFieldLabel}>Border radius (px)</label>
        <input
          type="number"
          className={styles.inspectorNumberInput}
          value={node.borderRadius ?? 0}
          onChange={(e) => patch({ borderRadius: Number(e.target.value) })}
        />
      </div>
    </>
  );
}

/* ───────────────────────────────────────────────────────────────── */

function SizeSection({
  node,
  patch,
}: {
  node: ResultNode;
  patch: (p: Partial<ResultNode>) => void;
}) {
  return (
    <div className={styles.inspectorSection}>
      <h4 className={styles.inspectorSectionTitle}>Size</h4>
      <SizeRow
        label="Width"
        size={node.width}
        onChange={(width) => patch({ width })}
      />
      <SizeRow
        label="Height"
        size={node.height}
        onChange={(height) => patch({ height })}
      />
    </div>
  );
}

function SizeRow({
  label,
  size,
  onChange,
}: {
  label: string;
  size: ResultSize | undefined;
  onChange: (s: ResultSize | undefined) => void;
}) {
  const mode = size?.mode ?? 'fit';
  return (
    <div className={styles.inspectorField}>
      <label className={styles.inspectorFieldLabel}>{label}</label>
      <div className={styles.inspectorFieldRow}>
        <select
          className={styles.inspectorNumberInput}
          value={mode}
          onChange={(e) => {
            const newMode = e.target.value as ResultSize['mode'];
            if (newMode === 'fit') {
              onChange(undefined);
            } else if (newMode === 'fixed') {
              onChange({ mode: 'fixed', value: size?.value ?? 120 });
            } else {
              onChange({ mode: 'fill' });
            }
          }}
        >
          <option value="fit">Fit content</option>
          <option value="fill">Fill</option>
          <option value="fixed">Fixed</option>
        </select>
        {mode === 'fixed' && (
          <input
            type="number"
            className={styles.inspectorNumberInput}
            value={size?.value ?? 0}
            onChange={(e) => onChange({ mode: 'fixed', value: Number(e.target.value) })}
          />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────── */

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.inspectorField}>
      <label className={styles.inspectorFieldLabel}>{label}</label>
      <div className={styles.segmented}>
        {options.map((opt) => (
          <button
            key={opt.value}
            className={`${styles.segmentedBtn} ${value === opt.value ? styles.segmentedBtnActive : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────── */

function VariableReference({ variables }: { variables: AvailableVariable[] }) {
  const groups: { title: string; group: AvailableVariable['group'] }[] = [
    { title: 'Score', group: 'score' },
    { title: 'Page', group: 'page' },
    { title: 'Answers', group: 'answer' },
    { title: 'Lead fields', group: 'lead' },
  ];
  return (
    <div className={styles.inspectorSection}>
      <h4 className={styles.inspectorSectionTitle}>Available variables</h4>
      {groups.map((g) => {
        const items = variables.filter((v) => v.group === g.group);
        if (items.length === 0) return null;
        return (
          <div key={g.group} className={styles.varGroup}>
            <span className={styles.varGroupTitle}>{g.title}</span>
            <div>
              {items.map((v) => (
                <span key={v.key} className={styles.varListChip} title={v.key}>
                  {v.label}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
