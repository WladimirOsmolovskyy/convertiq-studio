import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '2rem',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 600 }}>
        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 3.5rem)',
          fontWeight: 700,
          marginBottom: '1.25rem',
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          color: 'var(--text)',
        }}>
          A marketing suite,<br />
          one workspace.
        </h1>
        <p style={{
          fontSize: '1.0625rem',
          color: 'var(--text-secondary)',
          marginBottom: '2.25rem',
          lineHeight: 1.5,
          letterSpacing: '-0.008em',
          maxWidth: 460,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          Questionnaires, ads, brand, and copy — built to feel like one product instead of five.
        </p>
        <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center' }}>
          <Link href="/signup" className="btn btn-primary btn-lg">
            Get Started
          </Link>
          <Link href="/login" className="btn btn-bordered btn-lg" style={{ borderRadius: 'var(--radius-full)' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
