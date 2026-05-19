'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { ProjectDomain } from '@/lib/types';
import styles from './editor.module.css';

export default function PublishPopover({
  projectId,
  domainId,
  slug,
  isPublished,
  onDomainChange,
  onSlugChange,
  onTogglePublished,
}: {
  projectId: string;
  domainId: string | null;
  slug: string;
  isPublished: boolean;
  onDomainChange: (id: string | null) => void;
  onSlugChange: (slug: string) => void;
  onTogglePublished: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [domains, setDomains] = useState<ProjectDomain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingDomains(true);
    const supabase = createClient();
    supabase
      .from('project_domains')
      .select('*')
      .eq('project_id', projectId)
      .eq('verification_status', 'verified')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setDomains((data ?? []) as ProjectDomain[]);
        setLoadingDomains(false);
      });
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const activeDomain = domains.find((d) => d.id === domainId);
  const canPublish = !!domainId && !!slug.trim();
  const publicUrl =
    activeDomain && slug ? `https://${activeDomain.domain}/${slug}` : null;

  const handleTogglePublish = () => {
    if (!isPublished && !canPublish) return;
    onTogglePublished();
  };

  return (
    <div className={styles.publishWrap} ref={ref}>
      <button
        type="button"
        className={`${styles.publishBadge} ${isPublished ? styles.publishBadgePublished : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`${styles.toggle} ${isPublished ? styles.active : ''}`}
          aria-hidden
        />
        <span>{isPublished ? 'Published' : 'Draft'}</span>
        <ChevronDown size={12} strokeWidth={2} />
      </button>

      {open && (
        <div className={styles.publishPopover}>
          <div className={styles.publishField}>
            <label className={styles.publishLabel}>Domain</label>
            {loadingDomains ? (
              <div className={styles.publishHint}>Loading…</div>
            ) : domains.length === 0 ? (
              <div className={styles.publishHint}>
                No verified domains in this project.{' '}
                <a href={`/dashboard/projects/${projectId}`} className={styles.publishLink}>
                  Add one
                </a>
                .
              </div>
            ) : (
              <select
                className={styles.publishInput}
                value={domainId ?? ''}
                onChange={(e) => onDomainChange(e.target.value || null)}
              >
                <option value="">— Select a domain —</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.domain}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className={styles.publishField}>
            <label className={styles.publishLabel}>Slug</label>
            <input
              className={styles.publishInput}
              type="text"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value.trim())}
              placeholder="quiz"
            />
          </div>

          {publicUrl && (
            <div className={styles.publishField}>
              <label className={styles.publishLabel}>Public URL</label>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.publishUrl}
              >
                {publicUrl}
                <ExternalLink size={11} strokeWidth={1.75} />
              </a>
            </div>
          )}

          <div className={styles.publishActions}>
            <button
              type="button"
              className={`btn ${isPublished ? 'btn-bordered' : 'btn-primary'} btn-sm`}
              onClick={handleTogglePublish}
              disabled={!isPublished && !canPublish}
              title={!canPublish && !isPublished ? 'Set a domain and slug first' : undefined}
            >
              {isPublished ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
