'use client';

/**
 * Inspector panel — selection-driven properties for a single element.
 *
 * UI shell (this commit / phase 1):
 *   - Section structure + visual language matches the screenshots the user
 *     provided (Position / Size / Layout / Styles, alignment row, "+" bind-to-
 *     variable buttons next to fields).
 *   - Most controls are DISABLED + greyed out. They render so the design
 *     direction is visible, but won't be wired until Commit C.
 *   - Selection wiring (clicking on the canvas to populate this) lands in
 *     Commit B — for now `selectedElementId` is passed in by the parent and
 *     defaults to 'page'.
 */

import {
  AlignLeft, AlignCenterHorizontal, AlignRight,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  AlignHorizontalSpaceBetween,
  ArrowLeftRight, ArrowUpDown,
  Plus, Minus, Square,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
} from 'lucide-react';
import type { ElementId } from '@/lib/types';
import styles from './design.module.css';

/** Display metadata for each selectable element. Scope is shown as a small
 *  badge in the header so the user knows e.g. "Option" is being edited
 *  inside the Radio question type. */
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

  return (
    <>
      {/* Top alignment row — visual only for now */}
      <div className={`${styles.alignRow} ${styles.disabled}`}>
        <button type="button" className={styles.alignBtn} aria-label="Align left" disabled>
          <AlignLeft size={14} strokeWidth={1.75} />
        </button>
        <button type="button" className={styles.alignBtn} aria-label="Align center horizontal" disabled>
          <AlignCenterHorizontal size={14} strokeWidth={1.75} />
        </button>
        <button type="button" className={styles.alignBtn} aria-label="Align right" disabled>
          <AlignRight size={14} strokeWidth={1.75} />
        </button>
        <span className={styles.alignDivider} />
        <button type="button" className={styles.alignBtn} aria-label="Align top" disabled>
          <AlignVerticalJustifyStart size={14} strokeWidth={1.75} />
        </button>
        <button type="button" className={styles.alignBtn} aria-label="Align middle" disabled>
          <AlignVerticalJustifyCenter size={14} strokeWidth={1.75} />
        </button>
        <button type="button" className={styles.alignBtn} aria-label="Align bottom" disabled>
          <AlignVerticalJustifyEnd size={14} strokeWidth={1.75} />
        </button>
        <span className={styles.alignDivider} />
        <button type="button" className={styles.alignBtn} aria-label="Distribute" disabled>
          <AlignHorizontalSpaceBetween size={14} strokeWidth={1.75} />
        </button>
      </div>

      {/* Selection header */}
      <div className={styles.selectionHeader}>
        <span className={styles.selectionDot} />
        <span className={styles.selectionLabel}>{meta.label}</span>
        {meta.scope && <span className={styles.selectionScope}>in {meta.scope}</span>}
      </div>

      {/* Interactions */}
      <CollapsibleSection title="Interactions" headerAction="add" disabled />

      {/* Link */}
      <Section title="Link" headerAction="add" disabled>
        <Field label="Link To" bindable>
          <input className={styles.input} placeholder="Page or URL..." disabled />
        </Field>
      </Section>

      {/* Position */}
      <Section title="Position" disabled>
        <Field label="Type">
          <select className={styles.input} disabled defaultValue="relative">
            <option value="relative">Relative</option>
            <option value="absolute">Absolute</option>
            <option value="fixed">Fixed</option>
          </select>
        </Field>
      </Section>

      {/* Size */}
      <Section title="Size" headerAction="add" disabled>
        <Field label="Width" bindable>
          <NumUnit value="100" unit="rel" units={['rel', 'px', 'fit', 'auto']} disabled />
        </Field>
        <Field label="Height" bindable>
          <NumUnit value="" placeholder="321" unit="fit" units={['fit', 'px', 'rel', 'auto']} disabled />
        </Field>
        <Field label="Min Max">
          <div className={styles.swatchInput}>
            <ArrowLeftRight size={14} strokeWidth={1.75} color="var(--text-muted)" />
            <span className={styles.swatchPlaceholder}>Add...</span>
          </div>
        </Field>
      </Section>

      {/* Layout */}
      <Section title="Layout" headerAction="collapse" disabled>
        <Field label="Type">
          <div className={styles.segmented}>
            <button type="button" className={`${styles.segmentedBtn} ${styles.segmentedBtnActive}`} disabled>Stack</button>
            <button type="button" className={styles.segmentedBtn} disabled>Grid</button>
          </div>
        </Field>
        <Field label="Direction" bindable>
          <div className={styles.segmented}>
            <button type="button" className={styles.segmentedBtn} disabled>
              <ArrowLeftRight size={12} strokeWidth={1.75} />
            </button>
            <button type="button" className={`${styles.segmentedBtn} ${styles.segmentedBtnActive}`} disabled>
              <ArrowUpDown size={12} strokeWidth={1.75} />
            </button>
          </div>
        </Field>
        <Field label="Distribute" bindable>
          <select className={styles.input} disabled defaultValue="start">
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
            <option value="space-between">Space Between</option>
          </select>
        </Field>
        <Field label="Align" bindable>
          <div className={styles.segmented}>
            <button type="button" className={styles.segmentedBtn} disabled>
              <AlignStartVertical size={12} strokeWidth={1.75} />
            </button>
            <button type="button" className={`${styles.segmentedBtn} ${styles.segmentedBtnActive}`} disabled>
              <AlignCenterVertical size={12} strokeWidth={1.75} />
            </button>
            <button type="button" className={styles.segmentedBtn} disabled>
              <AlignEndVertical size={12} strokeWidth={1.75} />
            </button>
          </div>
        </Field>
        <Field label="Wrap">
          <div className={styles.segmented}>
            <button type="button" className={styles.segmentedBtn} disabled>Yes</button>
            <button type="button" className={`${styles.segmentedBtn} ${styles.segmentedBtnActive}`} disabled>No</button>
          </div>
        </Field>
        <Field label="Gap" bindable>
          <div className={styles.sliderRow}>
            <input className={styles.input} defaultValue="24" disabled />
            <input type="range" className={styles.slider} min={0} max={64} defaultValue={24} disabled />
          </div>
        </Field>
        <Field label="Padding" bindable>
          <div className={styles.sliderRow}>
            <input className={styles.input} defaultValue="0" disabled />
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
      </Section>

      {/* Styles */}
      <Section title="Styles" headerAction="add" disabled>
        <Field label="Opacity" bindable>
          <div className={styles.sliderRow}>
            <input className={styles.input} defaultValue="1" disabled />
            <input type="range" className={styles.slider} min={0} max={1} step={0.05} defaultValue={1} disabled />
          </div>
        </Field>
        <Field label="Visible" bindable>
          <div className={styles.segmented}>
            <button type="button" className={`${styles.segmentedBtn} ${styles.segmentedBtnActive}`} disabled>Yes</button>
            <button type="button" className={styles.segmentedBtn} disabled>No</button>
          </div>
        </Field>
        <Field label="Fill" bindable>
          <div className={styles.swatchInput}>
            <span className={styles.swatch} />
            <span className={styles.swatchPlaceholder}>Add...</span>
          </div>
        </Field>
        <Field label="Overflow" bindable>
          <select className={styles.input} disabled defaultValue="visible">
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
            <option value="auto">Auto</option>
            <option value="scroll">Scroll</option>
          </select>
        </Field>
        <Field label="Radius" bindable>
          <div className={styles.sliderRow}>
            <input className={styles.input} defaultValue="0" disabled />
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
        <Field label="Border">
          <div className={styles.swatchInput}>
            <span className={styles.swatch} />
            <span className={styles.swatchPlaceholder}>Add...</span>
          </div>
        </Field>
        <Field label="Shadows">
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
  disabled?: boolean;
  children?: React.ReactNode;
}

function Section({ title, headerAction, disabled, children }: SectionProps) {
  return (
    <div className={`${styles.section} ${disabled ? styles.disabled : ''}`}>
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

/** Like Section but has no body (e.g. "Interactions" in screenshots is just
 *  a header + add affordance until expanded). */
function CollapsibleSection({ title, headerAction, disabled }: Omit<SectionProps, 'children'>) {
  return <Section title={title} headerAction={headerAction} disabled={disabled} />;
}

interface FieldProps {
  label: string;
  /** Show the small "+" bind-to-variable button to the left of the label. */
  bindable?: boolean;
  children: React.ReactNode;
}

function Field({ label, bindable, children }: FieldProps) {
  return (
    <div className={styles.field}>
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

/** Number + unit-dropdown compact input. Stub in phase 1 (read-only). */
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
