'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, ChevronDown, ChevronRight, Loader2, Check } from 'lucide-react';
import type { LeadField, LeadFieldTemplate } from '@/lib/types';
import styles from './detail.module.css';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function LeadFieldTemplatesManager({ projectId }: { projectId: string }) {
  const [templates, setTemplates] = useState<LeadFieldTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('lead_field_templates')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setTemplates((data as LeadFieldTemplate[] | null) ?? []);
        setLoading(false);
      });
  }, [projectId]);

  const createTemplate = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('lead_field_templates')
      .insert({ project_id: projectId, name: 'New template', fields: [] })
      .select()
      .single();
    if (data && !error) {
      setTemplates((prev) => [...prev, data as LeadFieldTemplate]);
      setExpanded(data.id);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template? Questionnaires using it will keep their own fields but lose the shared set.')) return;
    const supabase = createClient();
    const { error } = await supabase.from('lead_field_templates').delete().eq('id', id);
    if (!error) setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const applyUpdate = (id: string, patch: Partial<LeadFieldTemplate>) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  return (
    <section className={styles.leadFieldsSection}>
      <div className={styles.leadFieldsHeader}>
        <div>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
            Lead field templates
          </h2>
          <p className={styles.sectionDesc}>
            Reusable bundles of URL-tracked fields. Apply a template to a questionnaire on
            its Settings tab. Editing a template updates every questionnaire that uses it;
            per-questionnaire fields stay local.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={createTemplate}>
          <Plus size={13} strokeWidth={2.25} /> New template
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-xl)' }} />
      ) : templates.length === 0 ? (
        <div className={styles.leadFieldsEmpty}>
          No templates yet. Click <b>New template</b> to define a reusable set of URL fields.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              expanded={expanded === template.id}
              onToggle={() => setExpanded((p) => (p === template.id ? null : template.id))}
              onChange={(patch) => applyUpdate(template.id, patch)}
              onDelete={() => deleteTemplate(template.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── Per-template card with name + fields editor ──────────────── */
function TemplateCard({
  template,
  expanded,
  onToggle,
  onChange,
  onDelete,
}: {
  template: LeadFieldTemplate;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<LeadFieldTemplate>) => void;
  onDelete: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');

  const edit = (patch: Partial<LeadFieldTemplate>) => {
    onChange(patch);
    setDirty(true);
    if (status === 'saved') setStatus('idle');
  };

  const editFields = (next: LeadField[]) => edit({ fields: next });

  const addField = () =>
    editFields([...(template.fields || []), { id: crypto.randomUUID(), label: 'New field', urlParam: '' }]);
  const removeField = (id: string) => editFields((template.fields || []).filter((f) => f.id !== id));
  const updateField = (id: string, patch: Partial<LeadField>) =>
    editFields((template.fields || []).map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const save = async () => {
    setStatus('saving');
    const supabase = createClient();
    const { error } = await supabase
      .from('lead_field_templates')
      .update({
        name: template.name,
        fields: template.fields ?? [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', template.id);
    if (error) {
      console.error('Save template failed:', error);
      setStatus('error');
      return;
    }
    setDirty(false);
    setStatus('saved');
    setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2500);
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--separator)',
        borderRadius: 'var(--radius-xl)',
        padding: '0.625rem 0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={onToggle}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          style={{
            width: 24,
            height: 24,
            border: 0,
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {expanded ? (
            <ChevronDown size={14} strokeWidth={2} />
          ) : (
            <ChevronRight size={14} strokeWidth={2} />
          )}
        </button>
        <input
          value={template.name}
          onChange={(e) => edit({ name: e.target.value })}
          placeholder="Template name"
          style={{
            flex: 1,
            font: 'inherit',
            fontSize: '0.9375rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            border: 0,
            background: 'transparent',
            color: 'var(--text)',
            padding: '0.25rem 0.4rem',
            borderRadius: 'var(--radius-md)',
            outline: 'none',
          }}
        />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {(template.fields || []).length} {(template.fields || []).length === 1 ? 'field' : 'fields'}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onDelete}
          aria-label="Delete template"
          style={{ padding: '0.35rem' }}
        >
          <Trash2 size={13} strokeWidth={1.75} />
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: '0.625rem', paddingLeft: '1.5rem' }}>
          {(template.fields || []).length > 0 && (
            <div className={styles.leadFieldsRowHeader} style={{ marginBottom: '0.25rem' }}>
              <span>Label</span>
              <span>URL parameter</span>
              <span></span>
            </div>
          )}
          <div className={styles.leadFieldsList}>
            {(template.fields || []).map((field) => (
              <div key={field.id} className={styles.leadFieldsRow}>
                <input
                  value={field.label}
                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                  placeholder="Display label"
                  className={styles.leadFieldsInput}
                />
                <input
                  value={field.urlParam}
                  onChange={(e) => updateField(field.id, { urlParam: e.target.value.trim() })}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.625rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={addField}>
              <Plus size={13} strokeWidth={2.25} /> Add field
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
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
                {status === 'error' && (
                  <span style={{ color: 'var(--error)' }}>Couldn&apos;t save</span>
                )}
              </span>
              <button
                className="btn btn-primary btn-sm"
                onClick={save}
                disabled={!dirty || status === 'saving'}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
