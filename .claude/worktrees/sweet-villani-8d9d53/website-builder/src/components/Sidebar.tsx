import type { TemplateConfig } from '../types';
import { TextInput } from './ui/TextInput';
import { ColorPicker } from './ui/ColorPicker';
import { Slider } from './ui/Slider';

interface SidebarProps {
  config: TemplateConfig;
  onChange: (config: TemplateConfig) => void;
  onPublish: () => void;
}

const fonts = [
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Outfit', value: "'Outfit', sans-serif" },
  { label: 'Playfair Display', value: "'Playfair Display', serif" },
  { label: 'Roboto Mono', value: "'Roboto Mono', monospace" }
];

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--app-border)' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function Sidebar({ config, onChange, onPublish }: SidebarProps) {
  const updateConfig = (category: keyof TemplateConfig, key: string, value: any) => {
    onChange({
      ...config,
      [category]: {
        ...config[category],
        [key]: value
      }
    });
  };

  return (
    <aside className="sidebar">
      <div style={{ padding: '2rem', borderBottom: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Builder</h2>
          <p style={{ color: 'var(--app-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Real-time website customization
          </p>
        </div>
        <button 
          onClick={onPublish}
          style={{
            backgroundColor: 'var(--app-accent)',
            color: '#fff',
            border: 'none',
            padding: '0.75rem',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
            transition: 'transform 0.1s, opacity 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          Publish Site
        </button>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Section title="Content">
          <TextInput label="Hero Title" value={config.content.heroTitle} onChange={v => updateConfig('content', 'heroTitle', v)} />
          <TextInput label="Hero Subtitle" value={config.content.heroSubtitle} onChange={v => updateConfig('content', 'heroSubtitle', v)} />
          <TextInput label="CTA Text" value={config.content.ctaText} onChange={v => updateConfig('content', 'ctaText', v)} />
          <TextInput label="Features Title" value={config.content.featuresTitle} onChange={v => updateConfig('content', 'featuresTitle', v)} />
          <TextInput label="Footer Text" value={config.content.footerText} onChange={v => updateConfig('content', 'footerText', v)} />
        </Section>

        <Section title="Navigation & Quiz">
          <TextInput label="CTA Explicit URL (Optional)" value={config.content.ctaUrl} onChange={v => updateConfig('content', 'ctaUrl', v)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <input 
              type="checkbox" 
              checked={config.quiz.enabled}
              onChange={e => updateConfig('quiz', 'enabled', e.target.checked)}
              style={{ width: '1rem', height: '1rem', accentColor: 'var(--app-accent)', cursor: 'pointer' }}
            />
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--app-text)', cursor: 'pointer' }}>Enable Interactive Quiz</label>
          </div>
        </Section>

        <Section title="Results Page">
          <TextInput label="Results Title" value={config.results.title} onChange={v => updateConfig('results', 'title', v)} />
          <TextInput label="Results Description" value={config.results.description} onChange={v => updateConfig('results', 'description', v)} />
          <TextInput label="Calendly URL" value={config.results.calendlyUrl} onChange={v => updateConfig('results', 'calendlyUrl', v)} />
        </Section>

        <Section title="Colors">
          <ColorPicker label="Primary" value={config.colors.primary} onChange={v => updateConfig('colors', 'primary', v)} />
          <ColorPicker label="Secondary" value={config.colors.secondary} onChange={v => updateConfig('colors', 'secondary', v)} />
          <ColorPicker label="Background" value={config.colors.background} onChange={v => updateConfig('colors', 'background', v)} />
          <ColorPicker label="Surface" value={config.colors.surface} onChange={v => updateConfig('colors', 'surface', v)} />
          <ColorPicker label="Text" value={config.colors.text} onChange={v => updateConfig('colors', 'text', v)} />
        </Section>

        <Section title="Typography">
           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--app-text)' }}>Font Family</label>
            <select 
              value={config.typography.fontFamily}
              onChange={e => updateConfig('typography', 'fontFamily', e.target.value)}
              style={{
                backgroundColor: 'var(--app-bg)',
                border: '1px solid var(--app-border)',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                color: 'var(--app-text)',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            >
              {fonts.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </Section>

        <Section title="Layout">
          <Slider label="Border Radius" min={0} max={40} value={config.layout.borderRadius} onChange={v => updateConfig('layout', 'borderRadius', v)} />
          <Slider label="Section Spacing" min={2} max={12} step={0.5} value={config.layout.sectionSpacing} onChange={v => updateConfig('layout', 'sectionSpacing', v)} />
        </Section>
      </div>
    </aside>
  );
}
