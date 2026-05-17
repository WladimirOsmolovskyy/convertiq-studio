'use client';

import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import styles from '../editor.module.css';

const FONTS = [
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Outfit', value: "'Outfit', sans-serif" },
  { label: 'Playfair Display', value: "'Playfair Display', serif" },
  { label: 'DM Sans', value: "'DM Sans', sans-serif" },
  { label: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
  { label: 'Roboto Mono', value: "'Roboto Mono', monospace" },
];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className={styles.colorField}>
      <div className={styles.colorSwatch} style={{ backgroundColor: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
      <span className={styles.colorLabel}>{label}</span>
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
      <input
        type="range"
        className={styles.slider}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className={styles.sliderValue}>{value}{unit}</span>
    </div>
  );
}

export default function DesignEditor() {
  const { design, updateDesign, questions } = useQuestionnaireStore();

  const getBackgroundCSS = () => {
    if (design.background.type === 'gradient') return design.background.value;
    if (design.background.type === 'image') return `url(${design.background.value}) center/cover no-repeat`;
    return design.colors.background;
  };

  return (
    <div className={styles.editorBody} style={{ display: 'flex', overflow: 'hidden' }}>
      {/* Controls */}
      <div className={styles.editorPanel} style={{ maxWidth: '420px', flexShrink: 0 }}>
        {/* Colors */}
        <div className={styles.designSection}>
          <h3 className={styles.designSectionTitle}>Colors</h3>
          <div className={styles.colorGrid}>
            <ColorField label="Primary" value={design.colors.primary} onChange={(v) => updateDesign({ colors: { ...design.colors, primary: v } })} />
            <ColorField label="Secondary" value={design.colors.secondary} onChange={(v) => updateDesign({ colors: { ...design.colors, secondary: v } })} />
            <ColorField label="Background" value={design.colors.background} onChange={(v) => updateDesign({ colors: { ...design.colors, background: v } })} />
            <ColorField label="Surface" value={design.colors.surface} onChange={(v) => updateDesign({ colors: { ...design.colors, surface: v } })} />
            <ColorField label="Text" value={design.colors.text} onChange={(v) => updateDesign({ colors: { ...design.colors, text: v } })} />
            <ColorField label="Text Muted" value={design.colors.textMuted} onChange={(v) => updateDesign({ colors: { ...design.colors, textMuted: v } })} />
            <ColorField label="Accent" value={design.colors.accent} onChange={(v) => updateDesign({ colors: { ...design.colors, accent: v } })} />
            <ColorField label="Error" value={design.colors.error} onChange={(v) => updateDesign({ colors: { ...design.colors, error: v } })} />
          </div>
        </div>

        {/* Typography */}
        <div className={styles.designSection}>
          <h3 className={styles.designSectionTitle}>Typography</h3>
          <div style={{ marginBottom: '0.75rem' }}>
            <label className="input-label">Body Font</label>
            <select className="input" value={design.typography.fontFamily} onChange={(e) => updateDesign({ typography: { ...design.typography, fontFamily: e.target.value } })}>
              {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label className="input-label">Heading Font</label>
            <select className="input" value={design.typography.headingFont} onChange={(e) => updateDesign({ typography: { ...design.typography, headingFont: e.target.value } })}>
              {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <SliderField label="Font Size" value={design.typography.baseFontSize} onChange={(v) => updateDesign({ typography: { ...design.typography, baseFontSize: v } })} min={12} max={22} unit="px" />
          <SliderField label="Line Height" value={design.typography.lineHeight} onChange={(v) => updateDesign({ typography: { ...design.typography, lineHeight: v } })} min={1} max={2.5} step={0.1} />
          <SliderField label="Heading Weight" value={design.typography.headingWeight} onChange={(v) => updateDesign({ typography: { ...design.typography, headingWeight: v } })} min={400} max={900} step={100} />
        </div>

        {/* Layout */}
        <div className={styles.designSection}>
          <h3 className={styles.designSectionTitle}>Layout</h3>
          <SliderField label="Max Width" value={design.layout.maxWidth} onChange={(v) => updateDesign({ layout: { ...design.layout, maxWidth: v } })} min={400} max={1200} step={20} unit="px" />
          <SliderField label="Padding" value={design.layout.padding} onChange={(v) => updateDesign({ layout: { ...design.layout, padding: v } })} min={0.5} max={4} step={0.25} unit="rem" />
          <SliderField label="Spacing" value={design.layout.spacing} onChange={(v) => updateDesign({ layout: { ...design.layout, spacing: v } })} min={0.5} max={4} step={0.25} unit="rem" />
          <SliderField label="Border Radius" value={design.layout.borderRadius} onChange={(v) => updateDesign({ layout: { ...design.layout, borderRadius: v } })} min={0} max={30} unit="px" />
          <SliderField label="Q Spacing" value={design.layout.questionSpacing} onChange={(v) => updateDesign({ layout: { ...design.layout, questionSpacing: v } })} min={0.5} max={4} step={0.25} unit="rem" />
        </div>

        {/* Background */}
        <div className={styles.designSection}>
          <h3 className={styles.designSectionTitle}>Background</h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {(['solid', 'gradient'] as const).map((t) => (
              <button key={t} className={`btn btn-sm ${design.background.type === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => updateDesign({ background: { type: t, value: t === 'gradient' ? 'linear-gradient(135deg, #0a0a0f, #1a1a2e)' : design.colors.background } })}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {design.background.type === 'gradient' && (
            <input className="input" value={design.background.value} onChange={(e) => updateDesign({ background: { ...design.background, value: e.target.value } })} placeholder="CSS gradient..." />
          )}
        </div>

        {/* Button Style */}
        <div className={styles.designSection}>
          <h3 className={styles.designSectionTitle}>Button</h3>
          <div className={styles.colorGrid} style={{ marginBottom: '0.75rem' }}>
            <ColorField label="Background" value={design.components.button.background} onChange={(v) => updateDesign({ components: { ...design.components, button: { ...design.components.button, background: v } } })} />
            <ColorField label="Text Color" value={design.components.button.color} onChange={(v) => updateDesign({ components: { ...design.components, button: { ...design.components.button, color: v } } })} />
          </div>
          <SliderField label="Radius" value={design.components.button.borderRadius} onChange={(v) => updateDesign({ components: { ...design.components, button: { ...design.components.button, borderRadius: v } } })} min={0} max={30} unit="px" />
          <SliderField label="Font Size" value={design.components.button.fontSize} onChange={(v) => updateDesign({ components: { ...design.components, button: { ...design.components.button, fontSize: v } } })} min={12} max={22} unit="px" />
        </div>

        {/* Progress Bar */}
        <div className={styles.designSection}>
          <h3 className={styles.designSectionTitle}>Progress Bar</h3>
          <div className={styles.colorGrid} style={{ marginBottom: '0.75rem' }}>
            <ColorField label="Background" value={design.components.progress.background} onChange={(v) => updateDesign({ components: { ...design.components, progress: { ...design.components.progress, background: v } } })} />
            <ColorField label="Fill" value={design.components.progress.fillColor} onChange={(v) => updateDesign({ components: { ...design.components, progress: { ...design.components.progress, fillColor: v } } })} />
          </div>
          <SliderField label="Height" value={design.components.progress.height} onChange={(v) => updateDesign({ components: { ...design.components, progress: { ...design.components.progress, height: v } } })} min={2} max={12} unit="px" />
        </div>
      </div>

      {/* Live Preview */}
      <div className={styles.editorPreview} style={{ background: getBackgroundCSS(), flex: 1, padding: '2rem', overflow: 'auto' }}>
        <div style={{
          maxWidth: `${design.layout.maxWidth}px`,
          margin: '0 auto',
          fontFamily: design.typography.fontFamily,
          fontSize: `${design.typography.baseFontSize}px`,
          lineHeight: design.typography.lineHeight,
          color: design.colors.text,
        }}>
          {/* Progress bar preview */}
          <div style={{
            height: `${design.components.progress.height}px`,
            background: design.components.progress.background,
            borderRadius: '9999px',
            overflow: 'hidden',
            marginBottom: `${design.layout.spacing}rem`,
          }}>
            <div style={{ width: '40%', height: '100%', background: design.components.progress.fillColor, borderRadius: '9999px', transition: 'width 0.3s' }} />
          </div>

          {/* Question preview */}
          {(questions.length > 0 ? questions.slice(0, 2) : [{ id: '1', title: 'Sample Question', type: 'radio', options: [{ id: 'a', label: 'Option A' }, { id: 'b', label: 'Option B' }, { id: 'c', label: 'Option C' }] }]).map((q: any, idx: number) => (
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
                fontWeight: design.typography.headingWeight,
                fontSize: `${design.typography.baseFontSize * 1.25}px`,
                marginBottom: '1rem',
                color: design.colors.text,
              }}>
                {q.title}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(q.options || []).map((opt: any, i: number) => (
                  <div key={opt.id} style={{
                    padding: '0.75rem 1rem',
                    background: i === 0 ? design.components.option.selectedBackground : design.components.option.background,
                    border: i === 0 ? design.components.option.selectedBorder : design.components.option.border,
                    borderRadius: `${design.layout.borderRadius * 0.6}px`,
                    cursor: 'pointer',
                    color: design.colors.text,
                    fontSize: `${design.typography.baseFontSize}px`,
                    transition: 'all 0.15s',
                  }}>
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Button preview */}
          <div style={{ textAlign: 'center', marginTop: `${design.layout.spacing}rem` }}>
            <button style={{
              background: design.components.button.background,
              color: design.components.button.color,
              border: 'none',
              borderRadius: `${design.components.button.borderRadius}px`,
              padding: design.components.button.padding,
              fontSize: `${design.components.button.fontSize}px`,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: design.typography.fontFamily,
            }}>
              Next Question
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
