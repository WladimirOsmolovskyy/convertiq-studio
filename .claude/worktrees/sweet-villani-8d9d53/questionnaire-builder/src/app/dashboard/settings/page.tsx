'use client';

import styles from '../dashboard.module.css';

export default function SettingsPage() {
  return (
    <>
      <div className={styles.contentHeader}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700 }}>Settings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Manage your account and preferences
          </p>
        </div>
      </div>

      <div className={styles.contentBody}>
        <div className="card" style={{ maxWidth: '600px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Custom Domain</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Connect a custom domain to serve your published questionnaires. Point a CNAME record to <code style={{ background: 'var(--bg)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>quiz.yourdomain.com</code>.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input className="input" placeholder="quiz.yourdomain.com" style={{ flex: 1 }} />
            <button className="btn btn-primary">Save</button>
          </div>
        </div>

        <div className="card" style={{ maxWidth: '600px', marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>API Keys</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            OpenAI API key for AI-powered scoring of open-ended questions. Set via environment variable <code style={{ background: 'var(--bg)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>OPENAI_API_KEY</code>.
          </p>
          <span className="badge badge-warning">Set in .env.local</span>
        </div>
      </div>
    </>
  );
}
