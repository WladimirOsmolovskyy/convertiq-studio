'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Undo2, Redo2, Save, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type Konva from 'konva';
import { createClient } from '@/lib/supabase/client';
import { useEditorStore } from '../_store/editor';
import { STANDARD_SIZES } from '../_model/nodes';
import styles from '../ads.module.css';

interface Props {
  stageRef: React.RefObject<Konva.Stage | null>;
}

export default function TopBar({ stageRef: _stageRef }: Props) {
  void _stageRef;
  const router = useRouter();
  const templateId = useEditorStore((s) => s.templateId);
  const templateTitle = useEditorStore((s) => s.templateTitle);
  const setTemplateTitle = useEditorStore((s) => s.setTemplateTitle);
  const doc = useEditorStore((s) => s.doc);
  const variables = useEditorStore((s) => s.variables);
  const edit = useEditorStore((s) => s.edit);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);

  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

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

  const handleSave = async () => {
    if (!templateId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      // Mirror variables into the document too so reads via either path work.
      const documentToSave = { ...doc, variables };
      const { error } = await supabase
        .from('ad_templates')
        .update({
          title: templateTitle,
          document: documentToSave,
          variables,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId);
      if (error) throw error;
      setLastSavedAt(new Date());
    } catch (err) {
      console.error('Save failed', err);
      alert('Save failed. See console.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = () => {
    if (!templateId) return;
    router.push(`/dashboard/ads/templates/${templateId}/generate`);
  };

  return (
    <div className={styles.topBar}>
      <button
        className={styles.topBarBack}
        onClick={() => router.push('/dashboard/ads/templates')}
        aria-label="Back"
      >
        <ArrowLeft size={17} strokeWidth={1.75} />
      </button>
      <input
        className={styles.topBarTitleInput}
        value={templateTitle}
        onChange={(e) => setTemplateTitle(e.target.value)}
        placeholder="Untitled Ad Template"
        aria-label="Template title"
      />

      <div className={styles.topBarGroup}>
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
      {lastSavedAt && (
        <span className={styles.topBarHint}>
          Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      <button
        className="btn btn-secondary btn-sm"
        onClick={handleSave}
        disabled={saving || !templateId}
      >
        <Save size={13} strokeWidth={2} /> {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        className="btn btn-primary btn-sm"
        onClick={handleGenerate}
        disabled={!templateId}
      >
        <Sparkles size={13} strokeWidth={2} /> Generate
      </button>
    </div>
  );
}
