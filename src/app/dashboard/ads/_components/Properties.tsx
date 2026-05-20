'use client';

import { useMemo } from 'react';
import { Link2, Link2Off } from 'lucide-react';
import { useEditorStore } from '../_store/editor';
import { findNodeAndParent } from '../_model/tree';
import { computeLayout } from '../_model/autolayout';
import {
  findBinding,
  newVariableId,
  suggestVariableLabel,
  typeForProperty,
} from '../_model/variables';
import type {
  AdVariable,
  AdVariableProperty,
  ConstraintAxis,
  SceneNode,
  SizingMode,
} from '../_model/nodes';
import styles from '../ads.module.css';

const CONSTRAINT_OPTIONS: { value: ConstraintAxis; label: string }[] = [
  { value: 'left', label: 'Min' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Max' },
];

const SIZE_MODE_OPTIONS: { value: SizingMode; label: string }[] = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'relative', label: 'Relative' },
  { value: 'fill', label: 'Fill' },
  { value: 'fit', label: 'Fit Content' },
];

export default function Properties() {
  const doc = useEditorStore((s) => s.doc);
  const selectedId = useEditorStore((s) => s.selectedId);
  const editNode = useEditorStore((s) => s.editNode);
  const variables = useEditorStore((s) => s.variables);
  const addVariable = useEditorStore((s) => s.addVariable);
  const removeVariable = useEditorStore((s) => s.removeVariable);

  const found = selectedId ? findNodeAndParent(doc.root, selectedId) : null;
  const node = found?.node ?? null;
  const parent = found?.parent ?? null;

  const layouts = useMemo(() => computeLayout(doc.root), [doc]);
  const computed = node ? layouts.get(node.id) ?? null : null;

  if (!node) {
    return (
      <div className={styles.panelScroll}>
        <div className={styles.panelSectionTitle}>Properties</div>
        <div className={styles.panelEmpty}>Select a layer to edit its properties.</div>
      </div>
    );
  }

  const patch = (mutator: (n: SceneNode) => void) => editNode(node.id, mutator);

  const parentIsAutoLayout = !!(parent?.autoLayout && parent.autoLayout.direction !== 'none');
  const participates = node.participatesInAutoLayout ?? true;
  const wMode = node.transform.widthMode ?? 'fixed';
  const hMode = node.transform.heightMode ?? 'fixed';

  // X/Y are overridden when the parent auto-lays this child out.
  const xOverridden = parentIsAutoLayout && participates;
  const yOverridden = parentIsAutoLayout && participates;
  // W/H number input is meaningful only for 'fixed' (raw px) or 'relative' (percentage).
  const wEditable = wMode === 'fixed' || wMode === 'relative';
  const hEditable = hMode === 'fixed' || hMode === 'relative';

  return (
    <div className={styles.panelScroll}>
      <div className={styles.panelSectionTitle}>{node.name}</div>

      <Section title="Position">
        <Row label="X">
          <NumberInput
            value={Math.round(computed?.x ?? node.transform.x)}
            disabled={xOverridden}
            onChange={(v) => patch((n) => { n.transform.x = v; })}
          />
        </Row>
        <Row label="Y">
          <NumberInput
            value={Math.round(computed?.y ?? node.transform.y)}
            disabled={yOverridden}
            onChange={(v) => patch((n) => { n.transform.y = v; })}
          />
        </Row>
        <Row label="Opacity">
          <NumberInput
            min={0}
            max={1}
            step={0.05}
            value={Number(node.opacity.toFixed(2))}
            onChange={(v) => patch((n) => { n.opacity = Math.max(0, Math.min(1, v)); })}
          />
        </Row>

        {(xOverridden || yOverridden) && (
          <div className={styles.propRowFull}>
            <div className={styles.propNote}>
              Auto-laid out by parent. Toggle &quot;Participates&quot; off below to override.
            </div>
          </div>
        )}
      </Section>

      <Section title="Size">
        <Row label="Width" full>
          <SizeField
            mode={wMode}
            value={
              wEditable
                ? node.transform.width
                : Math.round(computed?.width ?? node.transform.width)
            }
            onModeChange={(m) => patch((n) => {
              if (m !== 'fit' && m !== 'fill') {
                // capture current computed pixel size as the new fixed/relative base
                const base = Math.round(computed?.width ?? n.transform.width);
                n.transform.width = m === 'relative' ? 100 : base;
              }
              n.transform.widthMode = m;
            })}
            onValueChange={(v) => patch((n) => { n.transform.width = v; })}
            editable={wEditable}
          />
        </Row>
        <Row label="Height" full>
          <SizeField
            mode={hMode}
            value={
              hEditable
                ? node.transform.height
                : Math.round(computed?.height ?? node.transform.height)
            }
            onModeChange={(m) => patch((n) => {
              if (m !== 'fit' && m !== 'fill') {
                const base = Math.round(computed?.height ?? n.transform.height);
                n.transform.height = m === 'relative' ? 100 : base;
              }
              n.transform.heightMode = m;
            })}
            onValueChange={(v) => patch((n) => { n.transform.height = v; })}
            editable={hEditable}
          />
        </Row>
      </Section>

      {parentIsAutoLayout && (
        <Section title="Auto-layout child">
          <Row label="Participates" full>
            <input
              type="checkbox"
              checked={participates}
              onChange={(e) => patch((n) => { n.participatesInAutoLayout = e.target.checked; })}
            />
          </Row>
        </Section>
      )}

      <Section title="Constraints">
        <Row label="X axis">
          <select
            className={styles.field}
            value={node.constraints?.x ?? 'left'}
            onChange={(e) => patch((n) => {
              const x = e.target.value as ConstraintAxis;
              const y = n.constraints?.y ?? 'left';
              n.constraints = { x, y };
            })}
          >
            {CONSTRAINT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Row>
        <Row label="Y axis">
          <select
            className={styles.field}
            value={node.constraints?.y ?? 'left'}
            onChange={(e) => patch((n) => {
              const y = e.target.value as ConstraintAxis;
              const x = n.constraints?.x ?? 'left';
              n.constraints = { x, y };
            })}
          >
            {CONSTRAINT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Row>
      </Section>

      {node.type === 'text' && (
        <Section title="Text">
          <Row label="Content" full>
            <Bindable
              variables={variables}
              node={node}
              property="text"
              defaultValue={node.text}
              onAdd={addVariable}
              onRemove={removeVariable}
            >
              {(bound) => (
                <textarea
                  className={`${styles.field} ${bound ? styles.fieldDimmed : ''}`}
                  value={node.text}
                  rows={3}
                  disabled={bound}
                  onChange={(e) => patch((n) => { if (n.type === 'text') n.text = e.target.value; })}
                />
              )}
            </Bindable>
          </Row>
          <Row label="Size">
            <Bindable
              variables={variables}
              node={node}
              property="fontSize"
              defaultValue={node.fontSize}
              onAdd={addVariable}
              onRemove={removeVariable}
            >
              {(bound) => (
                <NumberInput
                  value={node.fontSize}
                  disabled={bound}
                  onChange={(v) => patch((n) => { if (n.type === 'text') n.fontSize = v; })}
                />
              )}
            </Bindable>
          </Row>
          <Row label="Weight">
            <select
              className={styles.field}
              value={node.fontWeight}
              onChange={(e) => patch((n) => { if (n.type === 'text') n.fontWeight = Number(e.target.value); })}
            >
              {[300, 400, 500, 600, 700, 800, 900].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </Row>
          <Row label="Font" full>
            <Bindable
              variables={variables}
              node={node}
              property="fontFamily"
              defaultValue={node.fontFamily}
              onAdd={addVariable}
              onRemove={removeVariable}
            >
              {(bound) => (
                <input
                  className={`${styles.field} ${bound ? styles.fieldDimmed : ''}`}
                  value={node.fontFamily}
                  disabled={bound}
                  onChange={(e) => patch((n) => { if (n.type === 'text') n.fontFamily = e.target.value; })}
                />
              )}
            </Bindable>
          </Row>
          <Row label="Line">
            <NumberInput
              step={0.05}
              value={Number(node.lineHeight.toFixed(2))}
              onChange={(v) => patch((n) => { if (n.type === 'text') n.lineHeight = v; })}
            />
          </Row>
          <Row label="Tracking">
            <NumberInput
              step={0.1}
              value={node.letterSpacing}
              onChange={(v) => patch((n) => { if (n.type === 'text') n.letterSpacing = v; })}
            />
          </Row>
          <Row label="Color" full>
            <Bindable
              variables={variables}
              node={node}
              property="fill"
              defaultValue={node.color}
              onAdd={addVariable}
              onRemove={removeVariable}
            >
              {(bound) => (
                <ColorInput
                  value={node.color}
                  disabled={bound}
                  onChange={(v) => patch((n) => { if (n.type === 'text') n.color = v; })}
                />
              )}
            </Bindable>
          </Row>
          <Row label="Align">
            <select
              className={styles.field}
              value={node.align}
              onChange={(e) => patch((n) => { if (n.type === 'text') n.align = e.target.value as 'left' | 'center' | 'right'; })}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </Row>
        </Section>
      )}

      {node.type === 'shape' && (
        <Section title="Shape">
          <Row label="Fill" full>
            <Bindable
              variables={variables}
              node={node}
              property="fill"
              defaultValue={node.fill || '#000000'}
              onAdd={addVariable}
              onRemove={removeVariable}
            >
              {(bound) => (
                <ColorInput
                  value={node.fill || '#000000'}
                  disabled={bound}
                  onChange={(v) => patch((n) => { if (n.type === 'shape') n.fill = v; })}
                />
              )}
            </Bindable>
          </Row>
          {node.shape === 'rect' && (
            <Row label="Radius">
              <NumberInput
                value={node.cornerRadius || 0}
                onChange={(v) => patch((n) => { if (n.type === 'shape') n.cornerRadius = v; })}
              />
            </Row>
          )}
          <Row label="Stroke">
            <ColorInput value={node.stroke || '#000000'} onChange={(v) => patch((n) => { if (n.type === 'shape') n.stroke = v; })} />
          </Row>
          <Row label="Width">
            <NumberInput
              value={node.strokeWidth || 0}
              onChange={(v) => patch((n) => { if (n.type === 'shape') n.strokeWidth = v; })}
            />
          </Row>
        </Section>
      )}

      {node.type === 'frame' && (
        <Section title="Frame">
          <Row label="Fill" full>
            <Bindable
              variables={variables}
              node={node}
              property="fill"
              defaultValue={node.fill || 'rgba(0,0,0,0)'}
              onAdd={addVariable}
              onRemove={removeVariable}
            >
              {(bound) => (
                <ColorInput
                  value={node.fill || 'rgba(0,0,0,0)'}
                  disabled={bound}
                  onChange={(v) => patch((n) => { if (n.type === 'frame') n.fill = v; })}
                />
              )}
            </Bindable>
          </Row>
          <Row label="Radius">
            <NumberInput
              value={node.cornerRadius || 0}
              onChange={(v) => patch((n) => { if (n.type === 'frame') n.cornerRadius = v; })}
            />
          </Row>
          <Row label="Clip">
            <input
              type="checkbox"
              checked={!!node.clip}
              onChange={(e) => patch((n) => { if (n.type === 'frame') n.clip = e.target.checked; })}
            />
          </Row>
        </Section>
      )}

      {node.type === 'frame' && (
        <Section title="Auto-layout">
          <Row label="Direction" full>
            <select
              className={styles.field}
              value={node.autoLayout?.direction ?? 'none'}
              onChange={(e) => patch((n) => {
                if (n.type !== 'frame') return;
                const dir = e.target.value as 'row' | 'col' | 'none';
                if (dir === 'none') {
                  if (n.autoLayout) n.autoLayout.direction = 'none';
                } else {
                  n.autoLayout = n.autoLayout ?? {
                    direction: dir,
                    gap: 12,
                    paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
                    align: 'start',
                    justify: 'start',
                    hugContents: { width: false, height: false },
                  };
                  n.autoLayout.direction = dir;
                }
              })}
            >
              <option value="none">None</option>
              <option value="row">Row</option>
              <option value="col">Column</option>
            </select>
          </Row>
          {node.autoLayout && node.autoLayout.direction !== 'none' && (
            <>
              <Row label="Gap">
                <NumberInput
                  value={node.autoLayout.gap}
                  onChange={(v) => patch((n) => {
                    if (n.type === 'frame' && n.autoLayout) n.autoLayout.gap = v;
                  })}
                />
              </Row>
              <Row label="Align">
                <select
                  className={styles.field}
                  value={node.autoLayout.align}
                  onChange={(e) => patch((n) => {
                    if (n.type === 'frame' && n.autoLayout) {
                      n.autoLayout.align = e.target.value as 'start' | 'center' | 'end' | 'stretch';
                    }
                  })}
                >
                  <option value="start">Start</option>
                  <option value="center">Center</option>
                  <option value="end">End</option>
                  <option value="stretch">Stretch</option>
                </select>
              </Row>
              <Row label="Pad T">
                <NumberInput
                  value={node.autoLayout.paddingTop}
                  onChange={(v) => patch((n) => {
                    if (n.type === 'frame' && n.autoLayout) n.autoLayout.paddingTop = v;
                  })}
                />
              </Row>
              <Row label="Pad R">
                <NumberInput
                  value={node.autoLayout.paddingRight}
                  onChange={(v) => patch((n) => {
                    if (n.type === 'frame' && n.autoLayout) n.autoLayout.paddingRight = v;
                  })}
                />
              </Row>
              <Row label="Pad B">
                <NumberInput
                  value={node.autoLayout.paddingBottom}
                  onChange={(v) => patch((n) => {
                    if (n.type === 'frame' && n.autoLayout) n.autoLayout.paddingBottom = v;
                  })}
                />
              </Row>
              <Row label="Pad L">
                <NumberInput
                  value={node.autoLayout.paddingLeft}
                  onChange={(v) => patch((n) => {
                    if (n.type === 'frame' && n.autoLayout) n.autoLayout.paddingLeft = v;
                  })}
                />
              </Row>
            </>
          )}
        </Section>
      )}

      {node.type === 'image' && (
        <Section title="Image">
          <Row label="URL" full>
            <input
              className={styles.field}
              value={node.src}
              onChange={(e) => patch((n) => { if (n.type === 'image') n.src = e.target.value; })}
            />
          </Row>
          <Row label="Upload" full>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => patch((n) => { if (n.type === 'image') n.src = reader.result as string; });
                reader.readAsDataURL(f);
              }}
            />
          </Row>
          <Row label="Fit">
            <select
              className={styles.field}
              value={node.fit}
              onChange={(e) => patch((n) => { if (n.type === 'image') n.fit = e.target.value as 'cover' | 'contain' | 'fill'; })}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="fill">Fill</option>
            </select>
          </Row>
        </Section>
      )}

      {node.type === 'icon' && (
        <Section title="Icon">
          <Row label="Color" full>
            <Bindable
              variables={variables}
              node={node}
              property="fill"
              defaultValue={node.color}
              onAdd={addVariable}
              onRemove={removeVariable}
            >
              {(bound) => (
                <ColorInput
                  value={node.color}
                  disabled={bound}
                  onChange={(v) => patch((n) => { if (n.type === 'icon') n.color = v; })}
                />
              )}
            </Bindable>
          </Row>
          <Row label="Stroke">
            <NumberInput
              step={0.5}
              value={node.strokeWidth || 1.5}
              onChange={(v) => patch((n) => { if (n.type === 'icon') n.strokeWidth = v; })}
            />
          </Row>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.propSection}>
      <div className={styles.propSectionTitle}>{title}</div>
      <div className={styles.propGrid}>{children}</div>
    </div>
  );
}

function Row({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`${styles.propRow} ${full ? styles.propRowFull : ''}`}>
      <span className={styles.propLabel}>{label}</span>
      <span className={styles.propControl}>{children}</span>
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      className={`${styles.field} ${disabled ? styles.fieldDimmed : ''}`}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      title={disabled ? 'Overridden by layout / constraints' : undefined}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (!Number.isNaN(v)) onChange(v);
      }}
    />
  );
}

function SizeField({
  mode,
  value,
  editable,
  onModeChange,
  onValueChange,
}: {
  mode: SizingMode;
  value: number;
  editable: boolean;
  onModeChange: (m: SizingMode) => void;
  onValueChange: (v: number) => void;
}) {
  const suffix = mode === 'relative' ? '%' : 'px';
  return (
    <div className={styles.sizeRow}>
      <div className={styles.sizeNumberWrap}>
        <input
          type="number"
          className={`${styles.field} ${!editable ? styles.fieldDimmed : ''}`}
          value={Math.round(value)}
          disabled={!editable}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) onValueChange(v);
          }}
        />
        <span className={styles.sizeUnit}>{suffix}</span>
      </div>
      <select
        className={styles.field}
        value={mode}
        onChange={(e) => onModeChange(e.target.value as SizingMode)}
      >
        {SIZE_MODE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ColorInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
  return (
    <div className={styles.colorRow}>
      <div className={styles.swatch} style={{ background: value }}>
        {!disabled && (
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
      <input
        type="text"
        className={`${styles.field} ${disabled ? styles.fieldDimmed : ''}`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}

function Bindable({
  variables,
  node,
  property,
  defaultValue,
  onAdd,
  onRemove,
  children,
}: {
  variables: AdVariable[];
  node: SceneNode;
  property: AdVariableProperty;
  defaultValue: string | number;
  onAdd: (v: AdVariable) => void;
  onRemove: (id: string) => void;
  children: (bound: boolean) => React.ReactNode;
}) {
  const bound = findBinding(variables, node.id, property);
  const handle = () => {
    if (bound) {
      onRemove(bound.id);
      return;
    }
    onAdd({
      id: newVariableId(),
      label: suggestVariableLabel(node, property),
      nodeId: node.id,
      property,
      type: typeForProperty(property),
      defaultValue,
    });
  };
  return (
    <div className={styles.bindRow}>
      <div className={styles.bindControl}>{children(!!bound)}</div>
      <button
        type="button"
        className={`${styles.bindBtn} ${bound ? styles.bindBtnActive : ''}`}
        onClick={handle}
        title={bound ? `Variable: ${bound.label} · click to unbind` : 'Make variable'}
        aria-label={bound ? 'Unbind variable' : 'Make variable'}
      >
        {bound ? <Link2 size={12} strokeWidth={2} /> : <Link2Off size={12} strokeWidth={2} />}
      </button>
      {bound && <div className={styles.bindChip}>{bound.label}</div>}
    </div>
  );
}
