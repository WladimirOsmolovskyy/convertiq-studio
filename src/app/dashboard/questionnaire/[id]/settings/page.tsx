'use client';

import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { Plus, Trash2, Link2 } from 'lucide-react';
import styles from '../editor.module.css';

export default function SettingsPage() {
  const { questionnaire, addLeadField, updateLeadField, removeLeadField } = useQuestionnaireStore();
  const fields = questionnaire?.lead_fields ?? [];

  // Build the example URL using the questionnaire's published domain + slug if
  // available; otherwise show a generic example.
  const exampleParams = fields
    .filter((f) => f.urlParam.trim().length > 0)
    .map((f) => `${encodeURIComponent(f.urlParam)}=value`)
    .join('&');
  const exampleUrl = `https://yourdomain.com/${questionnaire?.slug ?? 'your-quiz'}${
    exampleParams ? `?${exampleParams}` : ''
  }`;

  return (
    <div className={styles.editorPanel}>
      <div style={{ maxWidth: '720px' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '-0.018em' }}>
            Settings
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', letterSpacing: '-0.008em' }}>
            Configure how leads are captured from this questionnaire.
          </p>
        </div>

        <section style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.012em' }}>
              Custom fields
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={addLeadField}>
              <Plus size={13} strokeWidth={2.25} /> Add field
            </button>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '1rem', lineHeight: 1.5 }}>
            Values for these fields are captured silently from URL query parameters when
            a visitor lands on the published page. Useful for tracking tags
            (<code>utm_campaign</code>, <code>utm_source</code>) or pre-filled lead data
            (<code>name</code>, <code>email</code>). Captured values appear on each lead.
          </p>

          {fields.length === 0 ? (
            <div
              style={{
                padding: '1.5rem',
                border: '1px dashed var(--separator)',
                borderRadius: 'var(--radius-xl)',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                textAlign: 'center',
              }}
            >
              No custom fields yet. Click <b>Add field</b> to capture URL parameters as lead data.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 36px',
                  gap: '0.5rem',
                  padding: '0 0.625rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>Label</span>
                <span>URL parameter</span>
                <span></span>
              </div>
              {fields.map((field) => (
                <div
                  key={field.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 36px',
                    gap: '0.5rem',
                    alignItems: 'center',
                    background: 'var(--surface)',
                    border: '1px solid var(--separator)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '0.625rem',
                  }}
                >
                  <input
                    value={field.label}
                    onChange={(e) => updateLeadField(field.id, { label: e.target.value })}
                    placeholder="Display label"
                    style={{
                      padding: '0.4rem 0.55rem',
                      border: '1px solid var(--separator)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--surface)',
                      font: 'inherit',
                      fontSize: '0.8125rem',
                      color: 'var(--text)',
                    }}
                  />
                  <input
                    value={field.urlParam}
                    onChange={(e) => updateLeadField(field.id, { urlParam: e.target.value.trim() })}
                    placeholder="utm_campaign"
                    spellCheck={false}
                    style={{
                      padding: '0.4rem 0.55rem',
                      border: '1px solid var(--separator)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--surface)',
                      font: 'inherit',
                      fontSize: '0.8125rem',
                      color: 'var(--text)',
                      fontFamily: "ui-monospace, 'SF Mono', monospace",
                    }}
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeLeadField(field.id)}
                    aria-label="Remove field"
                    style={{ padding: '0.4rem', justifyContent: 'center' }}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {fields.length > 0 && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '0.875rem 1rem',
                background: 'var(--fill-quaternary)',
                border: '1px solid var(--separator)',
                borderRadius: 'var(--radius-xl)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                <Link2 size={13} strokeWidth={1.75} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Example link
                </span>
              </div>
              <code
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  color: 'var(--text)',
                  wordBreak: 'break-all',
                  fontFamily: "ui-monospace, 'SF Mono', monospace",
                }}
              >
                {exampleUrl}
              </code>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
