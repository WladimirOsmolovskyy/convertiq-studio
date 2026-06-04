'use client';

/**
 * Inspector panel — selection-driven properties for a single canvas element.
 *
 * Wired (real overrides on `design.elements[id]`):
 *   - Fill    → background
 *   - Radius  → border-radius
 *   - Padding → padding
 *
 * Each field shows an override dot + a ↺ restore button when it's locally
 * set; restoring clears the override so the element inherits its variable /
 * Brand-derived value again. Unbuilt properties (size, position, borders,
 * shadows, variable binding) are summarised in a muted footer rather than
 * rendered as dead controls.
 */

import { RotateCcw } from 'lucide-react';
import type { ElementId, ElementStyles } from '@/lib/types';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
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
  const paddingValue = paddingSet ? (override.padding as number) : '';

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
          <div className={styles.swatchInput}>
            <label
              className={styles.swatch}
              style={fillValue ? { background: fillValue, backgroundImage: 'none' } : undefined}
            >
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(fillValue) ? fillValue : '#ffffff'}
                onChange={(e) => setStyle({ fill: e.target.value })}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
              />
            </label>
            <input
              className={styles.input}
              style={{ border: 'none', padding: 0, background: 'transparent' }}
              value={fillValue}
              placeholder="Inherited"
              onChange={(e) => setStyle({ fill: e.target.value || undefined })}
            />
          </div>
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
              step={0.25}
              onChange={(e) => {
                const v = e.target.value;
                setStyle({ padding: v === '' ? undefined : Number(v) });
              }}
            />
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={4}
              step={0.125}
              value={typeof paddingValue === 'number' ? paddingValue : 0}
              onChange={(e) => setStyle({ padding: Number(e.target.value) })}
            />
          </div>
        </FieldRow>
      </div>

      <p className={styles.comingSoon}>
        Size, position, borders, shadows and variable binding are coming soon.
        Empty fields inherit from the questionnaire variables and Brand.
      </p>
    </>
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
