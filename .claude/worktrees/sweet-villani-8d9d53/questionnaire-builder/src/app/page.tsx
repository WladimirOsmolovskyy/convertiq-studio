import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, rgba(99,102,241,0.08) 0%, transparent 50%), var(--bg)',
      padding: '2rem',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '600px' }} className="animate-fade-in">
        <div style={{
          width: '56px', height: '56px', borderRadius: 'var(--radius-lg)',
          background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 2rem', fontSize: '1.5rem', boxShadow: 'var(--shadow-glow)',
        }}>
          ✦
        </div>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.1 }}>
          Questionnaire<br />
          <span style={{ background: 'linear-gradient(135deg, var(--accent), #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Builder
          </span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: 1.7 }}>
          Create interactive questionnaires with branching logic, AI-powered scoring, and pixel-perfect design customization.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link href="/login" className="btn btn-primary btn-lg">
            Get Started
          </Link>
          <Link href="/login" className="btn btn-secondary btn-lg">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
