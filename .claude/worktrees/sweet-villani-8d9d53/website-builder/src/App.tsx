import { useState } from 'react';
import './App.css';
import { defaultConfig } from './types';
import { Sidebar } from './components/Sidebar';
import { TemplateArea } from './components/TemplateArea';
import { RightSidebar } from './components/RightSidebar';

function App() {
  const [config, setConfig] = useState(defaultConfig);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [publishStatus, setPublishStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  return (
    <div className="app-container">
      <Sidebar config={config} onChange={setConfig} onPublish={() => setIsPublishModalOpen(true)} />
      <main className="preview-area">
        <div style={{ position: 'absolute', top: '1rem', right: '2rem', display: 'flex', gap: '0.5rem', zIndex: 20 }}>
          <button 
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedElementId(null);
            }}
            style={{ 
              padding: '0.5rem 1rem', 
              borderRadius: '6px', 
              border: `1px solid ${isSelectMode ? 'var(--app-accent)' : 'transparent'}`, 
              backgroundColor: isSelectMode ? 'rgba(59, 130, 246, 0.1)' : 'var(--app-surface)',
              color: isSelectMode ? 'var(--app-accent)' : 'var(--app-text)',
              cursor: 'pointer',
              fontWeight: 600,
              marginRight: '1rem'
            }}
          >
            {isSelectMode ? 'Select Mode: ON' : 'Canvas Select'}
          </button>
          <button 
            onClick={() => setPreviewMode('desktop')}
            style={{ 
              padding: '0.5rem 1rem', 
              borderRadius: '6px', 
              border: 'none', 
              backgroundColor: previewMode === 'desktop' ? 'var(--app-surface-hover)' : 'transparent',
              color: previewMode === 'desktop' ? 'var(--app-text)' : 'var(--app-text-muted)',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Desktop
          </button>
          <button 
            onClick={() => setPreviewMode('mobile')}
            style={{ 
              padding: '0.5rem 1rem', 
              borderRadius: '6px', 
              border: 'none', 
              backgroundColor: previewMode === 'mobile' ? 'var(--app-surface-hover)' : 'transparent',
              color: previewMode === 'mobile' ? 'var(--app-text)' : 'var(--app-text-muted)',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Mobile
          </button>
        </div>
        <div 
          className="template-wrapper" 
          style={{ 
            maxWidth: previewMode === 'desktop' ? '1200px' : '375px',
            transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <TemplateArea 
            config={config} 
            isSelectMode={isSelectMode} 
            selectedElementId={selectedElementId} 
            onSelectElement={setSelectedElementId} 
          />
        </div>
      </main>

      {selectedElementId && (
        <RightSidebar 
          selectedElementId={selectedElementId} 
          config={config} 
          onChange={setConfig} 
          onClose={() => setSelectedElementId(null)} 
        />
      )}

      {isPublishModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{
            backgroundColor: 'var(--app-surface)',
            border: '1px solid var(--app-border)',
            borderRadius: '12px',
            padding: '2rem',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Publish Website</h2>
            
            {publishStatus === 'idle' && (
              <>
                <p style={{ color: 'var(--app-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  Choose a subdomain to deploy your site.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', backgroundColor: 'var(--app-bg)', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--app-border)' }}>
                  <input 
                    type="text" 
                    value={subdomain} 
                    onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="my-cool-site"
                    style={{ background: 'transparent', border: 'none', color: 'var(--app-text)', flex: 1, outline: 'none', fontSize: '1rem' }}
                  />
                  <span style={{ color: 'var(--app-text-muted)', fontSize: '0.875rem' }}>.yourdomain.com</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => setIsPublishModalOpen(false)}
                    style={{ padding: '0.5rem 1rem', background: 'transparent', border: 'none', color: 'var(--app-text-muted)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      if (!subdomain) return;
                      setPublishStatus('loading');
                      setTimeout(() => setPublishStatus('success'), 2000);
                    }}
                    disabled={!subdomain}
                    style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--app-accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: subdomain ? 'pointer' : 'not-allowed', opacity: subdomain ? 1 : 0.5, fontWeight: 500 }}
                  >
                    Publish
                  </button>
                </div>
              </>
            )}

            {publishStatus === 'loading' && (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid var(--app-border)', borderTopColor: 'var(--app-accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ color: 'var(--app-text)', fontWeight: 500 }}>Deploying your configuration...</p>
              </div>
            )}

            {publishStatus === 'success' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', fontSize: '1.5rem' }}>
                  ✓
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Successfully Published!</h3>
                <p style={{ color: 'var(--app-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Your configuration is now successfully built.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--app-bg)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--app-border)', marginBottom: '1.5rem' }}>
                  <a href={`https://${subdomain}.yourdomain.com`} target="_blank" rel="noreferrer" style={{ color: 'var(--app-accent)', textDecoration: 'none', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    https://{subdomain}.yourdomain.com
                  </a>
                  <button 
                    onClick={() => navigator.clipboard.writeText(`https://${subdomain}.yourdomain.com`)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--app-text-muted)', cursor: 'pointer', fontSize: '1rem' }}
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </div>
                <button 
                  onClick={() => {
                    setIsPublishModalOpen(false);
                    setPublishStatus('idle');
                    setSubdomain('');
                  }}
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--app-surface-hover)', color: 'var(--app-text)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
