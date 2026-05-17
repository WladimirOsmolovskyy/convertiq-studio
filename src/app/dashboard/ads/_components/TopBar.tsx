'use client';

import { useEffect } from 'react';
import { ArrowLeft, Undo2, Redo2, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type Konva from 'konva';
import { useEditorStore } from '../_store/editor';
import { STANDARD_SIZES } from '../_model/nodes';
import { TEMPLATES, getTemplate } from '../_templates/registry';
import { exportStageToPng, downloadDataUrl } from '../_export/png';
import styles from '../ads.module.css';

interface Props {
  stageRef: React.RefObject<Konva.Stage | null>;
}

export default function TopBar({ stageRef }: Props) {
  const router = useRouter();
  const doc = useEditorStore((s) => s.doc);
  const edit = useEditorStore((s) => s.edit);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const currentSizeKey = `${doc.size.width}x${doc.size.height}`;

  const handleSizeChange = (key: string) => {
    const [w, h] = key.split('x').map(Number);
    edit((draft) => {
      draft.size = { width: w, height: h };
      draft.root.transform.width = w;
      draft.root.transform.height = h;
    });
  };

  const handleTemplate = (id: string) => {
    if (!confirm('Load template? Unsaved changes will be lost.')) return;
    loadDocument(getTemplate(id));
  };

  const handleExport = async () => {
    if (!stageRef.current) return;
    try {
      const dataUrl = await exportStageToPng(stageRef.current, doc, 2);
      const safe = doc.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      downloadDataUrl(dataUrl, `${safe}-${doc.size.width}x${doc.size.height}.png`);
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed. See console.');
    }
  };

  return (
    <div className={styles.topBar}>
      <button
        className={styles.topBarBack}
        onClick={() => router.push('/dashboard')}
        aria-label="Back"
      >
        <ArrowLeft size={17} strokeWidth={1.75} />
      </button>
      <div className={styles.topBarTitle}>{doc.name}</div>

      <div className={styles.topBarGroup}>
        <select
          className={styles.topBarSelect}
          value="default"
          onChange={(e) => handleTemplate(e.target.value)}
        >
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          className={styles.topBarSelect}
          value={currentSizeKey}
          onChange={(e) => handleSizeChange(e.target.value)}
        >
          {STANDARD_SIZES.map((s) => (
            <option key={`${s.width}x${s.height}`} value={`${s.width}x${s.height}`}>
              {s.name} · {s.width}×{s.height}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.topBarSpacer} />

      <div className={styles.topBarGroup}>
        <button
          className={styles.topBarIconBtn}
          onClick={undo}
          disabled={past.length === 0}
          aria-label="Undo"
          title="Undo (⌘Z)"
        >
          <Undo2 size={15} strokeWidth={1.75} />
        </button>
        <button
          className={styles.topBarIconBtn}
          onClick={redo}
          disabled={future.length === 0}
          aria-label="Redo"
          title="Redo (⌘⇧Z)"
        >
          <Redo2 size={15} strokeWidth={1.75} />
        </button>
      </div>
      <button className="btn btn-primary btn-sm" onClick={handleExport}>
        <Download size={13} strokeWidth={2} /> Export PNG
      </button>
    </div>
  );
}
