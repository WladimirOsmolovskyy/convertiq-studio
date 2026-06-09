'use client';

/**
 * Inspector panel — selection-driven properties for a single canvas element.
 *
 * Wired (real overrides on `design.elements[id]`):
 *   - Fill    → background
 *   - Radius  → border-radius
 *   - Padding → padding
 *   - Active state (options only) → selected fill + border color
 *
 * Each field shows an override dot + a ↺ restore button when it's locally
 * set; restoring clears the override so the element inherits its variable /
 * Brand-derived value again. Unbuilt properties (size, position, borders,
 * shadows, variable binding) are summarised in a muted footer rather than
 * rendered as dead controls.
 */

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { ElementId, ElementStyles } from '@/lib/types';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { parseColor, buildColor } from '@/lib/color';
import styles from './design.module.css';

const ELEMENT_LABELS: Record<ElementId, { label: string; scope?: string }> = {
  page: { label: 'Page' },
  container: { label: 'Container' },
  progress: { label: 'Progress Bar' },
  navButtons: { label: 'Navigation' },
  button: { label: 'Primary Button' },
  questionCard: { label: 'Question Card' },
  questionTitle: { label: 'Question Title' },
  questionDescription: { label: 'Question Description' },
  'radio.optionsGrid': { label: 'Options Grid', scope: 'Radio' },
  'radio.option': { label: 'Option', scope: 'Radio' },
  'checkbox.optionsList': { label: 'Options List', scope: 'Checkbox' },
  'checkbox.option': { label: 'Option', scope: 'Checkbox' },
  'text.input': { label: 'Input', scope: 'Text' },
  'textarea.input': { label: 'Input', scope: 'Textarea' },
  'rating.starsContainer': { label: 'Stars Row', scope: 'Rating' },
  'rating.star': { label: 'Star', scope: 'Rating' },
};

interface Props {
  selectedElementId: ElementId | null;
}

export default function InspectorPanel({ selectedElementId }: Props) {
  const { design, updateElementStyle } = useQuestionnaireStore();

  if (!selectedElementId) {
    return (
      <div className={styles.emptyState}>
        Click an element on the canvas
        <br />
        to edit its properties.
      </div>
    );
  }

  const meta = ELEMENT_LABELS[selectedElementId];
  const override: ElementStyles = design.elements?.[selectedElementId] ?? {};
  const setStyle = (partial: Partial<ElementStyles>) =>
    updateElementStyle(selectedElementId, partial);

  const fillSet = typeof override.fill === 'string';
  const radiusSet = typeof override.radius === 'number';
  const paddingSet = typeof override.padding === 'number';
  const fillValue = fillSet ? (override.fill as string) : '';
  const radiusValue = radiusSet ? (override.radius as number) : '';
  const paddingValue = paddingSet ? Math.round((override.padding as number) * 16) : '';

  // Active/selected-state overrides — only answer options have a selected look.
  const isOption = selectedElementId === 'radio.option' || selectedElementId === 'checkbox.option';
  const selFillSet = typeof override.selectedFill === 'string';
  const selBorderSet = typeof override.selectedBorder === 'string';
  const selFillValue = selFillSet ? (override.selectedFill as string) : '';
  const selBorderValue = selBorderSet ? (override.selectedBorder as string) : '';

  return (
    <>
      {/* Selection header */}
      <div className={styles.selectionHeader}>
        <span className={styles.selectionDot} />
        <span className={styles.selectionLabel}>{meta.label}</span>
        {meta.scope && <span className={styles.selectionScope}>in {meta.scope}</span>}
      </div>

      {/* Styles */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>Styles</h4>
        </div>

        <FieldRow label="Fill" overridden={fillSet} onRestore={() => setStyle({ fill: undefined })}>
          <FillControl
            key={selectedElementId}
            value={fillValue}
            onChange={(v) => setStyle({ fill: v })}
          />
        </FieldRow>

        <FieldRow label="Radius" overridden={radiusSet} onRestore={() => setStyle({ radius: undefined })}>
          <input
            type="number"
            className={styles.input}
            value={radiusValue}
            placeholder="Inherited"
            min={0}
            onChange={(e) => {
              const v = e.target.value;
              setStyle({ radius: v === '' ? undefined : Number(v) });
            }}
          />
        </FieldRow>
      </div>

      {/* Layout */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>Layout</h4>
        </div>

        <FieldRow label="Padding" overridden={paddingSet} onRestore={() => setStyle({ padding: undefined })}>
          <div className={styles.sliderRow}>
            <input
              type="number"
              className={styles.input}
              value={paddingValue}
              placeholder="Inherited"
              min={0}
              step={2}
              onChange={(e) => {
                const v = e.target.value;
                setStyle({ padding: v === '' ? undefined : Number(v) / 16 });
              }}
            />
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={64}
              step={2}
              value={typeof paddingValue === 'number' ? paddingValue : 0}
              onChange={(e) => setStyle({ padding: Number(e.target.value) / 16 })}
            />
          </div>
        </FieldRow>
      </div>

      {isOption && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h4 className={styles.sectionTitle}>Active state</h4>
          </div>
          <FieldRow label="Fill" overridden={selFillSet} onRestore={() => setStyle({ selectedFill: undefined })}>
            <FillControl
              key={`${selectedElementId}:selFill`}
              value={selFillValue}
              onChange={(v) => setStyle({ selectedFill: v })}
            />
          </FieldRow>
          <FieldRow label="Border" overridden={selBorderSet} onRestore={() => setStyle({ selectedBorder: undefined })}>
            <FillControl
              key={`${selectedElementId}:selBorder`}
              value={selBorderValue}
              onChange={(v) => setStyle({ selectedBorder: v })}
            />
          </FieldRow>
        </div>
      )}

      <p className={styles.comingSoon}>
        Size, position, borders, shadows and variable binding are coming soon.
        Empty fields inherit from the questionnaire variables and Brand.
      </p>
    </>
  );
}

/** Fill = element background color + opacity. Empty value means "inherited"
 *  (no override). Keeps local hex text so partial typing isn't clobbered;
 *  remounted via `key` when the selected element changes. */
function FillControl({
  value, onChange,
}: {
  value: string;
  onChange: (v: string | undefined) => void;
}) {
  const isSet = value !== '';
  const { rgb, alpha } = parseColor(value || '#000000');
  const [hexText, setHexText] = useState(isSet ? rgb : '');

  const onPick = (newRgb: string) => {
    setHexText(newRgb);
    onChange(buildColor(newRgb, isSet ? alpha : 100));
  };
  const onHexText = (t: string) => {
    setHexText(t);
    if (t === '') onChange(undefined);
    else if (/^#[0-9a-fA-F]{6}$/.test(t)) onChange(buildColor(t, isSet ? alpha : 100));
  };

  return (
    <div className={styles.fillControl}>
      <div className={styles.swatchInput}>
        <label className={styles.swatch}>
          {isSet && <span className={styles.swatchFill} style={{ backgroundColor: value }} />}
          <input
            type="color"
            value={rgb}
            onChange={(e) => onPick(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
          />
        </label>
        <input
          className={styles.input}
          style={{ border: 'none', padding: 0, background: 'transparent' }}
          value={hexText}
          placeholder="Inherited"
          spellCheck={false}
          onChange={(e) => onHexText(e.target.value)}
        />
      </div>
      {isSet && (
        <div className={styles.fillOpacity}>
          <input
            type="range"
            className={styles.opacitySlider}
            min={0}
            max={100}
            value={alpha}
            onChange={(e) => onChange(buildColor(rgb, Number(e.target.value)))}
            aria-label="Fill opacity (%)"
          />
          <span className={styles.opacityPct}>{alpha}%</span>
        </div>
      )}
    </div>
  );
}

/* ─── Field row with override dot + restore ──────────────────────── */
function FieldRow({
  label, overridden, onRestore, children,
}: {
  label: string;
  overridden: boolean;
  onRestore: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {overridden && <span className={styles.overrideDot} title="Overridden" />}
      </span>
      <div className={styles.fieldControl}>
        {children}
        {overridden && (
          <button
            type="button"
            className={styles.restoreBtn}
            onClick={onRestore}
            title="Restore (inherit)"
            aria-label={`Restore ${label} to inherited value`}
          >
            <RotateCcw size={12} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
