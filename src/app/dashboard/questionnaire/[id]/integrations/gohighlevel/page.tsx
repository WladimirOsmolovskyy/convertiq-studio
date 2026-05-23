'use client';

import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { resolveLeadFields } from '@/lib/leadFields';
import type { LeadField, LeadFieldTemplate } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { ChevronLeft, Plus, Trash2, RefreshCw, LogOut, Check } from 'lucide-react';
import AudienceFilter from '@/components/AudienceFilter';
import styles from '../../editor.module.css';

interface ConnectionStatus {
  connected: boolean;
  location_id: string | null;
  updated_at: string | null;
}

interface GhlTag {
  id: string;
  name: string;
}

interface GhlCustomField {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string;
}

interface FieldMapEntry {
  source: string; // 'lead_field:<id>' | 'system:host' | 'system:user_agent'
  target: string; // 'email' | 'firstName' | ... | 'custom:<id>'
}

interface IntegrationConfig {
  enabled: boolean;
  /** Tag name (not id) — GHL's contact upsert takes names. */
  finished_tag?: string | null;
  field_map?: FieldMapEntry[];
  /** Allow-list. `undefined` = no filter. `[]` = deliver none.
   *  Populated = deliver only matching audiences. */
  audience_ids?: string[];
}

// GHL standard contact fields available for mapping. Extend here.
const GHL_STANDARD_FIELDS: { value: string; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'name', label: 'Full Name' },
  { value: 'companyName', label: 'Company' },
  { value: 'address1', label: 'Address' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'postalCode', label: 'Postal Code' },
  { value: 'country', label: 'Country' },
  { value: 'website', label: 'Website' },
];

export default function GoHighLevelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: questionnaireId } = use(params);
  const { questionnaire, audiences } = useQuestionnaireStore();

  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    location_id: null,
    updated_at: null,
  });
  const [tags, setTags] = useState<GhlTag[]>([]);
  const [customFields, setCustomFields] = useState<GhlCustomField[]>([]);
  const [templateFields, setTemplateFields] = useState<LeadField[]>([]);
  const [config, setConfig] = useState<IntegrationConfig>({ enabled: false, finished_tag: null, field_map: [], audience_ids: undefined });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const banner = useBannerFromQuery();

  const loadTags = async () => {
    const r = await fetch('/api/integrations/ghl/tags');
    if (!r.ok) return;
    const body = await r.json();
    setTags(body.tags ?? []);
  };
  const loadCustomFields = async () => {
    const r = await fetch('/api/integrations/ghl/custom-fields');
    if (!r.ok) return;
    const body = await r.json();
    setCustomFields(body.customFields ?? []);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const [statusRes, configRes] = await Promise.all([
        fetch('/api/integrations/ghl/status').then((r) => r.json()).catch(() => ({})),
        fetch(`/api/integrations/ghl/config?questionnaire_id=${questionnaireId}`)
          .then((r) => r.json())
          .catch(() => ({})),
      ]);
      if (!alive) return;
      setStatus({
        connected: !!statusRes.connected,
        location_id: statusRes.location_id ?? null,
        updated_at: statusRes.updated_at ?? null,
      });
      if (configRes.integration) {
        setConfig({
          enabled: configRes.integration.enabled,
          finished_tag: configRes.integration.config?.finished_tag ?? null,
          field_map: configRes.integration.config?.field_map ?? [],
          audience_ids: Array.isArray(configRes.integration.config?.audience_ids)
            ? configRes.integration.config.audience_ids
            : undefined,
        });
      }
      if (questionnaire?.lead_field_template_id) {
        const supabase = createClient();
        const { data } = await supabase
          .from('lead_field_templates')
          .select('*')
          .eq('id', questionnaire.lead_field_template_id)
          .maybeSingle();
        if (alive) setTemplateFields((data as LeadFieldTemplate | null)?.fields ?? []);
      }
      if (statusRes.connected) {
        await Promise.all([loadTags(), loadCustomFields()]);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [questionnaireId, questionnaire?.lead_field_template_id]);

  const refresh = async () => {
    await Promise.all([loadTags(), loadCustomFields()]);
  };

  const disconnect = async () => {
    if (!confirm('Disconnect GoHighLevel? Lead delivery will stop for every questionnaire in this project.')) return;
    const r = await fetch('/api/integrations/ghl/status', { method: 'DELETE' });
    if (r.ok) {
      setStatus({ connected: false, location_id: null, updated_at: null });
      setTags([]);
      setCustomFields([]);
    }
  };

  const connectHref = `/api/integrations/ghl/connect?return_to=${encodeURIComponent(
    `/dashboard/questionnaire/${questionnaireId}/integrations/gohighlevel`,
  )}`;

  const effectiveLeadFields = useMemo(
    () => resolveLeadFields(templateFields, questionnaire?.lead_fields ?? []),
    [templateFields, questionnaire?.lead_fields],
  );

  const sourceOptions = useMemo(() => {
    const options: { value: string; label: string }[] = effectiveLeadFields.map((f) => ({
      value: `lead_field:${f.id}`,
      label: f.label || '(unlabeled)',
    }));
    options.push({ value: 'system:host', label: 'System · Host' });
    options.push({ value: 'system:user_agent', label: 'System · User Agent' });
    return options;
  }, [effectiveLeadFields]);

  const targetOptions = useMemo(() => {
    const opts = [...GHL_STANDARD_FIELDS];
    for (const cf of customFields) {
      opts.push({ value: `custom:${cf.id}`, label: `Custom · ${cf.name}` });
    }
    return opts;
  }, [customFields]);

  const addRow = () => {
    setConfig((c) => ({
      ...c,
      field_map: [...(c.field_map ?? []), { source: '', target: '' }],
    }));
  };
  const updateRow = (i: number, patch: Partial<FieldMapEntry>) => {
    setConfig((c) => {
      const next = [...(c.field_map ?? [])];
      next[i] = { ...next[i], ...patch };
      return { ...c, field_map: next };
    });
  };
  const removeRow = (i: number) => {
    setConfig((c) => ({
      ...c,
      field_map: (c.field_map ?? []).filter((_, idx) => idx !== i),
    }));
  };

  const save = async () => {
    setError(null);
    setSaving(true);
    const r = await fetch('/api/integrations/ghl/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionnaire_id: questionnaireId,
        enabled: config.enabled,
        config: {
          finished_tag: config.finished_tag ?? null,
          field_map: (config.field_map ?? []).filter((r) => r.source && r.target),
          ...(Array.isArray(config.audience_ids) ? { audience_ids: config.audience_ids } : {}),
        },
      }),
    });
    setSaving(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.error ?? `Save failed (${r.status})`);
    } else {
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
    }
  };

  return (
    <div className={styles.editorPanel}>
      <div style={{ maxWidth: '760px' }}>
        <Link
          href={`/dashboard/questionnaire/${questionnaireId}/integrations`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            marginBottom: '1rem',
          }}
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
          Integrations
        </Link>

        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>
          GoHighLevel
        </h2>

        {banner && (
          <div
            style={{
              padding: '0.75rem 0.875rem',
              marginBottom: '1.25rem',
              background: banner.tone === 'success' ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.08)',
              border: `1px solid ${banner.tone === 'success' ? 'rgba(52, 199, 89, 0.3)' : 'rgba(255, 59, 48, 0.3)'}`,
              borderRadius: 'var(--radius-md)',
              color: banner.tone === 'success' ? 'var(--success, #34c759)' : 'var(--danger, #ff3b30)',
              fontSize: '0.8125rem',
              lineHeight: 1.45,
            }}
          >
            {banner.message}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '0.75rem 0.875rem',
              marginBottom: '1.25rem',
              background: 'rgba(255, 59, 48, 0.08)',
              border: '1px solid rgba(255, 59, 48, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger, #ff3b30)',
              fontSize: '0.8125rem',
              lineHeight: 1.45,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading…</div>
        ) : (
          <>
            <Section title="Connection" subtitle="Authenticate with your GoHighLevel sub-account.">
              {status.connected ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.875rem 1rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--separator)',
                    borderRadius: 'var(--radius-xl)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Check size={16} strokeWidth={2.5} style={{ color: 'var(--success, #34c759)' }} />
                    <span style={{ color: 'var(--success, #34c759)', fontWeight: 600, fontSize: '0.875rem' }}>
                      Connected
                    </span>
                    {status.location_id && (
                      <span
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.75rem',
                          fontFamily: "ui-monospace, 'SF Mono', monospace",
                          paddingLeft: '0.5rem',
                        }}
                      >
                        · {status.location_id}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={refresh}
                      title="Refresh tags + custom fields"
                      style={{ padding: '0.4rem' }}
                    >
                      <RefreshCw size={14} strokeWidth={1.75} />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={disconnect}
                      title="Disconnect"
                      style={{ padding: '0.4rem' }}
                    >
                      <LogOut size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ) : (
                <a
                  href={connectHref}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', textDecoration: 'none' }}
                >
                  Connect GoHighLevel
                </a>
              )}
            </Section>

            <Section title="Settings" subtitle="Customise how leads are forwarded.">
              <Field label="Finished tag">
                <select
                  value={config.finished_tag ?? ''}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, finished_tag: e.target.value || null }))
                  }
                  disabled={!status.connected || tags.length === 0}
                  style={selectStyle}
                >
                  <option value="">— None —</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.375rem', lineHeight: 1.4 }}>
                  Applied to the contact when the lead completes this questionnaire.
                </p>
              </Field>

              <Field label="Send leads to GHL">
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    disabled={!status.connected}
                    onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))}
                  />
                  Enabled for this questionnaire
                </label>
              </Field>

              <Field label="Audiences">
                <AudienceFilter
                  audiences={audiences}
                  value={Array.isArray(config.audience_ids) ? config.audience_ids : null}
                  onChange={(next) =>
                    setConfig((c) => ({
                      ...c,
                      audience_ids: next === null ? undefined : next,
                    }))
                  }
                />
              </Field>
            </Section>

            <Section
              title="Map lead form fields"
              subtitle="Match what you collect to fields in GoHighLevel. Unmapped fields are not sent."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(config.field_map ?? []).map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr auto',
                      gap: '0.5rem',
                      alignItems: 'center',
                      padding: '0.625rem',
                      background: 'var(--surface)',
                      border: '1px solid var(--separator)',
                      borderRadius: 'var(--radius-xl)',
                    }}
                  >
                    <select
                      value={row.source}
                      onChange={(e) => updateRow(i, { source: e.target.value })}
                      style={selectStyle}
                    >
                      <option value="">Pick a source…</option>
                      {sourceOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.target}
                      onChange={(e) => updateRow(i, { target: e.target.value })}
                      disabled={!status.connected}
                      style={selectStyle}
                    >
                      <option value="">Pick a GHL field…</option>
                      {targetOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeRow(i)}
                      aria-label="Remove mapping"
                      style={{ padding: '0.4rem', justifyContent: 'center' }}
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={addRow}
                style={{ marginTop: '0.625rem' }}
              >
                <Plus size={13} strokeWidth={2.25} /> Add mapping
              </button>
            </Section>

            <div
              style={{
                position: 'sticky',
                bottom: 0,
                background: 'var(--bg)',
                paddingTop: '1rem',
                borderTop: '1px solid var(--separator)',
                marginTop: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              {showSaved && (
                <span style={{ color: 'var(--success, #34c759)', fontSize: '0.8125rem' }}>
                  Saved
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
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
        <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
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
      <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const selectStyle = {
  padding: '0.45rem 0.6rem',
  border: '1px solid var(--separator)',
  background: 'var(--surface)',
  borderRadius: 'var(--radius-md)',
  font: 'inherit',
  fontSize: '0.875rem',
  color: 'var(--text)',
  width: '100%',
} as const;

function useBannerFromQuery(): { tone: 'success' | 'error'; message: string } | null {
  // Derive initial state synchronously from the URL — we're a
  // client component, so window is available during init. The
  // effect below only does the side-effect (URL cleanup), no
  // setState during render.
  const [banner] = useState<{ tone: 'success' | 'error'; message: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'ghl') {
      return { tone: 'success', message: 'GoHighLevel connected.' };
    }
    if (params.get('error')) {
      return { tone: 'error', message: `OAuth error: ${params.get('error')}` };
    }
    return null;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('connected') || params.has('error')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  return banner;
}
