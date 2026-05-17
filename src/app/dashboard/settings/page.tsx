'use client';

import styles from '../dashboard.module.css';

export default function SettingsPage() {
  return (
    <div className={styles.contentBody}>
      <div className={styles.largeTitleBlock}>
        <h1 className={styles.largeTitle}>Settings</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 560 }}>
        <div className="card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.5rem', letterSpacing: '-0.012em' }}>
            Custom Domain
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.875rem', lineHeight: 1.5 }}>
            Connect a custom domain to serve your published questionnaires. Point a CNAME record to{' '}
            <code style={{ background: 'var(--surface-secondary)', padding: '0.0625rem 0.375rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
              quiz.yourdomain.com
            </code>
            .
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input className="input" placeholder="quiz.yourdomain.com" style={{ flex: 1 }} />
            <button className="btn btn-primary">Save</button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.5rem', letterSpacing: '-0.012em' }}>
            API Keys
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.875rem', lineHeight: 1.5 }}>
            OpenAI API key for AI-powered scoring of open-ended questions. Set via environment variable{' '}
            <code style={{ background: 'var(--surface-secondary)', padding: '0.0625rem 0.375rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
              OPENAI_API_KEY
            </code>
            .
          </p>
          <span className="badge badge-warning">Set in .env.local</span>
        </div>
      </div>
    </div>
  );
}
