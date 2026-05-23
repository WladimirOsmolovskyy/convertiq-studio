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

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Hash, Mail, Plus, Search, Trash2, Type, X } from 'lucide-react';
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
  // Normalize: each text node has at most ONE text span (at index 0)
  // followed by variable spans. Legacy nodes with interleaved text spans
  // get their text portions concatenated on read.
  const literalText = node.spans
    .filter((s): s is { type: 'text'; value: string } => s.type === 'text')
    .map((s) => s.value)
    .join('');
  const varSpans = node.spans.filter(
    (s): s is { type: 'var'; key: string } => s.type === 'var',
  );

  const setText = (value: string) => {
    const next: TextSpan[] = [];
    if (value.length > 0) next.push({ type: 'text', value });
    next.push(...varSpans);
    patch({ spans: next });
  };
  const removeVarAt = (varIdx: number) => {
    const nextVars = varSpans.filter((_, i) => i !== varIdx);
    const next: TextSpan[] = [];
    if (literalText.length > 0) next.push({ type: 'text', value: literalText });
    next.push(...nextVars);
    patch({ spans: next });
  };
  const addVar = (key: string) => {
    const next: TextSpan[] = [];
    if (literalText.length > 0) next.push({ type: 'text', value: literalText });
    next.push(...varSpans, { type: 'var', key });
    patch({ spans: next });
  };

  return (
    <>
      <SpansEditor
        text={literalText}
        varSpans={varSpans}
        variables={variables}
        setText={setText}
        removeVarAt={removeVarAt}
        addVar={addVar}
      />


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
  text,
  varSpans,
  variables,
  setText,
  removeVarAt,
  addVar,
}: {
  text: string;
  varSpans: { type: 'var'; key: string }[];
  variables: AvailableVariable[];
  setText: (value: string) => void;
  removeVarAt: (varIdx: number) => void;
  addVar: (key: string) => void;
}) {
  const [varMenuOpen, setVarMenuOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className={styles.spansList}>
      <label className={styles.inspectorFieldLabel}>Content</label>
      <div className={styles.spansFieldRow}>
        <div className={styles.addVarWrap}>
          <button
            ref={addBtnRef}
            className={styles.addVarBtn}
            onClick={() => setVarMenuOpen((v) => !v)}
            aria-label="Insert variable"
            title="Insert variable"
          >
            <Plus size={12} strokeWidth={2.5} />
          </button>
        </div>
        <div className={styles.spansField}>
          <textarea
            className={styles.spansTextarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type text…"
            rows={2}
          />
          {varSpans.length > 0 && (
            <div className={styles.spansChips}>
              {varSpans.map((span, idx) => (
                <VariableChip
                  key={idx}
                  variable={variables.find((v) => v.key === span.key)}
                  fallbackKey={span.key}
                  onRemove={() => removeVarAt(idx)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {varMenuOpen && (
        <VariablePicker
          variables={variables}
          anchorRef={addBtnRef}
          onPick={(key) => {
            addVar(key);
            setVarMenuOpen(false);
          }}
          onClose={() => setVarMenuOpen(false)}
        />
      )}
    </div>
  );
}

/** Visual chip representing a bound variable. Used both inline in the
 *  spans editor and (in larger form) inside the picker dropdown. */
function VariableChip({
  variable,
  fallbackKey,
  onRemove,
}: {
  variable: AvailableVariable | undefined;
  fallbackKey: string;
  onRemove?: () => void;
}) {
  const group = variable?.group;
  return (
    <span className={styles.varChip} style={{ flex: 1 }}>
      <span className={styles.varChipIcon} aria-hidden>
        <GroupIcon group={group} />
      </span>
      <span className={styles.varChipLabel}>
        {variable?.label ?? fallbackKey}
      </span>
      {onRemove && (
        <button
          className={styles.varChipRemove}
          onClick={onRemove}
          aria-label="Remove variable"
        >
          <X size={11} strokeWidth={2.25} />
        </button>
      )}
    </span>
  );
}

function GroupIcon({ group }: { group: AvailableVariable['group'] | undefined }) {
  if (group === 'score') return <Hash size={11} strokeWidth={2} />;
  if (group === 'answer') return <Type size={11} strokeWidth={2} />;
  if (group === 'lead') return <Mail size={11} strokeWidth={2} />;
  return <Hash size={11} strokeWidth={2} />;
}

const GROUP_TITLES: Record<AvailableVariable['group'], string> = {
  score: 'Score',
  page: 'Page',
  answer: 'Answers',
  lead: 'Lead fields',
};

/** Search-able, grouped variable picker. Rendered via portal so it
 *  escapes the rail's overflow:hidden clipping. Positions itself
 *  anchored to the trigger button's bounding rect, with viewport-edge
 *  fitting so it never gets clipped off-screen. */
function VariablePicker({
  variables,
  anchorRef,
  onPick,
  onClose,
}: {
  variables: AvailableVariable[];
  anchorRef: React.RefObject<HTMLElement | null>;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q
    ? variables.filter(
        (v) => v.label.toLowerCase().includes(q) || v.key.toLowerCase().includes(q),
      )
    : variables;

  const groupOrder: AvailableVariable['group'][] = ['score', 'page', 'answer', 'lead'];

  // Compute fixed-position coordinates anchored to the trigger button
  // in an effect (refs aren't readable during render). The picker is
  // first rendered off-screen, then snapped into place after mount.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    const PICKER_W = 260;
    const PICKER_H = 320;
    const GAP = 4;
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = r.left;
    let top = r.bottom + GAP;
    // Fit to viewport: shift left so the right edge stays inside, then
    // flip above the anchor if there's no room below.
    if (left + PICKER_W > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - PICKER_W - 8);
    }
    if (top + PICKER_H > window.innerHeight - 8) {
      top = Math.max(8, r.top - PICKER_H - GAP);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos({ top, left });
  }, [anchorRef]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
      />
      <div
        className={styles.varPicker}
        style={{
          position: 'fixed',
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          right: 'auto',
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        <div className={styles.varPickerSearch}>
          <Search size={12} strokeWidth={1.75} aria-hidden />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            aria-label="Search variables"
          />
        </div>
        <div className={styles.varPickerBody}>
          {filtered.length === 0 ? (
            <div className={styles.varPickerEmpty}>No variables match.</div>
          ) : (
            groupOrder.map((group) => {
              const items = filtered.filter((v) => v.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className={styles.varPickerSection}>
                  <div className={styles.varPickerSectionTitle}>
                    {GROUP_TITLES[group]}
                  </div>
                  {items.map((v) => (
                    <button
                      key={v.key}
                      className={styles.varPickerItem}
                      onClick={() => onPick(v.key)}
                    >
                      <span className={styles.varPickerItemIcon} aria-hidden>
                        <GroupIcon group={v.group} />
                      </span>
                      <span className={styles.varPickerItemLabel}>{v.label}</span>
                      <span className={styles.varPickerItemKey}>{v.key}</span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body,
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

