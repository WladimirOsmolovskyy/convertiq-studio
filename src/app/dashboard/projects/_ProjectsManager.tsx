'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Check, Pencil, Trash2, X, FolderKanban, ArrowRight } from 'lucide-react';
import type { Project } from '@/lib/types';
import dashStyles from '../dashboard.module.css';
import styles from './projects.module.css';

type DeleteState =
  | { open: false }
  | { open: true; project: Project; count: number; moveTo: string };

export default function ProjectsManager({
  initialProjects,
  activeProjectId,
  initialCounts,
}: {
  initialProjects: Project[];
  activeProjectId: string;
  initialCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [counts] = useState<Record<string, number>>(initialCounts);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<DeleteState>({ open: false });

  const refresh = () => router.refresh();

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      const { project } = await res.json();
      setProjects((prev) => [...prev, project]);
      setNewName('');
      setCreating(false);
    }
  };

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      const { project } = await res.json();
      setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)));
      setEditingId(null);
      refresh();
    }
  };

  const openDelete = (p: Project) => {
    const count = counts[p.id] ?? 0;
    const firstOther = projects.find((x) => x.id !== p.id);
    setDel({
      open: true,
      project: p,
      count,
      moveTo: firstOther?.id ?? '',
    });
  };

  const confirmDelete = async () => {
    if (!del.open) return;
    setBusy(true);
    const url =
      del.count > 0
        ? `/api/projects/${del.project.id}?moveTo=${del.moveTo}`
        : `/api/projects/${del.project.id}`;
    const res = await fetch(url, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== del.project.id));
      setDel({ open: false });
      refresh();
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Delete failed' }));
      alert(error);
    }
  };

  const isOnlyProject = projects.length <= 1;

  return (
    <div className={dashStyles.contentBody}>
      <div className={dashStyles.largeTitleBlock}>
        <h1 className={dashStyles.largeTitle}>Projects</h1>
        {!creating && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={14} strokeWidth={2.5} /> New
          </button>
        )}
      </div>

      {creating && (
        <div className={styles.createRow}>
          <input
            autoFocus
            className={styles.input}
            placeholder="Project name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create();
              if (e.key === 'Escape') {
                setCreating(false);
                setNewName('');
              }
            }}
          />
          <button className="btn btn-primary btn-sm" onClick={create} disabled={busy}>
            Create
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setCreating(false);
              setNewName('');
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <div className={styles.list}>
        {projects.map((p) => {
          const count = counts[p.id] ?? 0;
          const isActive = p.id === activeProjectId;
          const isEditing = editingId === p.id;
          return (
            <div key={p.id} className={styles.row}>
              <div className={styles.icon}>
                <FolderKanban size={18} strokeWidth={1.75} />
              </div>
              <div className={styles.rowMain}>
                {isEditing ? (
                  <input
                    autoFocus
                    className={styles.input}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <div className={styles.rowName}>
                    {p.name}
                    {isActive && <span className={styles.activeBadge}>Active</span>}
                  </div>
                )}
                <div className={styles.rowMeta}>
                  {count} {count === 1 ? 'questionnaire' : 'questionnaires'}
                </div>
              </div>
              <div className={styles.rowActions}>
                {isEditing ? (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={saveEdit}
                      disabled={busy}
                    >
                      <Check size={14} strokeWidth={2.25} />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditingId(null)}
                    >
                      <X size={14} strokeWidth={2.25} />
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/dashboard/projects/${p.id}`}
                      className="btn btn-ghost btn-sm"
                      title="Open project"
                    >
                      <ArrowRight size={14} strokeWidth={1.75} />
                    </Link>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(p)}
                      title="Rename"
                    >
                      <Pencil size={14} strokeWidth={1.75} />
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => openDelete(p)}
                      disabled={isOnlyProject}
                      title={
                        isOnlyProject
                          ? 'You must have at least one project'
                          : 'Delete'
                      }
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {del.open && (
        <div className={styles.modalBackdrop} onClick={() => setDel({ open: false })}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Delete &quot;{del.project.name}&quot;?</h2>
            {del.count === 0 ? (
              <p className={styles.modalDesc}>This project is empty. It will be deleted permanently.</p>
            ) : (
              <>
                <p className={styles.modalDesc}>
                  This project has {del.count} {del.count === 1 ? 'questionnaire' : 'questionnaires'}.
                  Move them to another project before deleting.
                </p>
                <label className={styles.modalLabel}>
                  Move to
                  <select
                    className={styles.input}
                    value={del.moveTo}
                    onChange={(e) =>
                      setDel((s) => (s.open ? { ...s, moveTo: e.target.value } : s))
                    }
                  >
                    {projects
                      .filter((p) => p.id !== del.project.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
            <div className={styles.modalActions}>
              <button className="btn btn-ghost" onClick={() => setDel({ open: false })}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={busy || (del.count > 0 && !del.moveTo)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
