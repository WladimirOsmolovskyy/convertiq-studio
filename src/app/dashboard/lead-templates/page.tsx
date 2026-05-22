'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, ChevronDown, ChevronRight, Loader2, Check } from 'lucide-react';
import type { LeadField, LeadFieldTemplate } from '@/lib/types';
import dashStyles from '../dashboard.module.css';
import styles from './lead-templates.module.css';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function LeadTemplatesPage() {
  const [templates, setTemplates] = useState<LeadFieldTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // RLS filters to the current user — no explicit user_id filter needed.
    supabase
      .from('lead_field_templates')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setTemplates((data as LeadFieldTemplate[] | null) ?? []);
        setLoading(false);
      });
  }, []);

  const createTemplate = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('lead_field_templates')
      .insert({ user_id: user.id, name: 'New template', fields: [] })
      .select()
      .single();
    if (data && !error) {
      setTemplates((prev) => [...prev, data as LeadFieldTemplate]);
      setExpanded(data.id);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (
      !confirm(
        'Delete this template? Questionnaires using it will keep their own fields but lose the shared set.',
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from('lead_field_templates').delete().eq('id', id);
    if (!error) setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const applyUpdate = (id: string, patch: Partial<LeadFieldTemplate>) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  return (
    <div className={dashStyles.contentBody}>
      <div className={dashStyles.largeTitleBlock}>
        <h1 className={dashStyles.largeTitle}>Lead field templates</h1>
        <button className="btn btn-primary" onClick={createTemplate}>
          <Plus size={14} strokeWidth={2.5} /> New template
        </button>
      </div>

      <p className={styles.intro}>
        Reusable bundles of URL-tracked fields, shared across every project. Use them for tracking
        parameters (Meta, Google, etc.) or pre-filled lead data. Apply a template to a questionnaire
        from its Settings tab — editing a template updates every questionnaire that uses it.
      </p>

      {loading ? (
        <div className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-xl)' }} />
      ) : templates.length === 0 ? (
        <div className={styles.empty}>
          No templates yet. Click <b>New template</b> to define a reusable set of URL fields.
        </div>
      ) : (
        <div className={styles.list}>
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
    </div>
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
    editFields([
      ...(template.fields || []),
      { id: crypto.randomUUID(), label: 'New field', urlParam: '' },
    ]);
  const removeField = (id: string) =>
    editFields((template.fields || []).filter((f) => f.id !== id));
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
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <button
          onClick={onToggle}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          className={styles.expand}
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
          className={styles.nameInput}
        />
        <span className={styles.count}>
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
        <div className={styles.body}>
          <div className={styles.fieldList}>
            {(template.fields || []).map((field) => {
              const kind = field.kind ?? 'url';
              return (
                <div key={field.id} className={styles.row} style={{ gridTemplateColumns: '120px 1fr 1.4fr 36px' }}>
                  <select
                    value={kind}
                    onChange={(e) => {
                      const next = e.target.value as 'url' | 'custom';
                      if (next === 'url') {
                        updateField(field.id, {
                          kind: 'url',
                          inputType: undefined,
                          required: undefined,
                        });
                      } else {
                        updateField(field.id, {
                          kind: 'custom',
                          urlParam: undefined,
                          inputType: field.inputType ?? 'text',
                        });
                      }
                    }}
                    className={styles.input}
                  >
                    <option value="url">URL param</option>
                    <option value="custom">Custom input</option>
                  </select>
                  <input
                    value={field.label}
                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                    placeholder="Display label"
                    className={styles.input}
                  />
                  {kind === 'url' ? (
                    <input
                      value={field.urlParam ?? ''}
                      onChange={(e) => updateField(field.id, { urlParam: e.target.value.trim() })}
                      placeholder="utm_campaign"
                      spellCheck={false}
                      className={`${styles.input} ${styles.inputMono}`}
                    />
                  ) : (
                    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                      <select
                        value={field.inputType ?? 'text'}
                        onChange={(e) =>
                          updateField(field.id, {
                            inputType: e.target.value as 'text' | 'email' | 'tel' | 'number',
                          })
                        }
                        className={styles.input}
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="tel">Phone</option>
                        <option value="number">Number</option>
                      </select>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!field.required}
                          onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        />
                        Required
                      </label>
                    </div>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeField(field.id)}
                    aria-label="Remove field"
                    style={{ padding: '0.4rem', justifyContent: 'center' }}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className={styles.footer}>
            <button className="btn btn-ghost btn-sm" onClick={addField}>
              <Plus size={13} strokeWidth={2.25} /> Add field
            </button>
            <div className={styles.footerRight}>
              <span className={styles.status} aria-live="polite">
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
