'use client';

import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import styles from '../editor.module.css';

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
function rgba(hex: string, alpha: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${alpha})`;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}
function adjustBrightness(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  return `#${[clamp(rgb[0] + amount), clamp(rgb[1] + amount), clamp(rgb[2] + amount)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
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
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const displayColor = isValidHex(value) ? value : '#000000';
  return (
    <div className={styles.colorField}>
      <div className={styles.colorSwatch} style={{ backgroundColor: displayColor }}>
        <input type="color" value={displayColor} onChange={(e) => onChange(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.0625rem' }}>
        <span className={styles.colorLabel}>{label}</span>
        <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', fontFamily: "'SF Mono', monospace" }}>
          {value.substring(0, 20)}
        </span>
      </div>
    </div>
  );
}

function SliderField({
  label, value, onChange, min, max, step = 1, unit = '',
}: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string;
}) {
  return (
    <div className={styles.sliderRow}>
      <span className={styles.sliderLabel}>{label}</span>
      <input type="range" className={styles.slider} min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
      <span className={styles.sliderValue}>{value}{unit}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className={styles.designSectionTitle}>{children}</h3>;
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

  // Snap weight to nearest available if current weight isn't supported
  const snappedWeight = availableWeights.includes(weight)
    ? weight
    : availableWeights.reduce((prev, curr) => Math.abs(curr - weight) < Math.abs(prev - weight) ? curr : prev);

  // When font changes, snap weight to nearest available
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
      {/* Header: title + color picker */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div className={styles.colorSwatch} style={{ backgroundColor: displayColor, width: 20, height: 20, borderRadius: 5 }}>
            <input type="color" value={displayColor} onChange={(e) => onColorChange(e.target.value)} />
          </div>
          <span style={{ fontSize: '0.625rem', fontFamily: "'SF Mono', monospace", color: 'var(--text-muted)' }}>{color}</span>
        </div>
      </div>

      {/* Font family selector grouped by category */}
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

      {/* Weight selector — pill buttons for available weights only */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
          <span className={styles.sliderLabel}>Weight</span>
        </div>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.25rem',
        }}>
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

      {/* Other sliders */}
      <SliderField label="Size" value={size} onChange={onSizeChange} min={sizeMin} max={sizeMax} unit="px" />
      <SliderField label="Line Height" value={lineHeight} onChange={onLineHeightChange} min={0.8} max={3} step={0.05} />
      <SliderField label="Spacing" value={letterSpacing} onChange={onLetterSpacingChange} min={-0.1} max={0.3} step={0.005} unit="em" />
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────── */
export default function DesignEditor() {
  const { design, updateDesign, questions } = useQuestionnaireStore();

  const body = getBody(design);
  const heading = getHeading(design);

  const getBackgroundCSS = () => {
    if (design.background.type === 'gradient') return design.background.value;
    if (design.background.type === 'image') return `url(${design.background.value}) center/cover no-repeat`;
    return design.colors.background;
  };

  const syncColorsToComponents = (colors: typeof design.colors) => {
    const bg = colors.background;
    const primary = colors.primary;
    const surface = colors.surface;
    const light = isLight(isValidHex(bg) ? bg : '#ffffff');

    updateDesign({
      colors,
      components: {
        question: {
          background: surface,
          border: `1px solid ${light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
          shadow: light ? '0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)' : '0 4px 24px rgba(0,0,0,0.3)',
          padding: '2rem',
        },
        option: {
          background: light ? adjustBrightness(isValidHex(bg) ? bg : '#ffffff', -8) : 'rgba(255,255,255,0.04)',
          hoverBackground: light ? adjustBrightness(isValidHex(bg) ? bg : '#ffffff', -16) : 'rgba(255,255,255,0.08)',
          selectedBackground: rgba(isValidHex(primary) ? primary : '#007aff', 0.08),
          border: `1px solid ${light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
          selectedBorder: `1px solid ${rgba(isValidHex(primary) ? primary : '#007aff', 0.4)}`,
        },
        button: {
          ...design.components.button,
          background: primary,
          color: isLight(isValidHex(primary) ? primary : '#007aff') ? '#000000' : '#ffffff',
        },
        progress: {
          background: light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
          fillColor: primary,
          height: design.components.progress.height,
        },
        input: {
          background: surface,
          border: `1px solid ${light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
          focusBorder: `1px solid ${primary}`,
          borderRadius: design.components.input.borderRadius,
        },
      },
      background: {
        type: design.background.type,
        value: design.background.type === 'solid' ? bg : design.background.value,
      },
    });
  };

  const handleColorChange = (key: keyof typeof design.colors, value: string) => {
    const newColors = { ...design.colors, [key]: value };
    if (key === 'primary') newColors.accent = value;
    syncColorsToComponents(newColors);
  };

  /** Update body typography */
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

  /** Update heading typography */
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

  const sampleQuestions = questions.length > 0
    ? questions.slice(0, 2)
    : [
        { id: '1', title: 'How satisfied are you with our service?', type: 'radio', description: 'Select the option that best matches your experience.', options: [{ id: 'a', label: 'Very satisfied' }, { id: 'b', label: 'Satisfied' }, { id: 'c', label: 'Neutral' }] },
        { id: '2', title: 'Any additional feedback?', type: 'text', description: '', options: [] },
      ];

  return (
    <div className={styles.editorBody} style={{ display: 'flex', overflow: 'hidden' }}>
      {/* ─── Controls Panel ─────────────────────────────────── */}
      <div className={styles.editorPanel} style={{ maxWidth: '400px', flexShrink: 0, borderRight: '1px solid var(--separator)' }}>
        {/* Colors */}
        <div className={styles.designSection}>
          <SectionTitle>Colors</SectionTitle>
          <div className={styles.colorGrid}>
            <ColorField label="Primary" value={design.colors.primary} onChange={(v) => handleColorChange('primary', v)} />
            <ColorField label="Secondary" value={design.colors.secondary} onChange={(v) => handleColorChange('secondary', v)} />
            <ColorField label="Background" value={design.colors.background} onChange={(v) => handleColorChange('background', v)} />
            <ColorField label="Surface" value={design.colors.surface} onChange={(v) => handleColorChange('surface', v)} />
          </div>
        </div>

        {/* Typography */}
        <div className={styles.designSection}>
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
        <div className={styles.designSection}>
          <SectionTitle>Layout</SectionTitle>
          <SliderField label="Max Width" value={design.layout.maxWidth} onChange={(v) => updateDesign({ layout: { ...design.layout, maxWidth: v } })} min={400} max={1200} step={20} unit="px" />
          <SliderField label="Padding" value={design.layout.padding} onChange={(v) => updateDesign({ layout: { ...design.layout, padding: v } })} min={0.5} max={4} step={0.25} unit="rem" />
          <SliderField label="Border Radius" value={design.layout.borderRadius} onChange={(v) => updateDesign({ layout: { ...design.layout, borderRadius: v } })} min={0} max={30} unit="px" />
          <SliderField label="Question Gap" value={design.layout.questionSpacing} onChange={(v) => updateDesign({ layout: { ...design.layout, questionSpacing: v } })} min={0.5} max={4} step={0.25} unit="rem" />
        </div>

        {/* Background */}
        <div className={styles.designSection}>
          <SectionTitle>Background</SectionTitle>
          <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}>
            {(['solid', 'gradient'] as const).map((t) => (
              <button key={t}
                className={`btn btn-sm ${design.background.type === t ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => updateDesign({
                  background: {
                    type: t,
                    value: t === 'gradient'
                      ? `linear-gradient(135deg, ${design.colors.background}, ${design.colors.primary})`
                      : design.colors.background,
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
        </div>

        {/* Button */}
        <div className={styles.designSection}>
          <SectionTitle>Button</SectionTitle>
          <div className={styles.colorGrid} style={{ marginBottom: '0.625rem' }}>
            <ColorField label="Background" value={design.components.button.background}
              onChange={(v) => updateDesign({ components: { ...design.components, button: { ...design.components.button, background: v, color: isLight(isValidHex(v) ? v : '#007aff') ? '#000000' : '#ffffff' } } })} />
            <ColorField label="Text" value={design.components.button.color}
              onChange={(v) => updateDesign({ components: { ...design.components, button: { ...design.components.button, color: v } } })} />
          </div>
          <SliderField label="Radius" value={design.components.button.borderRadius}
            onChange={(v) => updateDesign({ components: { ...design.components, button: { ...design.components.button, borderRadius: v } } })} min={0} max={980} unit="px" />
          <SliderField label="Font Size" value={design.components.button.fontSize}
            onChange={(v) => updateDesign({ components: { ...design.components, button: { ...design.components.button, fontSize: v } } })} min={12} max={22} unit="px" />
        </div>

        {/* Progress Bar */}
        <div className={styles.designSection}>
          <SectionTitle>Progress Bar</SectionTitle>
          <div className={styles.colorGrid} style={{ marginBottom: '0.625rem' }}>
            <ColorField label="Track" value={design.components.progress.background}
              onChange={(v) => updateDesign({ components: { ...design.components, progress: { ...design.components.progress, background: v } } })} />
            <ColorField label="Fill" value={design.components.progress.fillColor}
              onChange={(v) => updateDesign({ components: { ...design.components, progress: { ...design.components.progress, fillColor: v } } })} />
          </div>
          <SliderField label="Height" value={design.components.progress.height}
            onChange={(v) => updateDesign({ components: { ...design.components, progress: { ...design.components.progress, height: v } } })} min={2} max={12} unit="px" />
        </div>

        {/* Presets */}
        <div className={styles.designSection}>
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
                  syncColorsToComponents({ ...design.colors, ...colors });
                  // Also update body/heading text colors to match
                  updateBody({ color: colors.text });
                  updateHeading({ color: colors.text });
                }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, display: 'inline-block', border: border ? '1px solid var(--border)' : 'none' }} /> {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Live Preview ────────────────────────────────────── */}
      <div style={{ flex: 1, background: getBackgroundCSS(), padding: '2rem', overflow: 'auto' }}>
        <div style={{
          maxWidth: `${design.layout.maxWidth}px`,
          margin: '0 auto',
          fontFamily: design.typography.fontFamily,
          fontSize: `${body.size}px`,
          fontWeight: body.weight,
          lineHeight: body.lineHeight,
          letterSpacing: `${body.letterSpacing}em`,
          color: body.color,
        }}>
          {/* Progress bar */}
          <div style={{
            height: `${design.components.progress.height}px`,
            background: design.components.progress.background,
            borderRadius: '9999px', overflow: 'hidden',
            marginBottom: `${design.layout.spacing}rem`,
          }}>
            <div style={{ width: '45%', height: '100%', background: design.components.progress.fillColor, borderRadius: '9999px', transition: 'width 0.3s' }} />
          </div>

          {/* Question cards */}
          {sampleQuestions.map((q: any) => (
            <div key={q.id} style={{
              background: design.components.question.background,
              border: design.components.question.border,
              boxShadow: design.components.question.shadow,
              padding: design.components.question.padding,
              borderRadius: `${design.layout.borderRadius}px`,
              marginBottom: `${design.layout.questionSpacing}rem`,
            }}>
              <h3 style={{
                fontFamily: design.typography.headingFont,
                fontWeight: heading.weight,
                fontSize: `${heading.size}px`,
                lineHeight: heading.lineHeight,
                letterSpacing: `${heading.letterSpacing}em`,
                color: heading.color,
                marginBottom: q.description ? '0.25rem' : '1rem',
              }}>
                {q.title}
              </h3>

              {q.description && (
                <p style={{
                  fontSize: `${body.size * 0.875}px`,
                  color: design.colors.textMuted,
                  marginBottom: '1rem',
                  fontWeight: body.weight,
                  lineHeight: body.lineHeight,
                  letterSpacing: `${body.letterSpacing}em`,
                }}>
                  {q.description}
                </p>
              )}

              {/* Radio options — 2-col grid of clean tiles, no indicator dot. */}
              {q.options.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '0.5rem',
                  }}
                >
                  {q.options.map((opt: any, i: number) => (
                    <div
                      key={opt.id}
                      style={{
                        padding: '1rem 1.125rem',
                        minHeight: 64,
                        background: i === 0 ? design.components.option.selectedBackground : design.components.option.background,
                        border: i === 0 ? design.components.option.selectedBorder : design.components.option.border,
                        borderRadius: `${design.layout.borderRadius * 0.6}px`,
                        cursor: 'pointer',
                        color: body.color,
                        fontSize: `${body.size}px`,
                        fontWeight: 500,
                        letterSpacing: `${body.letterSpacing}em`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                      }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}

              {/* Text input */}
              {q.type === 'text' && (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: design.components.input.background,
                  border: design.components.input.border,
                  borderRadius: `${design.components.input.borderRadius}px`,
                  color: design.colors.textMuted,
                  fontSize: `${body.size}px`,
                  fontWeight: body.weight,
                  letterSpacing: `${body.letterSpacing}em`,
                }}>
                  Type your answer here…
                </div>
              )}
            </div>
          ))}

          {/* Button */}
          <div style={{ textAlign: 'center', marginTop: `${design.layout.spacing}rem` }}>
            <button style={{
              background: design.components.button.background,
              color: design.components.button.color,
              border: 'none',
              borderRadius: `${design.components.button.borderRadius}px`,
              padding: design.components.button.padding,
              fontSize: `${design.components.button.fontSize}px`,
              fontWeight: 600, cursor: 'pointer',
              fontFamily: design.typography.fontFamily,
              transition: 'all 0.15s',
            }}>
              Next Question →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
