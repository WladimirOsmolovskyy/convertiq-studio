import type { ReactNode } from 'react';

/**
 * Standalone layout for /docs — public page accessible without authentication.
 * Shows a minimal header with branding and auth CTAs.
 */
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '1rem 2rem',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
      }}>
        <a href="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          textDecoration: 'none',
          color: 'var(--text)',
        }}>
          <span style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            color: '#fff',
          }}>✦</span>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>QuizBuilder</span>
        </a>
        <span style={{
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          marginLeft: '0.25rem',
        }}>/ Documentation</span>
        <div style={{ flex: 1 }} />
        <a href="/login" className="btn btn-ghost btn-sm" style={{ fontSize: '0.8125rem' }}>Sign In</a>
        <a href="/signup" className="btn btn-primary btn-sm" style={{ fontSize: '0.8125rem' }}>Get Started</a>
      </header>
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '2.5rem 2rem' }}>
        {children}
      </main>
    </div>
  );
}
