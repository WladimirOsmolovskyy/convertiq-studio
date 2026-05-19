'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronsUpDown, Check, FolderKanban } from 'lucide-react';
import type { Project } from '@/lib/types';
import styles from '../dashboard.module.css';

export default function ProjectSwitcher({
  projects,
  activeProjectId,
}: {
  projects: Project[];
  activeProjectId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleSwitch = async (id: string) => {
    if (id === activeProjectId) {
      setOpen(false);
      return;
    }
    await fetch('/api/projects/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: id }),
    });
    setOpen(false);
    router.refresh();
  };

  return (
    <div className={styles.projectSwitcher} ref={ref}>
      <button
        type="button"
        className={styles.projectSwitcherTrigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.projectName}>{active?.name ?? 'Select project'}</span>
        <ChevronsUpDown size={13} strokeWidth={1.75} />
      </button>
      {open && (
        <div className={styles.projectSwitcherMenu} role="listbox">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === activeProjectId}
              className={styles.projectSwitcherItem}
              onClick={() => handleSwitch(p.id)}
            >
              <span className={styles.projectItemCheck}>
                {p.id === activeProjectId ? <Check size={13} strokeWidth={2.25} /> : null}
              </span>
              <span className={styles.projectItemLabel}>{p.name}</span>
            </button>
          ))}
          <div className={styles.projectSwitcherDivider} />
          <Link
            href="/dashboard/projects"
            className={styles.projectSwitcherItem}
            onClick={() => setOpen(false)}
          >
            <span className={styles.projectItemCheck}>
              <FolderKanban size={13} strokeWidth={1.75} />
            </span>
            <span className={styles.projectItemLabel}>Manage projects</span>
          </Link>
        </div>
      )}
    </div>
  );
}
