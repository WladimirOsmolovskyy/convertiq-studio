'use client';

import { useEffect, useState } from 'react';
import styles from '../dashboard.module.css';

type StoredApiKey = {
  key_type: 'openai';
  masked: string;
  updated_at: string;
};

export default function SettingsPage() {
  const [keys, setKeys] = useState<StoredApiKey[] | null>(null);
  const [openaiInput, setOpenaiInput] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/settings/api-keys');
    if (!res.ok) {
      setError('Failed to load API keys');
      return;
    }
    const data = await res.json();
    setKeys(data.keys);
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/api-keys')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load API keys'))))
      .then((data) => {
        if (!cancelled) setKeys(data.keys);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load API keys');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openai = keys?.find((k) => k.key_type === 'openai') ?? null;

  async function saveOpenAI() {
    if (!openaiInput.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_type: 'openai', value: openaiInput }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Save failed');
      }
      setOpenaiInput('');
      setEditing(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function removeOpenAI() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/api-keys?key_type=openai', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Remove failed');
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setSaving(false);
    }
  }

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
            OpenAI API Key
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.875rem', lineHeight: 1.5 }}>
            Used for AI scoring of open-ended questions. Stored per user; never shared across accounts.
          </p>

          {keys === null ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading…</p>
          ) : openai && !editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <code style={{ background: 'var(--surface-secondary)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', flex: 1, minWidth: 0 }}>
                {openai.masked}
              </code>
              <button className="btn btn-secondary" onClick={() => setEditing(true)} disabled={saving}>
                Replace
              </button>
              <button className="btn btn-bordered" onClick={removeOpenAI} disabled={saving}>
                Remove
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="input"
                type="password"
                placeholder="sk-..."
                value={openaiInput}
                onChange={(e) => setOpenaiInput(e.target.value)}
                style={{ flex: 1 }}
                autoComplete="off"
              />
              <button
                className="btn btn-primary"
                onClick={saveOpenAI}
                disabled={saving || !openaiInput.trim()}
              >
                Save
              </button>
              {openai && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setOpenaiInput('');
                    setEditing(false);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {error && (
            <p style={{ color: 'var(--danger, #d33)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
