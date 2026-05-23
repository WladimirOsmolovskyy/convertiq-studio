'use client';

/**
 * Result-page inspector. Visually modeled after Framer's design panel:
 * collapsible sections (Interactions, Link, Position, Size, Layout,
 * Styles), icon-only segmented controls for axis alignment, value+mode
 * rows for sizing, sliders for percentage-like properties.
 *
 * Sections we don't have a data model for yet (Interactions, Link,
 * Position, Wrap, Overflow, Opacity, Border, Shadows, Z Index) render
 * as dormant UI — controls are interactive but values aren't persisted.
 * Wired sections (Size, Direction/Distribute/Align, Gap, Padding, Fill,
 * Radius for frames; Content + Typography for text; Image upload + fit
 * for image) mutate the node through the store as before.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  ArrowUpDown,
  ChevronDown,
  Hash,
  ImagePlus,
  Loader2,
  Mail,
  Maximize2,
  Minus,
  Plus,
  Search,
  SquareDashed,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { uploadResultImage } from '@/lib/storage/resultImages';
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

/* ─── Main inspector ───────────────────────────────────────────── */

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

  if (!selectedNode) {
    return (
      <aside className={styles.inspector}>
        <PagePropsSection page={page} updateResultPage={updateResultPage} />
      </aside>
    );
  }

  const patch = (p: Partial<ResultNode>) => updateResultPageNode(page.id, selectedNode.id, p);

  return (
    <aside className={styles.inspector}>
      {/* Top alignment / distribute icon row. Decorative for now — the
          underlying behavior (per-node align-self / parent distribution)
          isn't in the data model yet. */}
      {!isRoot && <AlignmentIconRow />}

      <Section title="Interactions" defaultOpen={false}>
        <PropPlaceholder text="Add an interaction" />
      </Section>

      <Section title="Link" defaultOpen={false}>
        <LinkSubsection />
      </Section>

      <Section title="Position" defaultOpen={false}>
        <PropRow label="Type">
          <DropdownStub value="Relative" />
        </PropRow>
      </Section>

      {!isRoot && (
        <Section title="Size">
          <SizeRow
            label="Width"
            size={selectedNode.width}
            onChange={(width) => patch({ width })}
          />
          <SizeRow
            label="Height"
            size={selectedNode.height}
            onChange={(height) => patch({ height })}
          />
        </Section>
      )}

      {selectedNode.type === 'frame' && (
        <FrameProps node={selectedNode} patch={patch} />
      )}
      {selectedNode.type === 'text' && (
        <TextProps node={selectedNode} patch={patch} variables={variables} />
      )}
      {selectedNode.type === 'image' && (
        <ImageProps node={selectedNode} patch={patch} />
      )}

      {!isRoot && (
        <Section title="Actions" defaultOpen={false} hideAddIcon>
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
        </Section>
      )}
    </aside>
  );
}

/* ─── Page properties (no selection) ───────────────────────────── */

function PagePropsSection({
  page,
  updateResultPage,
}: {
  page: ResultPage;
  updateResultPage: (id: string, updates: Partial<ResultPage>) => void;
}) {
  return (
    <Section title="Page">
      <PropRow label="Name">
        <input
          className={styles.fwInput}
          value={page.name}
          onChange={(e) => updateResultPage(page.id, { name: e.target.value })}
          placeholder="e.g. High scorers"
        />
      </PropRow>
      <PropRow label="Score range">
        <div className={styles.inspectorFieldRow}>
          <input
            type="number"
            className={styles.fwInput}
            value={page.min_score}
            onChange={(e) => updateResultPage(page.id, { min_score: Number(e.target.value) })}
          />
          <span className={styles.toLabel}>to</span>
          <input
            type="number"
            className={styles.fwInput}
            value={page.max_score}
            onChange={(e) => updateResultPage(page.id, { max_score: Number(e.target.value) })}
          />
        </div>
      </PropRow>
      <p className={styles.dimHint}>Select a block in the canvas to edit its properties.</p>
    </Section>
  );
}

/* ─── Frame ────────────────────────────────────────────────────── */

function FrameProps({
  node,
  patch,
}: {
  node: ResultFrameNode;
  patch: (p: Partial<ResultNode>) => void;
}) {
  const [linkedPadding, setLinkedPadding] = useState(
    node.padding.top === node.padding.right &&
      node.padding.right === node.padding.bottom &&
      node.padding.bottom === node.padding.left,
  );

  // Stub state for dormant Framer-style fields. Held locally so the
  // controls feel interactive; not persisted to the node model.
  const [layoutType, setLayoutType] = useState<'stack' | 'grid'>('stack');
  const [wrap, setWrap] = useState<'yes' | 'no'>('no');
  const [overflow, setOverflow] = useState('Visible');
  const [opacity, setOpacity] = useState(1);
  const [visible, setVisible] = useState<'yes' | 'no'>('yes');
  const [zIndex, setZIndex] = useState(3);

  const setPadAll = (n: number) =>
    patch({ padding: { top: n, right: n, bottom: n, left: n } });

  return (
    <>
      <Section title="Layout">
        <PropRow label="Type">
          <Seg
            value={layoutType}
            options={[
              { value: 'stack', label: 'Stack' },
              { value: 'grid', label: 'Grid' },
            ]}
            onChange={(v) => setLayoutType(v as 'stack' | 'grid')}
          />
        </PropRow>
        <PropRow label="Direction">
          <IconSeg
            value={node.direction}
            options={[
              { value: 'row', icon: <ArrowLeftRight size={14} strokeWidth={1.75} />, label: 'Row' },
              { value: 'column', icon: <ArrowUpDown size={14} strokeWidth={1.75} />, label: 'Column' },
            ]}
            onChange={(v) => patch({ direction: v })}
          />
        </PropRow>
        <PropRow label="Distribute">
          <DropdownStub
            value={
              node.justify === 'start'
                ? 'Start'
                : node.justify === 'center'
                  ? 'Center'
                  : node.justify === 'end'
                    ? 'End'
                    : 'Space between'
            }
            options={[
              { value: 'start', label: 'Start' },
              { value: 'center', label: 'Center' },
              { value: 'end', label: 'End' },
              { value: 'space-between', label: 'Space between' },
            ]}
            onPick={(v) => patch({ justify: v as ResultFrameNode['justify'] })}
          />
        </PropRow>
        <PropRow label="Align">
          <IconSeg
            value={node.align}
            options={
              node.direction === 'row'
                ? [
                    { value: 'start', icon: <AlignStartHorizontal size={14} strokeWidth={1.75} />, label: 'Top' },
                    { value: 'center', icon: <AlignCenterHorizontal size={14} strokeWidth={1.75} />, label: 'Middle' },
                    { value: 'end', icon: <AlignEndHorizontal size={14} strokeWidth={1.75} />, label: 'Bottom' },
                    { value: 'stretch', icon: <Maximize2 size={14} strokeWidth={1.75} />, label: 'Stretch' },
                  ]
                : [
                    { value: 'start', icon: <AlignStartVertical size={14} strokeWidth={1.75} />, label: 'Left' },
                    { value: 'center', icon: <AlignCenterVertical size={14} strokeWidth={1.75} />, label: 'Center' },
                    { value: 'end', icon: <AlignEndVertical size={14} strokeWidth={1.75} />, label: 'Right' },
                    { value: 'stretch', icon: <Maximize2 size={14} strokeWidth={1.75} />, label: 'Stretch' },
                  ]
            }
            onChange={(v) => patch({ align: v as ResultFrameNode['align'] })}
          />
        </PropRow>
        <PropRow label="Wrap">
          <Seg
            value={wrap}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            onChange={(v) => setWrap(v as 'yes' | 'no')}
          />
        </PropRow>
        <PropRow label="Gap">
          <NumberSlider
            value={node.gap}
            min={0}
            max={120}
            onChange={(n) => patch({ gap: n })}
          />
        </PropRow>
        <PropRow label="Padding">
          <PaddingControl
            padding={node.padding}
            linked={linkedPadding}
            onToggleLink={() => {
              const next = !linkedPadding;
              setLinkedPadding(next);
              if (next) setPadAll(node.padding.top);
            }}
            onChange={(side, val) =>
              patch({ padding: { ...node.padding, [side]: val } })
            }
            onChangeAll={(n) => setPadAll(n)}
          />
        </PropRow>
      </Section>

      <Section title="Styles">
        <PropRow label="Opacity" leadingPlus>
          <NumberSlider value={opacity} min={0} max={1} step={0.05} onChange={setOpacity} />
        </PropRow>
        <PropRow label="Visible" leadingPlus>
          <Seg
            value={visible}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            onChange={(v) => setVisible(v as 'yes' | 'no')}
          />
        </PropRow>
        <PropRow label="Fill" leadingPlus>
          <ColorField
            value={node.background ?? ''}
            onChange={(v) => patch({ background: v || undefined })}
          />
        </PropRow>
        <PropRow label="Overflow" leadingPlus>
          <DropdownStub
            value={overflow}
            options={[
              { value: 'Visible', label: 'Visible' },
              { value: 'Hidden', label: 'Hidden' },
              { value: 'Scroll', label: 'Scroll' },
            ]}
            onPick={(v) => setOverflow(v)}
          />
        </PropRow>
        <PropRow label="Radius" leadingPlus>
          <RadiusControl
            value={node.borderRadius ?? 0}
            onChange={(n) => patch({ borderRadius: n })}
          />
        </PropRow>
        <PropRow label="Border">
          <ColorField value="" onChange={() => {}} placeholder="Add..." />
        </PropRow>
        <PropRow label="Shadows">
          <ColorField value="" onChange={() => {}} placeholder="Add..." />
        </PropRow>
        <PropRow label="Z Index" leadingPlus>
          <NumberStepper value={zIndex} onChange={setZIndex} />
        </PropRow>
      </Section>
    </>
  );
}

/* ─── Text ─────────────────────────────────────────────────────── */

function TextProps({
  node,
  patch,
  variables,
}: {
  node: ResultTextNode;
  patch: (p: Partial<ResultNode>) => void;
  variables: AvailableVariable[];
}) {
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
      <Section title="Content">
        <SpansEditor
          text={literalText}
          varSpans={varSpans}
          variables={variables}
          setText={setText}
          removeVarAt={removeVarAt}
          addVar={addVar}
        />
      </Section>

      <Section title="Typography">
        <PropRow label="Alignment">
          <IconSeg
            value={node.textAlign ?? 'left'}
            options={[
              { value: 'left', icon: <AlignLeft size={14} strokeWidth={1.75} />, label: 'Left' },
              { value: 'center', icon: <AlignCenter size={14} strokeWidth={1.75} />, label: 'Center' },
              { value: 'right', icon: <AlignRight size={14} strokeWidth={1.75} />, label: 'Right' },
            ]}
            onChange={(v) => patch({ textAlign: v as 'left' | 'center' | 'right' })}
          />
        </PropRow>
        <PropRow label="Size">
          <NumberStepper
            value={node.fontSize ?? 16}
            onChange={(n) => patch({ fontSize: n })}
          />
        </PropRow>
        <PropRow label="Weight">
          <NumberStepper
            value={node.fontWeight ?? 400}
            step={100}
            min={100}
            max={900}
            onChange={(n) => patch({ fontWeight: n })}
          />
        </PropRow>
      </Section>

      <Section title="Styles">
        <PropRow label="Color" leadingPlus>
          <ColorField
            value={node.color ?? ''}
            onChange={(v) => patch({ color: v || undefined })}
          />
        </PropRow>
      </Section>
    </>
  );
}

/* ─── Image ────────────────────────────────────────────────────── */

function ImageProps({
  node,
  patch,
}: {
  node: ResultImageNode;
  patch: (p: Partial<ResultNode>) => void;
}) {
  const { questionnaire } = useQuestionnaireStore();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    if (!questionnaire) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadResultImage(file, questionnaire.id);
      patch({ src: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const openFilePicker = () => {
    if (uploading) return;
    fileRef.current?.click();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <>
      <Section title="Image">
        <div
          className={`${styles.imageDropzone} ${dragOver ? styles.imageDropzoneOver : ''} ${node.src ? styles.imageDropzoneHasImage : ''}`}
          onClick={openFilePicker}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
        >
          {node.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={node.src} alt={node.alt || ''} className={styles.imageDropzonePreview} />
          ) : (
            <div className={styles.imageDropzoneEmpty}>
              {uploading ? (
                <>
                  <Loader2 size={16} strokeWidth={2} className={styles.spin} />
                  Uploading…
                </>
              ) : (
                <>
                  <ImagePlus size={20} strokeWidth={1.5} />
                  <span>Click or drop an image</span>
                  <span className={styles.imageDropzoneHint}>JPG, PNG, WebP, GIF, SVG · up to 5 MB</span>
                </>
              )}
            </div>
          )}
          {node.src && uploading && (
            <div className={styles.imageDropzoneOverlay}>
              <Loader2 size={18} strokeWidth={2} className={styles.spin} />
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        {error && <div className={styles.imageDropzoneError}>{error}</div>}
        {node.src && !uploading && (
          <div className={styles.inspectorFieldRow} style={{ marginTop: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={openFilePicker}>
              Replace
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => patch({ src: '' })}
            >
              Clear
            </button>
          </div>
        )}

        <PropRow label="URL">
          <input
            className={styles.fwInput}
            value={node.src}
            onChange={(e) => patch({ src: e.target.value })}
            placeholder="https://…"
          />
        </PropRow>
        <PropRow label="Alt text">
          <input
            className={styles.fwInput}
            value={node.alt ?? ''}
            onChange={(e) => patch({ alt: e.target.value })}
          />
        </PropRow>
        <PropRow label="Fit">
          <Seg
            value={node.fit ?? 'cover'}
            options={[
              { value: 'cover', label: 'Cover' },
              { value: 'contain', label: 'Contain' },
            ]}
            onChange={(v) => patch({ fit: v as 'cover' | 'contain' })}
          />
        </PropRow>
      </Section>

      <Section title="Styles">
        <PropRow label="Radius" leadingPlus>
          <RadiusControl
            value={node.borderRadius ?? 0}
            onChange={(n) => patch({ borderRadius: n })}
          />
        </PropRow>
      </Section>
    </>
  );
}

/* ─── Reusable shell components ────────────────────────────────── */

function Section({
  title,
  children,
  defaultOpen = true,
  hideAddIcon = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  hideAddIcon?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.sectionTitle}>{title}</span>
        {!hideAddIcon && (
          <span className={styles.sectionToggle}>
            {open ? <Minus size={14} strokeWidth={2} /> : <Plus size={14} strokeWidth={2} />}
          </span>
        )}
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

function PropRow({
  label,
  children,
  leadingPlus,
}: {
  label: string;
  children: ReactNode;
  /** Show a small "+" icon to the left of the label (matches Framer's
   *  per-property override hint). Decorative for now. */
  leadingPlus?: boolean;
}) {
  return (
    <div className={styles.propRow}>
      <span className={styles.propLabel}>
        {leadingPlus && (
          <span className={styles.propLeadPlus} aria-hidden>
            <Plus size={11} strokeWidth={2.25} />
          </span>
        )}
        {label}
      </span>
      <span className={styles.propValue}>{children}</span>
    </div>
  );
}

function PropPlaceholder({ text }: { text: string }) {
  return <div className={styles.propPlaceholder}>{text}</div>;
}

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.segCtl}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.segCtlBtn} ${value === opt.value ? styles.segCtlBtnActive : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function IconSeg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; icon: ReactNode; label?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.iconSeg}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.iconSegBtn} ${value === opt.value ? styles.iconSegBtnActive : ''}`}
          onClick={() => onChange(opt.value)}
          title={opt.label}
          aria-label={opt.label}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}

function DropdownStub({
  value,
  options,
  onPick,
}: {
  value: string;
  options?: { value: string; label: string }[];
  onPick?: (v: string) => void;
}) {
  // Headless <select> styled to look like Framer's dropdown chip.
  if (!options) {
    // Pure display chip when no options are provided.
    return (
      <span className={styles.dropdownStub}>
        {value}
        <ChevronDown size={12} strokeWidth={1.75} />
      </span>
    );
  }
  return (
    <label className={styles.dropdownStub}>
      <select
        value={options.find((o) => o.label === value)?.value ?? options[0].value}
        onChange={(e) => onPick?.(e.target.value)}
        className={styles.dropdownStubSelect}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span>{value}</span>
      <ChevronDown size={12} strokeWidth={1.75} />
    </label>
  );
}

function NumberSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className={styles.numberSlider}>
      <input
        type="number"
        className={styles.numberSliderNum}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        type="range"
        className={styles.numberSliderRange}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function NumberStepper({
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const clamp = (n: number) =>
    Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  return (
    <div className={styles.numberStepper}>
      <input
        type="number"
        className={styles.fwInput}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        step={step}
      />
      <div className={styles.numberStepperBtns}>
        <button
          type="button"
          className={styles.numberStepperBtn}
          onClick={() => onChange(clamp(value - step))}
          aria-label="Decrement"
        >
          <Minus size={11} strokeWidth={2.25} />
        </button>
        <span className={styles.numberStepperSep} />
        <button
          type="button"
          className={styles.numberStepperBtn}
          onClick={() => onChange(clamp(value + step))}
          aria-label="Increment"
        >
          <Plus size={11} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}

function ColorField({
  value,
  onChange,
  placeholder = 'Add...',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className={styles.colorField}>
      <span
        className={styles.colorSwatch}
        style={{ background: value || 'transparent' }}
      />
      <input
        className={styles.colorFieldInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
    <PropRow label={label}>
      <div className={styles.sizeRow}>
        <input
          type="number"
          className={`${styles.fwInput} ${styles.sizeRowValue}`}
          value={mode === 'fixed' ? (size?.value ?? 0) : ''}
          disabled={mode !== 'fixed'}
          placeholder={mode === 'fill' ? '1fr' : mode === 'fit' ? 'Fit' : ''}
          onChange={(e) => onChange({ mode: 'fixed', value: Number(e.target.value) })}
        />
        <label className={styles.sizeRowMode}>
          <select
            value={mode}
            onChange={(e) => {
              const m = e.target.value as ResultSize['mode'];
              if (m === 'fit') onChange(undefined);
              else if (m === 'fixed') onChange({ mode: 'fixed', value: size?.value ?? 120 });
              else onChange({ mode: 'fill' });
            }}
          >
            <option value="fit">Fit</option>
            <option value="fill">Fill</option>
            <option value="fixed">Fixed</option>
          </select>
          <span>{mode === 'fit' ? 'Fit' : mode === 'fill' ? 'Fill' : 'Fixed'}</span>
          <ChevronDown size={11} strokeWidth={1.75} />
        </label>
      </div>
    </PropRow>
  );
}

function PaddingControl({
  padding,
  linked,
  onToggleLink,
  onChange,
  onChangeAll,
}: {
  padding: ResultFrameNode['padding'];
  linked: boolean;
  onToggleLink: () => void;
  onChange: (side: keyof ResultFrameNode['padding'], val: number) => void;
  onChangeAll: (n: number) => void;
}) {
  if (linked) {
    return (
      <div className={styles.paddingCtl}>
        <input
          type="number"
          className={styles.fwInput}
          value={padding.top}
          onChange={(e) => onChangeAll(Number(e.target.value))}
        />
        <button
          type="button"
          className={`${styles.paddingLinkBtn} ${styles.paddingLinkBtnActive}`}
          onClick={onToggleLink}
          title="Linked sides"
          aria-label="Linked padding"
        >
          <SquareDashed size={12} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={styles.paddingLinkBtn}
          onClick={onToggleLink}
          title="Per-side"
          aria-label="Per-side padding"
        >
          <Maximize2 size={12} strokeWidth={1.75} />
        </button>
      </div>
    );
  }
  return (
    <div className={styles.paddingCtlGrid}>
      <input
        type="number"
        className={styles.fwInput}
        value={padding.top}
        onChange={(e) => onChange('top', Number(e.target.value))}
        title="Top"
      />
      <input
        type="number"
        className={styles.fwInput}
        value={padding.right}
        onChange={(e) => onChange('right', Number(e.target.value))}
        title="Right"
      />
      <input
        type="number"
        className={styles.fwInput}
        value={padding.bottom}
        onChange={(e) => onChange('bottom', Number(e.target.value))}
        title="Bottom"
      />
      <input
        type="number"
        className={styles.fwInput}
        value={padding.left}
        onChange={(e) => onChange('left', Number(e.target.value))}
        title="Left"
      />
      <button
        type="button"
        className={styles.paddingLinkBtn}
        onClick={onToggleLink}
        title="Link sides"
        aria-label="Link sides"
      >
        <SquareDashed size={12} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function RadiusControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className={styles.paddingCtl}>
      <input
        type="number"
        className={styles.fwInput}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <button
        type="button"
        className={`${styles.paddingLinkBtn} ${styles.paddingLinkBtnActive}`}
        title="All corners"
        aria-label="All corners linked"
      >
        <SquareDashed size={12} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className={styles.paddingLinkBtn}
        title="Per-corner"
        aria-label="Per-corner radius"
      >
        <Maximize2 size={12} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function LinkSubsection() {
  const [link, setLink] = useState('');
  return (
    <PropRow label="Link To" leadingPlus>
      <input
        className={styles.fwInput}
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Page or URL..."
      />
    </PropRow>
  );
}

function AlignmentIconRow() {
  // Decorative for now — each click is a stub. Order matches Framer's
  // top icon strip.
  return (
    <div className={styles.alignRow}>
      <button type="button" className={styles.alignBtn} aria-label="Align left" title="Align left">
        <AlignStartVertical size={14} strokeWidth={1.75} />
      </button>
      <button type="button" className={styles.alignBtn} aria-label="Align center horizontal" title="Align center">
        <AlignCenterVertical size={14} strokeWidth={1.75} />
      </button>
      <button type="button" className={styles.alignBtn} aria-label="Align right" title="Align right">
        <AlignEndVertical size={14} strokeWidth={1.75} />
      </button>
      <button type="button" className={styles.alignBtn} aria-label="Align top" title="Align top">
        <AlignStartHorizontal size={14} strokeWidth={1.75} />
      </button>
      <button type="button" className={styles.alignBtn} aria-label="Align middle vertical" title="Align middle">
        <AlignCenterHorizontal size={14} strokeWidth={1.75} />
      </button>
      <button type="button" className={styles.alignBtn} aria-label="Align bottom" title="Align bottom">
        <AlignEndHorizontal size={14} strokeWidth={1.75} />
      </button>
      <button type="button" className={styles.alignBtn} aria-label="Distribute horizontal" title="Distribute horizontal">
        <AlignHorizontalDistributeCenter size={14} strokeWidth={1.75} />
      </button>
      <button type="button" className={styles.alignBtn} aria-label="Distribute vertical" title="Distribute vertical">
        <AlignVerticalDistributeCenter size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}

/* ─── Spans editor (content + variable chips) ──────────────────── */

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
    <span className={styles.varChip}>
      <span className={styles.varChipIcon} aria-hidden>
        <GroupIcon group={group} />
      </span>
      <span className={styles.varChipLabel}>{variable?.label ?? fallbackKey}</span>
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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
      <div
        className={styles.varPicker}
        style={{
          position: 'fixed',
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          right: 'auto',
          visibility: pos ? 'visible' : 'hidden',
        } as CSSProperties}
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
