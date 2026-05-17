import type { ReactNode } from 'react';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid var(--separator)',
        background: 'var(--toolbar-bg)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <a href="/" style={{
          display: 'flex',
          alignItems: 'center',
          textDecoration: 'none',
          color: 'var(--text)',
          fontWeight: 600,
          fontSize: '0.9375rem',
          letterSpacing: '-0.014em',
        }}>
          Studio
        </a>
        <span style={{
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
        }}>/ Docs</span>
        <div style={{ flex: 1 }} />
        <a href="/login" className="btn btn-ghost btn-sm">Sign In</a>
        <a href="/signup" className="btn btn-primary btn-sm">Get Started</a>
      </header>
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
        {children}
      </main>
    </div>
  );
}
