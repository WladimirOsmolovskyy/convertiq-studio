'use client';

/**
 * Variables panel — the questionnaire's GLOBAL design tokens.
 *
 * Scope (deliberately): the small set of tokens that actually drive the
 * rendered questionnaire, each shown with its inherit/override state vs the
 * project Brand palette:
 *
 *   Colors      — Background · Surface · Primary · Text · Muted (Brand-linked)
 *   Typography  — Heading / Body: font · weight · size · line-height · spacing
 *   Layout      — content width · radius · card padding · question spacing
 *   Background  — page background mode (solid uses the Background color)
 *   Behavior    — auto-advance delay after picking a single-choice answer
 *
 * Per-element styling (button, progress, options, inputs, card) lives in the
 * Inspector tab — select the element on the canvas. This panel intentionally
 * does NOT duplicate that.
 */

import { RotateCcw, Link2 } from 'lucide-react';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { resolveDesign } from '@/lib/designResolve';
import { SELECT_FEEDBACK_MS } from '@/lib/types';
import { isValidHex, parseColor, buildColor } from '@/lib/color';
import editorStyles from '../editor.module.css';
import designStyles from './design.module.css';

/* ── Font Registry with available weights ─────────────────────── */
interface FontDef {
  label: string;
  value: string;
  weights: number[];
  category: 'system' | 'sans' | 'serif' | 'mono';
}

const FONTS: FontDef[] = [
  { label: 'System (Apple)',    value: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], category: 'system' },
  { label: 'Inter',            value: "'Inter', sans-serif",           weights: [300, 400, 500, 600, 700, 800, 900], category: 'sans' },
  { label: 'Outfit',           value: "'Outfit', sans-serif",          weights: [300, 400, 500, 600, 700, 800, 900], category: 'sans' },
  { label: 'DM Sans',          value: "'DM Sans', sans-serif",         weights: [300, 400, 500, 600, 700], category: 'sans' },
  { label: 'Space Grotesk',    value: "'Space Grotesk', sans-serif",   weights: [300, 400, 500, 600, 700], category: 'sans' },
  { label: 'Poppins',          value: "'Poppins', sans-serif",         weights: [300, 400, 500, 600, 700, 800, 900], category: 'sans' },
  { label: 'Playfair Display', value: "'Playfair Display', serif",     weights: [400, 500, 600, 700, 800, 900], category: 'serif' },
  { label: 'Lora',             value: "'Lora', serif",                 weights: [400, 500, 600, 700], category: 'serif' },
  { label: 'Source Serif 4',   value: "'Source Serif 4', serif",       weights: [300, 400, 500, 600, 700, 800, 900], category: 'serif' },
  { label: 'Roboto Mono',      value: "'Roboto Mono', monospace",      weights: [300, 400, 500, 600, 700], category: 'mono' },
];

const WEIGHT_LABELS: Record<number, string> = {
  100: 'Thin', 200: 'ExLight', 300: 'Light', 400: 'Regular',
  500: 'Medium', 600: 'Semi', 700: 'Bold', 800: 'ExBold', 900: 'Black',
};

function getFontDef(cssValue: string): FontDef {
  return FONTS.find(f => f.value === cssValue) || FONTS[0];
}


/* ── Safe typography accessors (size/weight/line-height/spacing) ── */
function getBody(design: { typography: { body?: { size?: number; weight?: number; lineHeight?: number; letterSpacing?: number }; baseFontSize?: number; lineHeight?: number } }) {
  return {
    size: design.typography.body?.size ?? design.typography.baseFontSize ?? 16,
    weight: design.typography.body?.weight ?? 400,
    lineHeight: design.typography.body?.lineHeight ?? design.typography.lineHeight ?? 1.6,
    letterSpacing: design.typography.body?.letterSpacing ?? 0,
  };
}
function getHeading(design: { typography: { heading?: { size?: number; weight?: number; lineHeight?: number; letterSpacing?: number }; baseFontSize?: number; headingWeight?: number } }) {
  return {
    size: design.typography.heading?.size ?? Math.round((design.typography.baseFontSize ?? 16) * 1.375),
    weight: design.typography.heading?.weight ?? design.typography.headingWeight ?? 700,
    lineHeight: design.typography.heading?.lineHeight ?? 1.2,
    letterSpacing: design.typography.heading?.letterSpacing ?? -0.02,
  };
}

/* ── Sub-components ────────────────────────────────────────────── */
/** A Brand-linked color token: swatch + name + hex, with inherit/override
 *  state and a ↺ restore that clears the override back to Brand. */
function ColorField({
  label, value, onChange, overridden, onRestore, inheritLabel = 'Brand',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  overridden?: boolean;
  onRestore?: () => void;
  inheritLabel?: string;
}) {
  const { rgb, alpha } = parseColor(value);
  const swatchColor = isValidHex(value) ? value : '#000000';
  return (
    <div className={designStyles.colorRow}>
      <div className={editorStyles.colorSwatch} style={{ backgroundColor: swatchColor }}>
        <input type="color" value={rgb} onChange={(e) => onChange(buildColor(e.target.value, alpha))} />
      </div>
      <span className={designStyles.colorRowLabel}>{label}</span>
      <input
        type="range"
        className={designStyles.opacitySlider}
        min={0}
        max={100}
        value={alpha}
        onChange={(e) => onChange(buildColor(rgb, Number(e.target.value)))}
        aria-label={`${label} opacity (%)`}
      />
      <span className={designStyles.opacityPct}>{alpha}%</span>
      {onRestore && (
        <span className={designStyles.colorFieldState}>
          {overridden ? (
            <>
              <span className={designStyles.overrideDot} title="Overridden" />
              <button
                type="button"
                className={designStyles.restoreBtn}
                onClick={onRestore}
                title={`Restore to ${inheritLabel}`}
                aria-label={`Restore ${label} to ${inheritLabel}`}
              >
                <RotateCcw size={12} strokeWidth={2} />
              </button>
            </>
          ) : (
            <span className={designStyles.inheritChip} title={`Inheriting from ${inheritLabel}`}>
              <Link2 size={11} strokeWidth={2} />
            </span>
          )}
        </span>
      )}
    </div>
  );
}

function SliderField({
  label, value, onChange, min, max, step = 1, unit = '',
}: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string;
}) {
  return (
    <div className={editorStyles.sliderRow}>
      <span className={editorStyles.sliderLabel}>{label}</span>
      <input type="range" className={editorStyles.slider} min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
      <span className={editorStyles.sliderValue}>{value}{unit}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className={editorStyles.designSectionTitle}>{children}</h3>;
}

function ToggleField({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className={editorStyles.sliderRow}>
      <span className={editorStyles.sliderLabel}>{label}</span>
      <button
        type="button"
        className={`${editorStyles.toggle} ${checked ? editorStyles.active : ''}`.trim()}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      />
    </div>
  );
}

/** Heading or Body type style — font, weight, size, line-height, spacing.
 *  Text COLOR is not here; it lives in the Colors section (Text token). */
function FontPanel({
  title,
  fontValue, onFontChange,
  size, onSizeChange,
  weight, onWeightChange,
  lineHeight, onLineHeightChange,
  letterSpacing, onLetterSpacingChange,
  sizeMin = 10, sizeMax = 48,
}: {
  title: string;
  fontValue: string; onFontChange: (v: string) => void;
  size: number; onSizeChange: (v: number) => void;
  weight: number; onWeightChange: (v: number) => void;
  lineHeight: number; onLineHeightChange: (v: number) => void;
  letterSpacing: number; onLetterSpacingChange: (v: number) => void;
  sizeMin?: number; sizeMax?: number;
}) {
  const fontDef = getFontDef(fontValue);
  const availableWeights = fontDef.weights;
  const snappedWeight = availableWeights.includes(weight)
    ? weight
    : availableWeights.reduce((prev, curr) => Math.abs(curr - weight) < Math.abs(prev - weight) ? curr : prev);

  const handleFontChange = (newFontValue: string) => {
    const newDef = getFontDef(newFontValue);
    onFontChange(newFontValue);
    if (!newDef.weights.includes(weight)) {
      const nearest = newDef.weights.reduce((prev, curr) =>
        Math.abs(curr - weight) < Math.abs(prev - weight) ? curr : prev
      );
      onWeightChange(nearest);
    }
  };

  return (
    <div style={{
      background: 'var(--bg)', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)', padding: '0.75rem', marginBottom: '0.5rem',
    }}>
      <div style={{ marginBottom: '0.625rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>{title}</span>
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <select className="input" value={fontValue} onChange={(e) => handleFontChange(e.target.value)}
          style={{ fontSize: '0.75rem', padding: '0.3125rem 0.5rem' }}>
          <optgroup label="System">
            {FONTS.filter(f => f.category === 'system').map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </optgroup>
          <optgroup label="Sans-serif">
            {FONTS.filter(f => f.category === 'sans').map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </optgroup>
          <optgroup label="Serif">
            {FONTS.filter(f => f.category === 'serif').map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </optgroup>
          <optgroup label="Monospace">
            {FONTS.filter(f => f.category === 'mono').map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </optgroup>
        </select>
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
          <span className={editorStyles.sliderLabel}>Weight</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
          {availableWeights.map((w) => (
            <button
              key={w}
              onClick={() => onWeightChange(w)}
              style={{
                padding: '0.1875rem 0.5rem',
                fontSize: '0.625rem',
                fontWeight: w >= 600 ? 600 : 400,
                borderRadius: '6px',
                border: snappedWeight === w ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                background: snappedWeight === w ? 'var(--primary-light, rgba(0,122,255,0.08))' : 'var(--bg-elevated, #fff)',
                color: snappedWeight === w ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.12s',
                lineHeight: 1.4,
                fontFamily: fontValue,
              }}
            >
              {WEIGHT_LABELS[w] || w}
            </button>
          ))}
        </div>
      </div>

      <SliderField label="Size" value={size} onChange={onSizeChange} min={sizeMin} max={sizeMax} unit="px" />
      <SliderField label="Line Height" value={lineHeight} onChange={onLineHeightChange} min={0.8} max={3} step={0.05} />
      <SliderField label="Spacing" value={letterSpacing} onChange={onLetterSpacingChange} min={-0.1} max={0.3} step={0.005} unit="em" />
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────── */
export default function VariablesPanel() {
  const { design, brand, updateDesign, questions } = useQuestionnaireStore();
  // Resolved view for DISPLAY — fields the questionnaire doesn't override
  // show their inherited Brand value. Writes still set sparse overrides.
  const r = resolveDesign(design, brand);

  const body = getBody(design);
  const heading = getHeading(design);

  // Edit a color variable = override it at the questionnaire level. Other
  // colors keep inheriting Brand; component colors re-derive at render.
  const handleColorChange = (key: keyof typeof design.colors, value: string) => {
    const next = { ...design.colors, [key]: value };
    if (key === 'primary') next.accent = value;
    updateDesign({ colors: next });
  };
  // Restore = clear the override (undefined) → inherit the Brand token again.
  const restoreColorVar = (key: keyof typeof design.colors) =>
    updateDesign({
      colors: { ...design.colors, [key]: undefined, ...(key === 'primary' ? { accent: undefined } : {}) },
    });

  const updateBody = (updates: Partial<typeof body>) =>
    updateDesign({
      typography: {
        ...design.typography,
        baseFontSize: { ...body, ...updates }.size,
        lineHeight: { ...body, ...updates }.lineHeight,
        body: { ...design.typography.body, ...updates },
      },
    });
  const updateHeading = (updates: Partial<typeof heading>) =>
    updateDesign({
      typography: {
        ...design.typography,
        headingWeight: { ...heading, ...updates }.weight,
        heading: { ...design.typography.heading, ...updates },
      },
    });

  return (
    <div className={designStyles.variablesBody}>
      {/* Colors */}
      <div className={editorStyles.designSection}>
        <SectionTitle>Colors</SectionTitle>
        <div className={designStyles.colorList}>
          <ColorField label="Background" value={r.colors.background} overridden={design.colors.background !== undefined}
            onChange={(v) => handleColorChange('background', v)} onRestore={() => restoreColorVar('background')} />
          <ColorField label="Surface" value={r.colors.surface} overridden={design.colors.surface !== undefined}
            onChange={(v) => handleColorChange('surface', v)} onRestore={() => restoreColorVar('surface')} />
          <ColorField label="Primary" value={r.colors.primary} overridden={design.colors.primary !== undefined}
            onChange={(v) => handleColorChange('primary', v)} onRestore={() => restoreColorVar('primary')} />
          <ColorField label="Text" value={r.colors.text} overridden={design.colors.text !== undefined}
            onChange={(v) => handleColorChange('text', v)} onRestore={() => restoreColorVar('text')} />
          <ColorField label="Muted" value={r.colors.textMuted} overridden={design.colors.textMuted !== undefined}
            onChange={(v) => handleColorChange('textMuted', v)} onRestore={() => restoreColorVar('textMuted')} />
        </div>
      </div>

      {/* Typography */}
      <div className={editorStyles.designSection}>
        <SectionTitle>Typography</SectionTitle>
        <FontPanel
          title="Heading"
          fontValue={design.typography.headingFont}
          onFontChange={(v) => updateDesign({ typography: { ...design.typography, headingFont: v } })}
          size={heading.size}
          onSizeChange={(v) => updateHeading({ size: v })}
          weight={heading.weight}
          onWeightChange={(v) => updateHeading({ weight: v })}
          lineHeight={heading.lineHeight}
          onLineHeightChange={(v) => updateHeading({ lineHeight: v })}
          letterSpacing={heading.letterSpacing}
          onLetterSpacingChange={(v) => updateHeading({ letterSpacing: v })}
          sizeMin={14}
          sizeMax={48}
        />
        <FontPanel
          title="Body"
          fontValue={design.typography.fontFamily}
          onFontChange={(v) => updateDesign({ typography: { ...design.typography, fontFamily: v } })}
          size={body.size}
          onSizeChange={(v) => updateBody({ size: v })}
          weight={body.weight}
          onWeightChange={(v) => updateBody({ weight: v })}
          lineHeight={body.lineHeight}
          onLineHeightChange={(v) => updateBody({ lineHeight: v })}
          letterSpacing={body.letterSpacing}
          onLetterSpacingChange={(v) => updateBody({ letterSpacing: v })}
          sizeMin={10}
          sizeMax={26}
        />
      </div>

      {/* Layout */}
      <div className={editorStyles.designSection}>
        <SectionTitle>Layout</SectionTitle>
        <SliderField label="Content Width" value={design.layout.maxWidth} onChange={(v) => updateDesign({ layout: { ...design.layout, maxWidth: v } })} min={400} max={1200} step={20} unit="px" />
        <SliderField label="Corner Radius" value={design.layout.borderRadius} onChange={(v) => updateDesign({ layout: { ...design.layout, borderRadius: v } })} min={0} max={30} unit="px" />
        <SliderField label="Card Padding" value={design.layout.padding} onChange={(v) => updateDesign({ layout: { ...design.layout, padding: v } })} min={0.5} max={4} step={0.25} unit="rem" />
        <SliderField label="Question Gap" value={Math.round(design.layout.questionSpacing * 16)} onChange={(v) => updateDesign({ layout: { ...design.layout, questionSpacing: v / 16 } })} min={8} max={64} step={2} unit="px" />
        <SliderField label="Option Gap" value={design.layout.optionGap ?? 8} onChange={(v) => updateDesign({ layout: { ...design.layout, optionGap: v } })} min={0} max={40} step={2} unit="px" />
      </div>

      {/* Behavior */}
      <div className={editorStyles.designSection}>
        <SectionTitle>Behavior</SectionTitle>
        <SliderField label="Auto-advance delay" value={design.behavior?.selectFeedbackMs ?? SELECT_FEEDBACK_MS} onChange={(v) => updateDesign({ behavior: { ...design.behavior, selectFeedbackMs: v } })} min={0} max={800} step={20} unit="ms" />
        <SliderField label="Show progress from Q" value={design.behavior?.progressStartQuestion ?? 1} onChange={(v) => updateDesign({ behavior: { ...design.behavior, progressStartQuestion: v } })} min={1} max={Math.max(1, questions.length)} step={1} />
        <ToggleField label="Show back button" checked={design.behavior?.showBackButton ?? true} onChange={(v) => updateDesign({ behavior: { ...design.behavior, showBackButton: v } })} />
        <ToggleField label="Allow going back" checked={design.behavior?.allowBack ?? true} onChange={(v) => updateDesign({ behavior: { ...design.behavior, allowBack: v } })} />
      </div>

      {/* Page background */}
      <div className={editorStyles.designSection}>
        <SectionTitle>Page Background</SectionTitle>
        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}>
          {(['solid', 'gradient', 'image'] as const).map((t) => (
            <button key={t}
              className={`btn btn-sm ${design.background.type === t ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => updateDesign({
                background: {
                  type: t,
                  value: t === 'gradient'
                    ? `linear-gradient(135deg, ${r.colors.background}, ${r.colors.primary})`
                    : t === 'image'
                      ? (design.background.type === 'image' ? design.background.value : '')
                      : r.colors.background,
                },
              })}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {design.background.type === 'solid' && (
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            Uses the <strong>Background</strong> color above.
          </p>
        )}
        {design.background.type === 'gradient' && (
          <input className="input" value={design.background.value}
            onChange={(e) => updateDesign({ background: { ...design.background, value: e.target.value } })}
            placeholder="CSS gradient..." />
        )}
        {design.background.type === 'image' && (
          <>
            <input
              className="input"
              value={design.background.value}
              onChange={(e) => updateDesign({ background: { ...design.background, value: e.target.value } })}
              placeholder="Paste image URL..."
              style={{ marginBottom: '0.5rem' }}
            />
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex' }}>
              Upload image
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => updateDesign({
                    background: { type: 'image', value: reader.result as string },
                  });
                  reader.readAsDataURL(f);
                }}
              />
            </label>
            {design.background.value && (
              <div
                aria-label="Background preview"
                style={{
                  marginTop: '0.5rem',
                  height: '80px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  backgroundImage: `url(${design.background.value})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
