'use client';

/**
 * Inspector panel — selection-driven properties for a single element.
 *
 * Sections + visual language match the user-provided screenshots
 * (Position / Size / Layout / Styles, alignment row, "+" bind-to-variable
 * buttons next to fields). Visual styling is borrowed from the Result
 * editor's inspector to stay consistent with the rest of the app.
 *
 * What's wired (Commit C):
 *   - Fill (background)  → design.elements[id].fill
 *   - Radius (radius)    → design.elements[id].radius
 *   - Padding (padding)  → design.elements[id].padding
 *
 * Everything else is rendered but disabled — future prompts add the rest.
 */

import {
  AlignLeft, AlignCenterHorizontal, AlignRight,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  AlignHorizontalSpaceBetween,
  ArrowLeftRight, ArrowUpDown,
  Plus, Minus, Square,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
} from 'lucide-react';
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

  // Pull resolved literal values out of overrides. VarRefs ignored (phase 2).
  const fillValue = typeof override.fill === 'string' ? override.fill : '';
  const radiusValue = typeof override.radius === 'number' ? override.radius : '';
  const paddingValue = typeof override.padding === 'number' ? override.padding : '';

  return (
    <>
      {/* Top alignment row — stub */}
      <div className={styles.alignRow}>
        <AlignBtn icon={<AlignLeft size={14} strokeWidth={1.75} />} label="Align left" disabled />
        <AlignBtn icon={<AlignCenterHorizontal size={14} strokeWidth={1.75} />} label="Align center horizontal" disabled />
        <AlignBtn icon={<AlignRight size={14} strokeWidth={1.75} />} label="Align right" disabled />
        <span className={styles.alignDivider} />
        <AlignBtn icon={<AlignVerticalJustifyStart size={14} strokeWidth={1.75} />} label="Align top" disabled />
        <AlignBtn icon={<AlignVerticalJustifyCenter size={14} strokeWidth={1.75} />} label="Align middle" disabled />
        <AlignBtn icon={<AlignVerticalJustifyEnd size={14} strokeWidth={1.75} />} label="Align bottom" disabled />
        <span className={styles.alignDivider} />
        <AlignBtn icon={<AlignHorizontalSpaceBetween size={14} strokeWidth={1.75} />} label="Distribute" disabled />
      </div>

      {/* Selection header */}
      <div className={styles.selectionHeader}>
        <span className={styles.selectionDot} />
        <span className={styles.selectionLabel}>{meta.label}</span>
        {meta.scope && <span className={styles.selectionScope}>in {meta.scope}</span>}
      </div>

      {/* Interactions — header-only stub */}
      <Section title="Interactions" headerAction="add" />

      {/* Link */}
      <Section title="Link" headerAction="add">
        <Field label="Link To" bindable disabled>
          <input className={styles.input} placeholder="Page or URL..." disabled />
        </Field>
      </Section>

      {/* Position */}
      <Section title="Position">
        <Field label="Type" disabled>
          <select className={styles.input} disabled defaultValue="relative">
            <option value="relative">Relative</option>
            <option value="absolute">Absolute</option>
            <option value="fixed">Fixed</option>
          </select>
        </Field>
      </Section>

      {/* Size */}
      <Section title="Size" headerAction="add">
        <Field label="Width" bindable disabled>
          <NumUnit value="100" unit="rel" units={['rel', 'px', 'fit', 'auto']} disabled />
        </Field>
        <Field label="Height" bindable disabled>
          <NumUnit value="" placeholder="321" unit="fit" units={['fit', 'px', 'rel', 'auto']} disabled />
        </Field>
        <Field label="Min Max" disabled>
          <div className={styles.swatchInput}>
            <ArrowLeftRight size={14} strokeWidth={1.75} color="var(--text-muted)" />
            <span className={styles.swatchPlaceholder}>Add...</span>
          </div>
        </Field>
      </Section>

      {/* Layout */}
      <Section title="Layout" headerAction="collapse">
        <Field label="Type" disabled>
          <div className={styles.segmented}>
            <button type="button" className={`${styles.segmentedBtn} ${styles.segmentedBtnActive}`} disabled>Stack</button>
            <button type="button" className={styles.segmentedBtn} disabled>Grid</button>
          </div>
        </Field>
        <Field label="Direction" bindable disabled>
          <div className={styles.segmented}>
            <button type="button" className={styles.segmentedBtn} disabled><ArrowLeftRight size={12} strokeWidth={1.75} /></button>
            <button type="button" className={`${styles.segmentedBtn} ${styles.segmentedBtnActive}`} disabled><ArrowUpDown size={12} strokeWidth={1.75} /></button>
          </div>
        </Field>
        <Field label="Distribute" bindable disabled>
          <select className={styles.input} disabled defaultValue="start">
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
            <option value="space-between">Space Between</option>
          </select>
        </Field>
        <Field label="Align" bindable disabled>
          <div className={styles.segmented}>
            <button type="button" className={styles.segmentedBtn} disabled><AlignStartVertical size={12} strokeWidth={1.75} /></button>
            <button type="button" className={`${styles.segmentedBtn} ${styles.segmentedBtnActive}`} disabled><AlignCenterVertical size={12} strokeWidth={1.75} /></button>
            <button type="button" className={styles.segmentedBtn} disabled><AlignEndVertical size={12} strokeWidth={1.75} /></button>
          </div>
        </Field>
        <Field label="Wrap" disabled>
          <div className={styles.segmented}>
            <button type="button" className={styles.segmentedBtn} disabled>Yes</button>
            <button type="button" className={`${styles.segmentedBtn} ${styles.segmentedBtnActive}`} disabled>No</button>
          </div>
        </Field>
        <Field label="Gap" bindable disabled>
          <div className={styles.sliderRow}>
            <input className={styles.input} defaultValue="24" disabled />
            <input type="range" className={styles.slider} min={0} max={64} defaultValue={24} disabled />
          </div>
        </Field>
        {/* Wired ↓ */}
        <Field label="Padding" bindable>
          <div className={styles.sliderRow}>
            <input
              type="number"
              className={styles.input}
              value={paddingValue}
              placeholder="0"
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
        </Field>
      </Section>

      {/* Styles */}
      <Section title="Styles" headerAction="add">
        <Field label="Opacity" bindable disabled>
          <div className={styles.sliderRow}>
            <input className={styles.input} defaultValue="1" disabled />
            <input type="range" className={styles.slider} min={0} max={1} step={0.05} defaultValue={1} disabled />
          </div>
        </Field>
        <Field label="Visible" bindable disabled>
          <div className={styles.segmented}>
            <button type="button" className={`${styles.segmentedBtn} ${styles.segmentedBtnActive}`} disabled>Yes</button>
            <button type="button" className={styles.segmentedBtn} disabled>No</button>
          </div>
        </Field>
        {/* Wired ↓ */}
        <Field label="Fill" bindable>
          <div className={styles.swatchInput}>
            <label
              className={styles.swatch}
              style={fillValue ? { background: fillValue, backgroundImage: 'none' } : undefined}
            >
              <input
                type="color"
                value={typeof fillValue === 'string' && /^#[0-9a-f]{6}$/i.test(fillValue) ? fillValue : '#ffffff'}
                onChange={(e) => setStyle({ fill: e.target.value })}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
              />
            </label>
            <input
              className={styles.input}
              style={{ border: 'none', padding: 0, background: 'transparent' }}
              value={fillValue}
              placeholder="Add..."
              onChange={(e) => setStyle({ fill: e.target.value || undefined })}
            />
          </div>
        </Field>
        <Field label="Overflow" bindable disabled>
          <select className={styles.input} disabled defaultValue="visible">
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
            <option value="auto">Auto</option>
            <option value="scroll">Scroll</option>
          </select>
        </Field>
        {/* Wired ↓ */}
        <Field label="Radius" bindable>
          <div className={styles.sliderRow}>
            <input
              type="number"
              className={styles.input}
              value={radiusValue}
              placeholder="0"
              min={0}
              onChange={(e) => {
                const v = e.target.value;
                setStyle({ radius: v === '' ? undefined : Number(v) });
              }}
            />
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button type="button" className={`${styles.segmentedBtn} ${styles.segmentedBtnActive}`} disabled style={{ padding: '0.25rem 0.4rem' }}>
                <Square size={12} strokeWidth={1.75} />
              </button>
              <button type="button" className={styles.segmentedBtn} disabled style={{ padding: '0.25rem 0.4rem' }}>
                <Square size={12} strokeWidth={1.25} />
              </button>
            </div>
          </div>
        </Field>
        <Field label="Border" disabled>
          <div className={styles.swatchInput}>
            <span className={styles.swatch} />
            <span className={styles.swatchPlaceholder}>Add...</span>
          </div>
        </Field>
        <Field label="Shadows" disabled>
          <div className={styles.swatchInput}>
            <span className={styles.swatch} />
            <span className={styles.swatchPlaceholder}>Add...</span>
          </div>
        </Field>
      </Section>
    </>
  );
}

/* ─── Section primitives ─────────────────────────────────────────── */

interface SectionProps {
  title: string;
  headerAction?: 'add' | 'collapse' | null;
  children?: React.ReactNode;
}

function Section({ title, headerAction, children }: SectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h4 className={styles.sectionTitle}>{title}</h4>
        {headerAction === 'add' && (
          <button type="button" className={styles.sectionAction} aria-label={`Add ${title}`} disabled>
            <Plus size={14} strokeWidth={2} />
          </button>
        )}
        {headerAction === 'collapse' && (
          <button type="button" className={styles.sectionAction} aria-label="Collapse section" disabled>
            <Minus size={14} strokeWidth={2} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  bindable?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

function Field({ label, bindable, disabled, children }: FieldProps) {
  return (
    <div className={`${styles.field} ${disabled ? styles.disabled : ''}`.trim()}>
      <span className={styles.fieldLabel}>
        {bindable && (
          <button type="button" className={styles.bindBtn} aria-label={`Bind ${label} to a variable`} disabled>
            <Plus size={10} strokeWidth={2.25} />
          </button>
        )}
        {label}
      </span>
      {children}
    </div>
  );
}

function AlignBtn({ icon, label, disabled }: { icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <button type="button" className={styles.alignBtn} aria-label={label} disabled={disabled}>
      {icon}
    </button>
  );
}

/** Number + unit-dropdown compact input. Stub in phase 1. */
function NumUnit({
  value, placeholder, unit, units, disabled,
}: {
  value: string; placeholder?: string; unit: string; units: string[]; disabled?: boolean;
}) {
  return (
    <div className={styles.numUnit}>
      <input
        type="text"
        defaultValue={value}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={disabled}
      />
      <select defaultValue={unit} disabled={disabled}>
        {units.map((u) => (
          <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>
        ))}
      </select>
    </div>
  );
}
