'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ChevronRight, Globe, Zap } from 'lucide-react';
import styles from '../editor.module.css';

interface ProviderStatus {
  ghlConnected: boolean;
  ghlEnabled: boolean;
  webhookCount: number;
  webhookEnabledCount: number;
}

export default function IntegrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: questionnaireId } = use(params);
  const [status, setStatus] = useState<ProviderStatus>({
    ghlConnected: false,
    ghlEnabled: false,
    webhookCount: 0,
    webhookEnabledCount: 0,
  });

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch('/api/integrations/ghl/status').then((r) => r.json()).catch(() => ({})),
      fetch(`/api/integrations/ghl/config?questionnaire_id=${questionnaireId}`)
        .then((r) => r.json())
        .catch(() => ({})),
      fetch(`/api/lead-webhooks?questionnaire_id=${questionnaireId}`)
        .then((r) => r.json())
        .catch(() => ({ webhooks: [] })),
    ]).then(([ghlStatus, ghlConfig, hooks]) => {
      if (!alive) return;
      const webhooks = hooks.webhooks ?? [];
      setStatus({
        ghlConnected: !!ghlStatus.connected,
        ghlEnabled: !!ghlConfig.integration?.enabled,
        webhookCount: webhooks.length,
        webhookEnabledCount: webhooks.filter((w: { enabled: boolean }) => w.enabled).length,
      });
    });
    return () => {
      alive = false;
    };
  }, [questionnaireId]);

  return (
    <div className={styles.editorPanel}>
      <div style={{ maxWidth: '720px' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '-0.018em' }}>
            Integrations
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', letterSpacing: '-0.008em' }}>
            Send leads from this questionnaire to other tools. Each provider has its own setup.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <ProviderRow
            href={`/dashboard/questionnaire/${questionnaireId}/integrations/gohighlevel`}
            icon={<Zap size={18} strokeWidth={1.75} />}
            title="GoHighLevel"
            description="Upsert a contact in your GHL sub-account on each lead, with tag + field mapping."
            statusLabel={
              status.ghlConnected
                ? status.ghlEnabled
                  ? 'Connected · enabled for this questionnaire'
                  : 'Connected · not enabled for this questionnaire'
                : 'Not connected'
            }
            statusTone={status.ghlConnected && status.ghlEnabled ? 'success' : status.ghlConnected ? 'muted' : 'muted'}
          />
          <ProviderRow
            href={`/dashboard/questionnaire/${questionnaireId}/integrations/webhooks`}
            icon={<Globe size={18} strokeWidth={1.75} />}
            title="Custom webhooks"
            description="POST the lead payload to any URL. For Zapier, Make, or custom endpoints."
            statusLabel={
              status.webhookCount === 0
                ? 'No destinations'
                : `${status.webhookEnabledCount} active · ${status.webhookCount} total`
            }
            statusTone={status.webhookEnabledCount > 0 ? 'success' : 'muted'}
          />
        </div>
      </div>
    </div>
  );
}

function ProviderRow({
  href,
  icon,
  title,
  description,
  statusLabel,
  statusTone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  statusLabel: string;
  statusTone: 'success' | 'muted';
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: '0.875rem',
        alignItems: 'center',
        padding: '0.875rem 1rem',
        background: 'var(--surface)',
        border: '1px solid var(--separator)',
        borderRadius: 'var(--radius-xl)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-md)',
          background: 'var(--fill-quaternary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.008em', marginBottom: '0.125rem' }}>
          {title}
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '0.25rem' }}>
          {description}
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: statusTone === 'success' ? 'var(--success, #34c759)' : 'var(--text-secondary)',
          }}
        >
          {statusLabel}
        </div>
      </div>
      <ChevronRight size={16} strokeWidth={1.75} style={{ color: 'var(--text-secondary)' }} />
    </Link>
  );
}
