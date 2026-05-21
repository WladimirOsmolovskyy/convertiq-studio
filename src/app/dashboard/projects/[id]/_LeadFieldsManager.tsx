'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, Loader2, Check } from 'lucide-react';
import type { LeadField } from '@/lib/types';
import styles from './detail.module.css';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function LeadFieldsManager({
  projectId,
  initial,
}: {
  projectId: string;
  initial: LeadField[];
}) {
  const [fields, setFields] = useState<LeadField[]>(initial);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [dirty, setDirty] = useState(false);

  const update = (next: LeadField[]) => {
    setFields(next);
    setDirty(true);
    if (status === 'saved') setStatus('idle');
  };

  const addField = () =>
    update([...fields, { id: crypto.randomUUID(), label: 'New field', urlParam: '' }]);

  const removeField = (id: string) => update(fields.filter((f) => f.id !== id));

  const editField = (id: string, patch: Partial<LeadField>) =>
    update(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const save = async () => {
    setStatus('saving');
    const supabase = createClient();
    const { error } = await supabase
      .from('projects')
      .update({ lead_fields: fields })
      .eq('id', projectId);
    if (error) {
      console.error('Failed to save project lead fields:', error);
      setStatus('error');
      return;
    }
    setDirty(false);
    setStatus('saved');
    setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2500);
  };

  return (
    <section className={styles.leadFieldsSection}>
      <div className={styles.leadFieldsHeader}>
        <div>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Lead fields</h2>
          <p className={styles.sectionDesc}>
            Shared across every questionnaire in this project. Values are captured silently
            from the URL when a visitor lands on a published page
            (e.g. <code>?utm_campaign=foo</code>) and surfaced on each lead.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={addField}>
          <Plus size={13} strokeWidth={2.25} /> Add field
        </button>
      </div>

      {fields.length === 0 ? (
        <div className={styles.leadFieldsEmpty}>
          No shared fields yet. Add one to capture URL parameters on every questionnaire.
        </div>
      ) : (
        <div className={styles.leadFieldsList}>
          <div className={styles.leadFieldsRowHeader}>
            <span>Label</span>
            <span>URL parameter</span>
            <span></span>
          </div>
          {fields.map((field) => (
            <div key={field.id} className={styles.leadFieldsRow}>
              <input
                value={field.label}
                onChange={(e) => editField(field.id, { label: e.target.value })}
                placeholder="Display label"
                className={styles.leadFieldsInput}
              />
              <input
                value={field.urlParam}
                onChange={(e) => editField(field.id, { urlParam: e.target.value.trim() })}
                placeholder="utm_campaign"
                spellCheck={false}
                className={`${styles.leadFieldsInput} ${styles.leadFieldsInputMono}`}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => removeField(field.id)}
                aria-label="Remove field"
                style={{ padding: '0.4rem', justifyContent: 'center' }}
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.leadFieldsFooter}>
        <span className={styles.leadFieldsStatus} aria-live="polite">
          {status === 'saving' && (
            <>
              <Loader2 size={12} strokeWidth={2} className="animate-spin" /> Saving…
            </>
          )}
          {status === 'saved' && (
            <>
              <Check size={12} strokeWidth={2.25} /> Saved
            </>
          )}
          {status === 'error' && <span style={{ color: 'var(--error)' }}>Couldn&apos;t save</span>}
        </span>
        <button
          className="btn btn-primary btn-sm"
          onClick={save}
          disabled={!dirty || status === 'saving'}
        >
          Save changes
        </button>
      </div>
    </section>
  );
}
