'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Globe,
  RefreshCw,
  Trash2,
  ChevronLeft,
  Check,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type {
  Project,
  ProjectDomain,
  DomainVerificationStatus,
  VercelVerificationRecord,
} from '@/lib/types';
import dashStyles from '../../dashboard.module.css';
import styles from './detail.module.css';
import LeadFieldsManager from './_LeadFieldsManager';

const STATUS_LABEL: Record<DomainVerificationStatus, string> = {
  pending: 'Pending DNS',
  verifying: 'Verifying',
  verified: 'Verified',
  error: 'Misconfigured',
};

function StatusBadge({ status }: { status: DomainVerificationStatus }) {
  const icon =
    status === 'verified' ? (
      <Check size={11} strokeWidth={2.5} />
    ) : status === 'error' ? (
      <AlertCircle size={11} strokeWidth={2.25} />
    ) : (
      <Clock size={11} strokeWidth={2.25} />
    );
  return (
    <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
      {icon}
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function DomainsManager({
  project,
  initialDomains,
  questionnaireCounts,
}: {
  project: Project;
  initialDomains: ProjectDomain[];
  questionnaireCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [domains, setDomains] = useState<ProjectDomain[]>(initialDomains);
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // domain id or 'create'
  const [error, setError] = useState<string | null>(null);

  const refresh = () => router.refresh();

  const addDomain = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;
    setBusy('create');
    setError(null);
    const res = await fetch(`/api/projects/${project.id}/domains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to add domain');
      return;
    }
    const { domain: created } = await res.json();
    setDomains((prev) => [...prev, created]);
    setNewDomain('');
    setAdding(false);
    refresh();
  };

  const refreshStatus = async (d: ProjectDomain) => {
    setBusy(d.id);
    setError(null);
    const res = await fetch(`/api/projects/${project.id}/domains/${d.id}`, { method: 'POST' });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Refresh failed');
      return;
    }
    const { domain: updated } = await res.json();
    setDomains((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  };

  const removeDomain = async (d: ProjectDomain) => {
    const count = questionnaireCounts[d.id] ?? 0;
    if (count > 0) {
      setError(`This domain has ${count} questionnaire(s) attached. Unpublish them first.`);
      return;
    }
    if (!confirm(`Remove ${d.domain}? This also detaches it from Vercel.`)) return;
    setBusy(d.id);
    setError(null);
    const res = await fetch(`/api/projects/${project.id}/domains/${d.id}`, { method: 'DELETE' });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Remove failed');
      return;
    }
    setDomains((prev) => prev.filter((x) => x.id !== d.id));
    refresh();
  };

  return (
    <div className={dashStyles.contentBody}>
      <Link href="/dashboard/projects" className={styles.backLink}>
        <ChevronLeft size={14} strokeWidth={2} /> Projects
      </Link>

      <div className={dashStyles.largeTitleBlock}>
        <h1 className={dashStyles.largeTitle}>{project.name}</h1>
        {!adding && (
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={14} strokeWidth={2.5} /> Add domain
          </button>
        )}
      </div>

      <h2 className={styles.sectionTitle}>Domains</h2>
      <p className={styles.sectionDesc}>
        Custom domains where this project&apos;s questionnaires get published. After adding a
        domain, set the displayed DNS record at your registrar, then click Refresh to verify.
      </p>

      {adding && (
        <div className={styles.addRow}>
          <input
            autoFocus
            className={styles.input}
            placeholder="quiz.yourdomain.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addDomain();
              if (e.key === 'Escape') {
                setAdding(false);
                setNewDomain('');
                setError(null);
              }
            }}
            disabled={busy === 'create'}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={addDomain}
            disabled={busy === 'create' || !newDomain.trim()}
          >
            {busy === 'create' ? 'Adding…' : 'Add'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setAdding(false);
              setNewDomain('');
              setError(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {error && <div className={styles.errorBox}>{error}</div>}

      {domains.length === 0 && !adding ? (
        <div className={styles.empty}>
          <Globe size={28} strokeWidth={1.5} />
          <p>No domains yet. Add one to start publishing questionnaires.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {domains.map((d) => {
            const records = d.vercel_data?.verification ?? [];
            const showInstructions =
              d.verification_status === 'pending' ||
              d.verification_status === 'verifying' ||
              d.verification_status === 'error';
            const count = questionnaireCounts[d.id] ?? 0;
            return (
              <div key={d.id} className={styles.row}>
                <div className={styles.rowHeader}>
                  <div className={styles.rowMain}>
                    <div className={styles.domainName}>
                      <Globe size={15} strokeWidth={1.75} />
                      <span>{d.domain}</span>
                      <StatusBadge status={d.verification_status} />
                    </div>
                    <div className={styles.domainMeta}>
                      {count} {count === 1 ? 'questionnaire' : 'questionnaires'}
                      {d.verification_status === 'verified' && (
                        <>
                          {' · '}
                          <a
                            href={`https://${d.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.openLink}
                          >
                            Open <ExternalLink size={11} strokeWidth={1.75} />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => refreshStatus(d)}
                      disabled={busy === d.id}
                      title="Refresh status"
                    >
                      <RefreshCw
                        size={13}
                        strokeWidth={1.75}
                        className={busy === d.id ? styles.spin : undefined}
                      />
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => removeDomain(d)}
                      disabled={busy === d.id}
                      title="Remove"
                    >
                      <Trash2 size={13} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
                {showInstructions && (
                  <DnsInstructions domain={d.domain} ownershipRecords={records} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <LeadFieldsManager projectId={project.id} initial={project.lead_fields ?? []} />
    </div>
  );
}

function DnsInstructions({
  domain,
  ownershipRecords,
}: {
  domain: string;
  ownershipRecords: VercelVerificationRecord[];
}) {
  // For apex domains (e.g. example.com) Vercel needs A records, not CNAME.
  // Heuristic: a domain with exactly two dotless segments is the apex.
  const isApex = domain.split('.').length === 2;
  const subdomain = isApex ? '@' : domain.split('.').slice(0, -2).join('.');

  return (
    <div className={styles.dns}>
      <div className={styles.dnsHeader}>Add this DNS record at your registrar:</div>
      <table className={styles.dnsTable}>
        <thead>
          <tr>
            <th>Type</th>
            <th>Name</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {isApex ? (
            <tr>
              <td>A</td>
              <td><code>@</code></td>
              <td><code>76.76.21.21</code></td>
            </tr>
          ) : (
            <tr>
              <td>CNAME</td>
              <td><code>{subdomain}</code></td>
              <td><code>cname.vercel-dns.com</code></td>
            </tr>
          )}
          {ownershipRecords.map((r, i) => (
            <tr key={i}>
              <td>{r.type}</td>
              <td><code>{r.domain}</code></td>
              <td><code>{r.value}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.dnsHint}>
        After saving the record, click Refresh. DNS propagation usually takes 1–10 minutes.
      </div>
    </div>
  );
}
