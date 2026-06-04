'use client';

/**
 * Variables panel — the GLOBAL design tokens (colors, typography, layout,
 * background, button, progress, presets). Lifted verbatim from the prior
 * single-panel Design tab. Per the new architecture these tokens are
 * treated as the "variables" namespace; the Inspector tab edits per-element
 * overrides that may reference them.
 *
 * No behavior changes in this extraction — same controls, same handlers.
 */

import { RotateCcw, Link2 } from 'lucide-react';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { resolveDesign } from '@/lib/designResolve';
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

/** Look up font definition by CSS value */
function getFontDef(cssValue: string): FontDef {
  return FONTS.find(f => f.value === cssValue) || FONTS[0];
}

/* ── Helpers ───────────────────────────────────────────────────── */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return null;
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}
function isValidHex(c: string) { return /^#[0-9a-fA-F]{6}$/.test(c); }
function isLight(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 > 0.55;
}

/* ── Safe accessors (backward-compat for old saved configs) ──── */
function getBody(design: any) {
  return {
    size: design.typography.body?.size ?? design.typography.baseFontSize ?? 16,
    weight: design.typography.body?.weight ?? 400,
    lineHeight: design.typography.body?.lineHeight ?? design.typography.lineHeight ?? 1.6,
    letterSpacing: design.typography.body?.letterSpacing ?? 0,
    color: design.typography.body?.color ?? design.colors.text ?? '#1d1d1f',
  };
}
function getHeading(design: any) {
  return {
    size: design.typography.heading?.size ?? Math.round((design.typography.baseFontSize ?? 16) * 1.375),
    weight: design.typography.heading?.weight ?? design.typography.headingWeight ?? 700,
    lineHeight: design.typography.heading?.lineHeight ?? 1.2,
    letterSpacing: design.typography.heading?.letterSpacing ?? -0.02,
    color: design.typography.heading?.color ?? design.colors.text ?? '#1d1d1f',
  };
}

/* ── Sub-components ────────────────────────────────────────────── */
function ColorField({
  label, value, onChange, overridden, onRestore, inheritLabel = 'Brand',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Whether this color is locally overridden (vs inheriting). */
  overridden?: boolean;
  /** Clear the local override → inherit. When omitted, no state UI shows. */
  onRestore?: () => void;
  /** What this field inherits from when not overridden (chip label). */
  inheritLabel?: string;
}) {
  const displayColor = isValidHex(value) ? value : '#000000';
  return (
    <div className={editorStyles.colorField}>
      <div className={editorStyles.colorSwatch} style={{ backgroundColor: displayColor }}>
        <input type="color" value={displayColor} onChange={(e) => onChange(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.0625rem', minWidth: 0 }}>
        <span className={editorStyles.colorLabel}>{label}</span>
        <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', fontFamily: "'SF Mono', monospace" }}>
          {value.substring(0, 20)}
        </span>
      </div>
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

/** A font panel for Heading or Body with weight-aware controls */
function FontPanel({
  title,
  fontValue, onFontChange,
  size, onSizeChange,
  weight, onWeightChange,
  lineHeight, onLineHeightChange,
  letterSpacing, onLetterSpacingChange,
  color, onColorChange,
  sizeMin = 10, sizeMax = 48,
}: {
  title: string;
  fontValue: string; onFontChange: (v: string) => void;
  size: number; onSizeChange: (v: number) => void;
  weight: number; onWeightChange: (v: number) => void;
  lineHeight: number; onLineHeightChange: (v: number) => void;
  letterSpacing: number; onLetterSpacingChange: (v: number) => void;
  color: string; onColorChange: (v: string) => void;
  sizeMin?: number; sizeMax?: number;
}) {
  const displayColor = isValidHex(color) ? color : '#000000';
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div className={editorStyles.colorSwatch} style={{ backgroundColor: displayColor, width: 20, height: 20, borderRadius: 5 }}>
            <input type="color" value={displayColor} onChange={(e) => onColorChange(e.target.value)} />
          </div>
          <span style={{ fontSize: '0.625rem', fontFamily: "'SF Mono', monospace", color: 'var(--text-muted)' }}>{color}</span>
        </div>
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
  const { design, brand, updateDesign } = useQuestionnaireStore();
  // Resolved view for DISPLAY — fields the questionnaire doesn't override
  // show their inherited Brand value. Writes still set sparse overrides.
  const r = resolveDesign(design, brand);

  const body = getBody(design);
  const heading = getHeading(design);

  // Editing a color variable overrides it at the questionnaire level. The
  // other colors keep inheriting Brand, and component colors re-derive from
  // the resolved palette at render time (no more eager syncing).
  const handleColorChange = (key: keyof typeof design.colors, value: string) => {
    const next = { ...design.colors, [key]: value };
    if (key === 'primary') next.accent = value;
    updateDesign({ colors: next });
  };

  // Restore = clear the local override (set undefined) → the value inherits
  // its Brand token / derived default again at render time.
  const restoreColorVar = (key: keyof typeof design.colors) =>
    updateDesign({
      colors: { ...design.colors, [key]: undefined, ...(key === 'primary' ? { accent: undefined } : {}) },
    });
  const restoreButtonField = (field: keyof typeof design.components.button) =>
    updateDesign({ components: { ...design.components, button: { ...design.components.button, [field]: undefined } } });
  const restoreProgressField = (field: keyof typeof design.components.progress) =>
    updateDesign({ components: { ...design.components, progress: { ...design.components.progress, [field]: undefined } } });

  const updateBody = (updates: Partial<typeof body>) => {
    const merged = { ...body, ...updates };
    updateDesign({
      typography: {
        ...design.typography,
        baseFontSize: merged.size,
        lineHeight: merged.lineHeight,
        body: merged,
      },
    });
  };

  const updateHeading = (updates: Partial<typeof heading>) => {
    const merged = { ...heading, ...updates };
    updateDesign({
      typography: {
        ...design.typography,
        headingWeight: merged.weight,
        heading: merged,
      },
    });
  };

  return (
    <div className={designStyles.variablesBody}>
      {/* Colors */}
      <div className={editorStyles.designSection}>
        <SectionTitle>Colors</SectionTitle>
        <div className={editorStyles.colorGrid}>
          <ColorField label="Primary" value={r.colors.primary} overridden={design.colors.primary !== undefined}
            onChange={(v) => handleColorChange('primary', v)} onRestore={() => restoreColorVar('primary')} />
          <ColorField label="Secondary" value={r.colors.secondary} overridden={design.colors.secondary !== undefined}
            onChange={(v) => handleColorChange('secondary', v)} onRestore={() => restoreColorVar('secondary')} />
          <ColorField label="Background" value={r.colors.background} overridden={design.colors.background !== undefined}
            onChange={(v) => handleColorChange('background', v)} onRestore={() => restoreColorVar('background')} />
          <ColorField label="Surface" value={r.colors.surface} overridden={design.colors.surface !== undefined}
            onChange={(v) => handleColorChange('surface', v)} onRestore={() => restoreColorVar('surface')} />
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
          color={heading.color}
          onColorChange={(v) => updateHeading({ color: v })}
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
          color={body.color}
          onColorChange={(v) => updateBody({ color: v })}
          sizeMin={10}
          sizeMax={26}
        />
      </div>

      {/* Layout */}
      <div className={editorStyles.designSection}>
        <SectionTitle>Layout</SectionTitle>
        <SliderField label="Max Width" value={design.layout.maxWidth} onChange={(v) => updateDesign({ layout: { ...design.layout, maxWidth: v } })} min={400} max={1200} step={20} unit="px" />
        <SliderField label="Padding" value={design.layout.padding} onChange={(v) => updateDesign({ layout: { ...design.layout, padding: v } })} min={0.5} max={4} step={0.25} unit="rem" />
        <SliderField label="Border Radius" value={design.layout.borderRadius} onChange={(v) => updateDesign({ layout: { ...design.layout, borderRadius: v } })} min={0} max={30} unit="px" />
        <SliderField label="Question Gap" value={design.layout.questionSpacing} onChange={(v) => updateDesign({ layout: { ...design.layout, questionSpacing: v } })} min={0.5} max={4} step={0.25} unit="rem" />
      </div>

      {/* Background */}
      <div className={editorStyles.designSection}>
        <SectionTitle>Background</SectionTitle>
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

      {/* Button */}
      <div className={editorStyles.designSection}>
        <SectionTitle>Button</SectionTitle>
        <div className={editorStyles.colorGrid} style={{ marginBottom: '0.625rem' }}>
          <ColorField label="Background" value={r.components.button.background} inheritLabel="Primary"
            overridden={design.components.button.background !== undefined}
            onChange={(v) => updateDesign({ components: { ...design.components, button: { ...design.components.button, background: v, color: isLight(isValidHex(v) ? v : '#007aff') ? '#000000' : '#ffffff' } } })}
            onRestore={() => restoreButtonField('background')} />
          <ColorField label="Text" value={r.components.button.color} inheritLabel="Auto"
            overridden={design.components.button.color !== undefined}
            onChange={(v) => updateDesign({ components: { ...design.components, button: { ...design.components.button, color: v } } })}
            onRestore={() => restoreButtonField('color')} />
        </div>
        <SliderField label="Radius" value={r.components.button.borderRadius}
          onChange={(v) => updateDesign({ components: { ...design.components, button: { ...design.components.button, borderRadius: v } } })} min={0} max={980} unit="px" />
        <SliderField label="Font Size" value={r.components.button.fontSize}
          onChange={(v) => updateDesign({ components: { ...design.components, button: { ...design.components.button, fontSize: v } } })} min={12} max={22} unit="px" />
      </div>

      {/* Progress Bar */}
      <div className={editorStyles.designSection}>
        <SectionTitle>Progress Bar</SectionTitle>
        <div className={editorStyles.colorGrid} style={{ marginBottom: '0.625rem' }}>
          <ColorField label="Track" value={r.components.progress.background} inheritLabel="Auto"
            overridden={design.components.progress.background !== undefined}
            onChange={(v) => updateDesign({ components: { ...design.components, progress: { ...design.components.progress, background: v } } })}
            onRestore={() => restoreProgressField('background')} />
          <ColorField label="Fill" value={r.components.progress.fillColor} inheritLabel="Primary"
            overridden={design.components.progress.fillColor !== undefined}
            onChange={(v) => updateDesign({ components: { ...design.components, progress: { ...design.components.progress, fillColor: v } } })}
            onRestore={() => restoreProgressField('fillColor')} />
        </div>
        <SliderField label="Height" value={r.components.progress.height}
          onChange={(v) => updateDesign({ components: { ...design.components, progress: { ...design.components.progress, height: v } } })} min={2} max={12} unit="px" />
      </div>

      {/* Presets */}
      <div className={editorStyles.designSection}>
        <SectionTitle>Presets</SectionTitle>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {[
            { name: 'Light', dot: '#007aff', colors: { primary: '#007aff', secondary: '#5856d6', background: '#ffffff', surface: '#ffffff', text: '#1d1d1f', textMuted: '#6e6e73', accent: '#007aff', error: '#ff3b30', success: '#34c759' } },
            { name: 'Dark', dot: '#1c1c1e', border: true, colors: { primary: '#0a84ff', secondary: '#bf5af2', background: '#1c1c1e', surface: '#2c2c2e', text: '#f5f5f7', textMuted: '#8e8e93', accent: '#0a84ff', error: '#ff453a', success: '#30d158' } },
            { name: 'Warm', dot: 'linear-gradient(135deg, #ff6b6b, #ffa36b)', colors: { primary: '#ff6b6b', secondary: '#ffa36b', background: '#fefcfb', surface: '#ffffff', text: '#2d2d2d', textMuted: '#999999', accent: '#ff6b6b', error: '#ff4444', success: '#51cf66' } },
            { name: 'Indigo', dot: 'linear-gradient(135deg, #6366f1, #8b5cf6)', colors: { primary: '#6366f1', secondary: '#8b5cf6', background: '#0a0a14', surface: '#12121e', text: '#eeeef5', textMuted: '#7777aa', accent: '#6366f1', error: '#ef4444', success: '#22c55e' } },
          ].map(({ name, dot, border, colors }) => (
            <button key={name} className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)' }}
              onClick={() => {
                updateDesign({ colors: { ...design.colors, ...colors } });
                updateBody({ color: colors.text });
                updateHeading({ color: colors.text });
              }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, display: 'inline-block', border: border ? '1px solid var(--border)' : 'none' }} /> {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
