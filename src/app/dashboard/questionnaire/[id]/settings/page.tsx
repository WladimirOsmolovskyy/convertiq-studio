'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { createClient } from '@/lib/supabase/client';
import { resolveLeadFields } from '@/lib/leadFields';
import type { LeadFieldTemplate } from '@/lib/types';
import { Plus, Trash2, Link2, ExternalLink } from 'lucide-react';
import styles from '../editor.module.css';

export default function SettingsPage() {
  const {
    questionnaire,
    questions,
    addLeadField,
    updateLeadField,
    removeLeadField,
    setLeadFieldTemplate,
  } = useQuestionnaireStore();
  const fields = questionnaire?.lead_fields ?? [];
  const templateId = questionnaire?.lead_field_template_id ?? null;

  const [templates, setTemplates] = useState<LeadFieldTemplate[]>([]);
  useEffect(() => {
    const supabase = createClient();
    // RLS filters to the current user's templates — they're global per user.
    supabase
      .from('lead_field_templates')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setTemplates((data as LeadFieldTemplate[] | null) ?? []);
      });
  }, []);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const templateFields = selectedTemplate?.fields ?? [];

  // Effective set drives the example URL — only URL fields contribute query params.
  const effective = resolveLeadFields(templateFields, fields);
  const exampleParams = effective
    .filter((f) => (f.kind ?? 'url') === 'url' && (f.urlParam ?? '').trim().length > 0)
    .map((f) => `${encodeURIComponent(f.urlParam!)}=value`)
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

        {questionnaire?.project_id && (
          <section style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.012em' }}>
                Lead field template
              </h3>
              <Link
                href="/dashboard/lead-templates"
                style={{ fontSize: '0.8125rem', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
              >
                Manage templates <ExternalLink size={12} strokeWidth={1.75} />
              </Link>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              Reusable bundle of URL-tracked fields. Changes to the template propagate to
              every questionnaire that uses it.
            </p>
            <select
              value={templateId ?? ''}
              onChange={(e) => setLeadFieldTemplate(e.target.value || null)}
              style={{
                width: '100%',
                padding: '0.45rem 0.6rem',
                border: '1px solid var(--separator)',
                background: 'var(--surface)',
                borderRadius: 'var(--radius-md)',
                font: 'inherit',
                fontSize: '0.875rem',
                color: 'var(--text)',
              }}
            >
              <option value="">No template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.fields?.length ?? 0} fields
                </option>
              ))}
            </select>

            {selectedTemplate && templateFields.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.75rem' }}>
                {templateFields.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.5rem',
                      alignItems: 'center',
                      background: 'var(--fill-quaternary)',
                      border: '1px solid var(--separator)',
                      borderRadius: 'var(--radius-xl)',
                      padding: '0.5rem 0.875rem',
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{f.label || '—'}</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontFamily: "ui-monospace, 'SF Mono', monospace" }}>
                      {f.urlParam || '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.012em' }}>
              Questionnaire fields
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={addLeadField}>
              <Plus size={13} strokeWidth={2.25} /> Add field
            </button>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '1rem', lineHeight: 1.5 }}>
            Each field has a source — either a URL query parameter (captured silently on
            page load, useful for tracking tags) or a question in this questionnaire
            (captured from the visitor&apos;s answer). Both end up on the lead.
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
              No custom fields yet. Click <b>Add field</b> to capture data as part of each lead.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {fields.map((field) => {
                const kind = field.kind ?? 'url';
                return (
                  <div
                    key={field.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 1fr 1.4fr 36px',
                      gap: '0.5rem',
                      alignItems: 'center',
                      background: 'var(--surface)',
                      border: '1px solid var(--separator)',
                      borderRadius: 'var(--radius-xl)',
                      padding: '0.625rem',
                    }}
                  >
                    <select
                      value={kind}
                      onChange={(e) => {
                        const next = e.target.value as 'url' | 'question';
                        if (next === 'url') {
                          updateLeadField(field.id, { kind: 'url', questionId: undefined });
                        } else {
                          updateLeadField(field.id, { kind: 'question', urlParam: undefined });
                        }
                      }}
                      style={{
                        padding: '0.4rem 0.55rem',
                        border: '1px solid var(--separator)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface)',
                        font: 'inherit',
                        fontSize: '0.8125rem',
                        color: 'var(--text)',
                      }}
                    >
                      <option value="url">URL param</option>
                      <option value="question">Question</option>
                    </select>
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
                    {kind === 'url' ? (
                      <input
                        value={field.urlParam ?? ''}
                        onChange={(e) =>
                          updateLeadField(field.id, { urlParam: e.target.value.trim() })
                        }
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
                    ) : (
                      <select
                        value={field.questionId ?? ''}
                        onChange={(e) =>
                          updateLeadField(field.id, { questionId: e.target.value || undefined })
                        }
                        style={{
                          padding: '0.4rem 0.55rem',
                          border: '1px solid var(--separator)',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--surface)',
                          font: 'inherit',
                          fontSize: '0.8125rem',
                          color: 'var(--text)',
                        }}
                      >
                        <option value="">Pick a question…</option>
                        {questions.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.title || `Untitled (${q.type})`}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeLeadField(field.id)}
                      aria-label="Remove field"
                      style={{ padding: '0.4rem', justifyContent: 'center' }}
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                );
              })}
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
