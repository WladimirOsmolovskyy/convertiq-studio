import { useEffect, useRef, useState } from 'react';
import type { TemplateConfig } from '../types';
import { Selectable } from './ui/Selectable';

interface TemplateAreaProps {
  config: TemplateConfig;
  isSelectMode?: boolean;
  selectedElementId?: string | null;
  onSelectElement?: (id: string) => void;
}

export function TemplateArea({ config, isSelectMode = false, selectedElementId = null, onSelectElement = () => {} }: TemplateAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'landing' | 'quiz' | 'results'>('landing');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Reset to landing if config heavily changes (optional, but good for builder)
  useEffect(() => {
    setView('landing');
  }, [config.quiz.enabled]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    
    // Apply CSS variables dynamically to the template sandbox root
    el.style.setProperty('--tpl-color-primary', config.colors.primary);
    el.style.setProperty('--tpl-color-secondary', config.colors.secondary);
    el.style.setProperty('--tpl-color-background', config.colors.background);
    el.style.setProperty('--tpl-color-surface', config.colors.surface);
    el.style.setProperty('--tpl-color-text', config.colors.text);
    el.style.setProperty('--tpl-color-text-muted', config.colors.textMuted);
    
    el.style.setProperty('--tpl-border-radius', `${config.layout.borderRadius}px`);
    el.style.setProperty('--tpl-spacing-section', `${config.layout.sectionSpacing}rem`);
    el.style.setProperty('--tpl-font-family', config.typography.fontFamily);
  }, [config]);

  return (
    <div 
      ref={containerRef} 
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--tpl-color-background)',
        color: 'var(--tpl-color-text)',
        fontFamily: 'var(--tpl-font-family)',
        overflowY: 'auto',
        position: 'relative',
        transition: 'background-color 0.3s ease, color 0.3s ease, font-family 0.3s ease'
      }}
    >
      <header style={{ padding: '2rem 4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 
          className="logo-clickable"
          onClick={() => setView('landing')}
          style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, cursor: 'pointer' }}
        >
          Logo
        </h1>
        <nav style={{ display: 'flex', gap: '2rem' }}>
          <span style={{ cursor: 'pointer', fontWeight: 500 }}>Features</span>
          <span style={{ cursor: 'pointer', fontWeight: 500 }}>Pricing</span>
          <span style={{ cursor: 'pointer', fontWeight: 500 }}>About</span>
        </nav>
      </header>

      {view === 'landing' && (
      <>
      <section style={{ 
        padding: 'var(--tpl-spacing-section) 4rem', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        textAlign: 'center',
        background: 'linear-gradient(180deg, var(--tpl-color-surface) 0%, transparent 100%)'
      }}>
        <Selectable 
          id="heroTitle" 
          isSelectMode={isSelectMode} 
          isSelected={selectedElementId === 'heroTitle'} 
          onSelect={onSelectElement}
          overrides={config.elementOverrides?.['heroTitle']}
        >
          <h2 style={{ fontSize: '4rem', fontWeight: 800, marginBottom: '1.5rem', lineHeight: 1.1, maxWidth: '800px' }}>
            {config.content.heroTitle}
          </h2>
        </Selectable>
        <Selectable 
          id="heroSubtitle" 
          isSelectMode={isSelectMode} 
          isSelected={selectedElementId === 'heroSubtitle'} 
          onSelect={onSelectElement}
          overrides={config.elementOverrides?.['heroSubtitle']}
        >
          <p style={{ fontSize: '1.25rem', color: 'var(--tpl-color-text-muted)', maxWidth: '600px', marginBottom: '3rem' }}>
            {config.content.heroSubtitle}
          </p>
        </Selectable>
        <Selectable 
          id="ctaButton" 
          isSelectMode={isSelectMode} 
          isSelected={selectedElementId === 'ctaButton'} 
          onSelect={onSelectElement}
          overrides={config.elementOverrides?.['ctaButton']}
        >
          <button 
            onClick={() => {
            if (config.content.ctaUrl) {
              window.open(config.content.ctaUrl, '_blank');
            } else if (config.quiz.enabled && config.quiz.questions.length > 0) {
              setView('quiz');
              setCurrentQuestionIndex(0);
              setAnswers({});
            }
          }}
          style={{
          backgroundColor: 'var(--tpl-color-primary)',
          color: '#fff',
          border: 'none',
          padding: '1rem 2.5rem',
          fontSize: '1.125rem',
          fontWeight: 600,
          borderRadius: 'var(--tpl-border-radius)',
          cursor: 'pointer',
            boxShadow: '0 10px 25px -5px var(--tpl-color-primary)',
            transition: 'all 0.2s',
          }}>
            {config.content.ctaText}
          </button>
        </Selectable>
      </section>

      {/* Features Section */}
      <section style={{ 
        padding: 'var(--tpl-spacing-section) 4rem',
        backgroundColor: 'var(--tpl-color-background)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <Selectable 
            id="featuresTitle" 
            isSelectMode={isSelectMode} 
            isSelected={selectedElementId === 'featuresTitle'} 
            onSelect={onSelectElement}
            overrides={config.elementOverrides?.['featuresTitle']}
          >
            <h2 style={{ fontSize: '2.5rem', fontWeight: 700, display: 'inline-block' }}>{config.content.featuresTitle}</h2>
          </Selectable>
        </div>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '2rem',
          maxWidth: '1000px',
          margin: '0 auto'
        }}>
          {config.content.features.map((feat, idx) => (
            <div key={idx} style={{
              backgroundColor: 'var(--tpl-color-surface)',
              padding: '2rem',
              borderRadius: 'var(--tpl-border-radius)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              transition: 'transform 0.2s',
              cursor: 'default'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{feat.icon}</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>{feat.title}</h3>
              <p style={{ color: 'var(--tpl-color-text-muted)', lineHeight: 1.6 }}>{feat.description}</p>
            </div>
          ))}
        </div>
      </section>
      </>
      )}

      {view === 'quiz' && config.quiz.enabled && config.quiz.questions[currentQuestionIndex] && (
        <section style={{ padding: 'var(--tpl-spacing-section) 4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minHeight: '60vh', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '3rem' }}>
            {config.quiz.questions[currentQuestionIndex].question}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '400px' }}>
            {config.quiz.questions[currentQuestionIndex].options.map((opt, i) => (
              <button 
                key={i}
                onClick={() => {
                  setAnswers(prev => ({ ...prev, [config.quiz.questions[currentQuestionIndex].id]: opt }));
                  if (currentQuestionIndex < config.quiz.questions.length - 1) {
                    setCurrentQuestionIndex(prev => prev + 1);
                  } else {
                    setView('results');
                  }
                }}
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--tpl-color-surface)',
                  color: 'var(--tpl-color-text)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 'var(--tpl-border-radius)',
                  fontSize: '1.125rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--tpl-color-primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
              >
                {opt}
              </button>
            ))}
          </div>
        </section>
      )}

      {view === 'results' && (
        <section style={{ padding: 'var(--tpl-spacing-section) 4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minHeight: '60vh' }}>
          <h2 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1.5rem' }}>{config.results.title}</h2>
          <p style={{ fontSize: '1.25rem', color: 'var(--tpl-color-text-muted)', maxWidth: '600px', marginBottom: '2rem' }}>{config.results.description}</p>
          
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '4rem' }}>
            {Object.entries(answers).map(([key, value]) => {
              const q = config.quiz.questions.find(q => q.id === key);
              return (
                <div key={key} style={{ backgroundColor: 'var(--tpl-color-surface)', padding: '1rem 1.5rem', borderRadius: 'var(--tpl-border-radius)', textAlign: 'left', minWidth: '250px' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--tpl-color-text-muted)', marginBottom: '0.5rem' }}>{q?.question}</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{value}</div>
                </div>
              );
            })}
          </div>

          {config.results.calendlyUrl && (
            <div style={{ width: '100%', maxWidth: '900px', height: '700px', borderRadius: 'var(--tpl-border-radius)', overflow: 'hidden', backgroundColor: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <iframe 
                src={`${config.results.calendlyUrl.split('?')[0]}?hide_gdpr_banner=1&background_color=ffffff&text_color=1a1a1a&primary_color=3b82f6`} 
                width="100%" 
                height="100%" 
                frameBorder="0"
                title="Calendly"
              ></iframe>
            </div>
          )}
          
          <button 
            onClick={() => setView('landing')} 
            style={{ marginTop: '2rem', background: 'transparent', color: 'var(--tpl-color-text-muted)', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Start Over
          </button>
        </section>
      )}

      {/* Footer */}
      <footer style={{
        padding: '3rem 4rem',
        textAlign: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        color: 'var(--tpl-color-text-muted)'
      }}>
        <Selectable 
          id="footerText" 
          isSelectMode={isSelectMode} 
          isSelected={selectedElementId === 'footerText'} 
          onSelect={onSelectElement}
          overrides={config.elementOverrides?.['footerText']}
        >
          <p style={{ display: 'inline-block' }}>{config.content.footerText}</p>
        </Selectable>
      </footer>
    </div>
  );
}
