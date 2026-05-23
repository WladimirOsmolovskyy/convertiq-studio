'use client';

import { useEffect, useMemo, useState, use } from 'react';
import { useQuestionnaireStore } from '@/store/useQuestionnaireStore';
import { buildLeadPayload } from '@/lib/leadPayload';
import { Plus, Trash2, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import styles from '../editor.module.css';

interface Webhook {
  id: string;
  questionnaire_id: string;
  url: string;
  label: string | null;
  enabled: boolean;
  last_attempt_at: string | null;
  last_status: number | null;
  last_error: string | null;
  last_success_at: string | null;
  created_at: string;
}

export default function IntegrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: questionnaireId } = use(params);
  const { questionnaire, questions, scoringRules } = useQuestionnaireStore();

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSample, setShowSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/lead-webhooks?questionnaire_id=${questionnaireId}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) {
          setError(body.error ?? `Failed to load (${r.status})`);
        } else {
          setWebhooks(body.webhooks ?? []);
        }
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(String(e));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [questionnaireId]);

  const addWebhook = async () => {
    setError(null);
    const res = await fetch('/api/lead-webhooks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionnaire_id: questionnaireId, url: '', label: '', enabled: false }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? `Failed to add destination (${res.status})`);
      return;
    }
    setWebhooks((prev) => [...prev, body.webhook]);
  };

  const updateWebhook = async (id: string, patch: Partial<Pick<Webhook, 'url' | 'label' | 'enabled'>>) => {
    setError(null);
    setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    const res = await fetch(`/api/lead-webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Update failed (${res.status})`);
    }
  };

  const removeWebhook = async (id: string) => {
    setError(null);
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
    await fetch(`/api/lead-webhooks/${id}`, { method: 'DELETE' });
  };

  const samplePayload = useMemo(() => {
    if (!questionnaire) return null;
    const nowIso = new Date().toISOString();
    return buildLeadPayload({
      responseId: '00000000-0000-0000-0000-000000000000',
      sessionId: 'example-session',
      startedAt: nowIso,
      completedAt: nowIso,
      totalScore: 0,
      matchedResult: null,
      host: 'example.com',
      userAgent: 'Mozilla/5.0 (example)',
      questionnaire,
      questions,
      answers: Object.fromEntries(
        questions.map((q) => [
          q.id,
          q.options?.[0]
            ? { selected_options: [q.options[0].id] }
            : { value: 'example answer' },
        ]),
      ),
      leadFieldValues: {},
      scoringRules,
    });
  }, [questionnaire, questions, scoringRules]);

  return (
    <div className={styles.editorPanel}>
      <div style={{ maxWidth: '720px' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '-0.018em' }}>
            Integrations
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', letterSpacing: '-0.008em' }}>
            Send each completed lead to one or more webhook URLs. Every destination receives
            the same JSON, so tools like GoHighLevel only need to be mapped once.
          </p>
        </div>

        <section style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.012em' }}>
              Destinations
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={addWebhook}>
              <Plus size={13} strokeWidth={2.25} /> Add destination
            </button>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '1rem', lineHeight: 1.5 }}>
            Each enabled destination receives a POST with the payload below as soon as a lead
            completes the questionnaire. Disabled destinations are skipped.
          </p>

          {error && (
            <div
              style={{
                padding: '0.75rem 0.875rem',
                marginBottom: '0.75rem',
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
            <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading…</div>
          ) : webhooks.length === 0 ? (
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
              No destinations yet. Click <b>Add destination</b> to send leads to a webhook.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {webhooks.map((w) => (
                <WebhookRow
                  key={w.id}
                  webhook={w}
                  onChange={(patch) => updateWebhook(w.id, patch)}
                  onRemove={() => removeWebhook(w.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <button
            onClick={() => setShowSample((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--text)',
              fontSize: '1.0625rem',
              fontWeight: 600,
              letterSpacing: '-0.012em',
              marginBottom: '0.5rem',
            }}
          >
            {showSample ? <ChevronDown size={16} strokeWidth={1.75} /> : <ChevronRight size={16} strokeWidth={1.75} />}
            Sample payload
          </button>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
            Exact shape each destination will receive. Use it to set up field mapping in GoHighLevel,
            Zapier, Make, or anywhere else.
          </p>
          {showSample && samplePayload && (
            <pre
              style={{
                padding: '1rem',
                background: 'var(--fill-quaternary)',
                border: '1px solid var(--separator)',
                borderRadius: 'var(--radius-xl)',
                fontSize: '0.75rem',
                fontFamily: "ui-monospace, 'SF Mono', monospace",
                overflowX: 'auto',
                lineHeight: 1.5,
                color: 'var(--text)',
              }}
            >
              {JSON.stringify(samplePayload, null, 2)}
            </pre>
          )}
        </section>
      </div>
    </div>
  );
}

function WebhookRow({
  webhook,
  onChange,
  onRemove,
}: {
  webhook: Webhook;
  onChange: (patch: Partial<Pick<Webhook, 'url' | 'label' | 'enabled'>>) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(webhook.label ?? '');
  const [url, setUrl] = useState(webhook.url);

  const inputStyle = {
    padding: '0.4rem 0.55rem',
    border: '1px solid var(--separator)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface)',
    font: 'inherit',
    fontSize: '0.8125rem',
    color: 'var(--text)',
    width: '100%',
  } as const;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--separator)',
        borderRadius: 'var(--radius-xl)',
        padding: '0.625rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '180px 1fr auto auto',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            if (label !== (webhook.label ?? '')) onChange({ label });
          }}
          placeholder="Label (e.g. GHL · Main Funnel)"
          style={inputStyle}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => {
            if (url !== webhook.url && /^https?:\/\//.test(url)) onChange({ url });
          }}
          placeholder="https://..."
          spellCheck={false}
          style={{ ...inputStyle, fontFamily: "ui-monospace, 'SF Mono', monospace" }}
        />
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            cursor: webhook.url.trim() ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
            paddingInline: '0.5rem',
            opacity: webhook.url.trim() ? 1 : 0.5,
          }}
          title={webhook.url.trim() ? '' : 'Add a URL first'}
        >
          <input
            type="checkbox"
            checked={webhook.enabled}
            disabled={!webhook.url.trim()}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          Enabled
        </label>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onRemove}
          aria-label="Remove destination"
          style={{ padding: '0.4rem', justifyContent: 'center' }}
        >
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>

      <StatusBadge webhook={webhook} />
    </div>
  );
}

function StatusBadge({ webhook }: { webhook: Webhook }) {
  if (!webhook.last_attempt_at) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
        }}
      >
        <Circle size={11} strokeWidth={1.75} />
        Never fired
      </div>
    );
  }
  const ok = webhook.last_status !== null && webhook.last_status >= 200 && webhook.last_status < 300;
  const Icon = ok ? CheckCircle2 : AlertCircle;
  const color = ok ? 'var(--success, #34c759)' : 'var(--danger, #ff3b30)';
  const statusText = webhook.last_status ? `${webhook.last_status}` : 'network error';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        flexWrap: 'wrap',
      }}
    >
      <Icon size={12} strokeWidth={2} style={{ color }} />
      <span style={{ color: 'var(--text)' }}>{statusText}</span>
      <span>· {relativeTime(webhook.last_attempt_at)}</span>
      {!ok && webhook.last_error && (
        <span
          style={{
            fontFamily: "ui-monospace, 'SF Mono', monospace",
            color: 'var(--text-secondary)',
            paddingLeft: '0.25rem',
          }}
          title={webhook.last_error}
        >
          · {webhook.last_error.length > 80 ? webhook.last_error.slice(0, 80) + '…' : webhook.last_error}
        </span>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}
