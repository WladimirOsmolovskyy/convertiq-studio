'use client';

import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { Flag, Plus, Trash2, Users } from 'lucide-react';
import styles from '../editor.module.css';

const AUDIENCE_PALETTE = [
  '#007aff', '#34c759', '#ff9500', '#ff3b30',
  '#af52de', '#5ac8fa', '#ffcc00', '#5856d6',
];

export default function AudiencesPage() {
  const {
    questionnaire,
    audiences,
    addAudience,
    updateAudience,
    removeAudience,
    addAudienceRange,
    updateAudienceRange,
    removeAudienceRange,
    setRedFlagThreshold,
    setRedFlagAudience,
  } = useQuestionnaireStore();

  if (!questionnaire) return null;

  const redFlagAudienceExists = audiences.some(
    (a) => a.id === questionnaire.red_flag_audience_id,
  );

  return (
    <div className={styles.editorPanel}>
      <div style={{ maxWidth: '760px' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '-0.018em' }}>
            Audiences
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', letterSpacing: '-0.008em' }}>
            Bucket completed leads using score ranges or red-flag counts. Audiences are
            assigned at submit time and can be used to filter delivery in <b>Integrations</b>.
          </p>
        </div>

        {/* ── Audiences list ──────────────────────────────────── */}
        <Section
          title="Audiences"
          subtitle="Each audience is a named bucket. Add ranges below to route leads by score."
        >
          {audiences.length === 0 ? (
            <div
              style={{
                padding: '1.5rem',
                border: '1px dashed var(--separator)',
                borderRadius: 'var(--radius-xl)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  margin: '0 auto 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--fill-quaternary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Users size={20} strokeWidth={1.5} />
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>
                No audiences yet.
              </p>
              <button className="btn btn-primary btn-sm" onClick={addAudience}>
                <Plus size={13} strokeWidth={2.25} /> Add audience
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {audiences.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--separator)',
                      borderRadius: 'var(--radius-xl)',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.625rem',
                    }}
                  >
                    {/* Header row */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        gap: '0.5rem',
                        alignItems: 'center',
                      }}
                    >
                      <ColorSwatch
                        value={a.color}
                        onChange={(color) => updateAudience(a.id, { color })}
                      />
                      <input
                        value={a.name}
                        onChange={(e) => updateAudience(a.id, { name: e.target.value })}
                        placeholder="Audience name"
                        style={inputStyle}
                      />
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeAudience(a.id)}
                        aria-label="Remove audience"
                        title="Remove audience"
                        style={{ padding: '0.4rem', justifyContent: 'center' }}
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>

                    {/* Score ranges */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {a.score_ranges.length === 0 ? (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          No score ranges. Leads will only land here via the red-flag rule below.
                        </p>
                      ) : (
                        a.score_ranges.map((r) => (
                          <div
                            key={r.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'auto 1fr auto 1fr auto',
                              gap: '0.5rem',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Score
                            </span>
                            <input
                              type="number"
                              value={r.min_score ?? ''}
                              onChange={(e) =>
                                updateAudienceRange(a.id, r.id, {
                                  min_score: e.target.value === '' ? null : Number(e.target.value),
                                })
                              }
                              placeholder="min"
                              style={inputStyle}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              to
                            </span>
                            <input
                              type="number"
                              value={r.max_score ?? ''}
                              onChange={(e) =>
                                updateAudienceRange(a.id, r.id, {
                                  max_score: e.target.value === '' ? null : Number(e.target.value),
                                })
                              }
                              placeholder="max"
                              style={inputStyle}
                            />
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => removeAudienceRange(a.id, r.id)}
                              aria-label="Remove range"
                              title="Remove range"
                              style={{ padding: '0.4rem', justifyContent: 'center' }}
                            >
                              <Trash2 size={13} strokeWidth={1.75} />
                            </button>
                          </div>
                        ))
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => addAudienceRange(a.id)}
                        style={{ alignSelf: 'flex-start', marginTop: '0.125rem' }}
                      >
                        <Plus size={12} strokeWidth={2.25} /> Add score range
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={addAudience}
                style={{ marginTop: '0.75rem' }}
              >
                <Plus size={13} strokeWidth={2.25} /> Add audience
              </button>
            </>
          )}
        </Section>

        {/* ── Red flag rule ──────────────────────────────────── */}
        <Section
          title="Red flag rule"
          subtitle="Route leads to a specific audience when they hit a number of red-flag answers."
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              marginBottom: '0.875rem',
            }}
          >
            <Flag size={12} strokeWidth={1.75} style={{ color: 'var(--danger, #ff3b30)' }} />
            Mark answer options as red flags in the <b style={{ color: 'var(--text)' }}>Content</b> tab.
          </div>

          <Field label="Threshold">
            <input
              type="number"
              min={0}
              value={questionnaire.red_flag_threshold ?? ''}
              onChange={(e) =>
                setRedFlagThreshold(e.target.value === '' ? null : Number(e.target.value))
              }
              placeholder="e.g. 3"
              style={{ ...inputStyle, maxWidth: '160px' }}
            />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.375rem', lineHeight: 1.4 }}>
              When at least this many red-flag answers are selected, the lead goes into the
              audience below. Leave blank to disable.
            </p>
          </Field>

          <Field label="Audience">
            <select
              value={
                redFlagAudienceExists && questionnaire.red_flag_audience_id
                  ? questionnaire.red_flag_audience_id
                  : ''
              }
              onChange={(e) => setRedFlagAudience(e.target.value || null)}
              disabled={audiences.length === 0}
              style={selectStyle}
            >
              <option value="">— None —</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || '(unnamed)'}
                </option>
              ))}
            </select>
            {audiences.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.375rem' }}>
                Add an audience above first.
              </p>
            )}
          </Field>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: '2rem',
        paddingBlock: '1.5rem',
        borderTop: '1px solid var(--separator)',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '0.25rem',
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginBottom: '0.375rem',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ColorSwatch({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (color: string) => void;
}) {
  const current = value ?? AUDIENCE_PALETTE[0];
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: current,
          border: '1px solid var(--separator)',
          display: 'inline-block',
        }}
      />
      <input
        type="color"
        value={current}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Audience color"
        style={{
          position: 'absolute',
          inset: 0,
          width: 20,
          height: 20,
          padding: 0,
          border: 'none',
          background: 'transparent',
          opacity: 0,
          cursor: 'pointer',
        }}
      />
    </div>
  );
}

const inputStyle = {
  padding: '0.45rem 0.6rem',
  border: '1px solid var(--separator)',
  background: 'var(--surface)',
  borderRadius: 'var(--radius-md)',
  font: 'inherit',
  fontSize: '0.875rem',
  color: 'var(--text)',
  width: '100%',
} as const;

const selectStyle = inputStyle;
