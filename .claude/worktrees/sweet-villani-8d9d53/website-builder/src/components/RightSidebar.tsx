import type { TemplateConfig } from '../types';
import { TextInput } from './ui/TextInput';
import { ColorPicker } from './ui/ColorPicker';

interface RightSidebarProps {
  selectedElementId: string | null;
  config: TemplateConfig;
  onChange: (config: TemplateConfig) => void;
  onClose: () => void;
}

export function RightSidebar({ selectedElementId, config, onChange, onClose }: RightSidebarProps) {
  if (!selectedElementId) return null;

  const overrides = config.elementOverrides?.[selectedElementId] || {};

  const updateOverride = (key: string, value: string) => {
    onChange({
      ...config,
      elementOverrides: {
        ...config.elementOverrides,
        [selectedElementId]: {
          ...(config.elementOverrides?.[selectedElementId] || {}),
          [key]: value
        }
      }
    });
  };

  const updateContentConfig = (key: keyof TemplateConfig['content'], value: string) => {
    onChange({
      ...config,
      content: {
        ...config.content,
        [key]: value
      }
    });
  };

  let contentControls = null;

  if (selectedElementId === 'heroTitle') {
    contentControls = <TextInput label="Hero Title" value={config.content.heroTitle} onChange={(v) => updateContentConfig('heroTitle', v)} />;
  } else if (selectedElementId === 'heroSubtitle') {
    contentControls = <TextInput label="Hero Subtitle" value={config.content.heroSubtitle} onChange={(v) => updateContentConfig('heroSubtitle', v)} />;
  } else if (selectedElementId === 'ctaButton') {
    contentControls = <TextInput label="Button Text" value={config.content.ctaText} onChange={(v) => updateContentConfig('ctaText', v)} />;
  } else if (selectedElementId === 'featuresTitle') {
    contentControls = <TextInput label="Features Title" value={config.content.featuresTitle} onChange={(v) => updateContentConfig('featuresTitle', v)} />;
  } else if (selectedElementId === 'footerText') {
    contentControls = <TextInput label="Footer Text" value={config.content.footerText} onChange={(v) => updateContentConfig('footerText', v)} />;
  }

  return (
    <aside style={{
      width: '320px',
      backgroundColor: 'var(--app-surface)',
      borderLeft: '1px solid var(--app-border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10,
      boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.2)',
      overflowY: 'auto'
    }}>
      <div style={{ padding: '2rem', borderBottom: '1px solid var(--app-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Local Data</h2>
          <p style={{ color: 'var(--app-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            ID: {selectedElementId}
          </p>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--app-text-muted)', cursor: 'pointer', fontSize: '1.25rem' }}>&times;</button>
      </div>
      
      <div style={{ padding: '1.5rem 2rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
          Content Mapping
        </h3>
        {contentControls || <p style={{ fontSize: '0.875rem', color: 'var(--app-text-muted)' }}>No global content mapping for this element.</p>}
      </div>

      <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--app-border)' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
          Design Overrides
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--app-text-muted)', marginBottom: '1rem' }}>These explicitly override the global CSS properties.</p>
        
        <ColorPicker label="Text Color" value={overrides.color || ''} onChange={(v) => updateOverride('color', v)} />
        <ColorPicker label="Background Color" value={overrides.backgroundColor || ''} onChange={(v) => updateOverride('backgroundColor', v)} />
      </div>
    </aside>
  );
}
