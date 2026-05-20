'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AdTemplateRow, AdGenerationRow } from '@/lib/adTemplates';
import type { AdVariable } from '../../../../_model/nodes';
import { STANDARD_SIZES } from '../../../../_model/nodes';
import {
  applyVariableValues,
  type VariableValue,
} from '../../../../_model/variables';
import { downloadDataUrl } from '../../../../_export/png';
import type { SizePreviewHandle } from './SizePreview';
import styles from '../../../../ads.module.css';
import dash from '../../../../../dashboard.module.css';

const SizePreview = dynamic(() => import('./SizePreview'), { ssr: false });

interface Props {
  template: AdTemplateRow;
  activeProjectId: string;
  /** Optional existing generation to pre-fill the form. */
  generation?: AdGenerationRow;
}

export default function GenerateView({ template, activeProjectId, generation }: Props) {
  const router = useRouter();
  const variables = useMemo<AdVariable[]>(() => {
    const fromColumn = (template.variables ?? []).filter((v): v is AdVariable => !!v && !!v.nodeId);
    if (fromColumn.length > 0) return fromColumn;
    const fromDoc = (template.document?.variables ?? []).filter((v): v is AdVariable => !!v && !!v.nodeId);
    return fromDoc;
  }, [template.variables, template.document]);

  const initialValues = useMemo<Record<string, VariableValue>>(() => {
    const out: Record<string, VariableValue> = {};
    for (const v of variables) {
      out[v.id] = generation?.values?.[v.id] ?? v.defaultValue;
    }
    return out;
  }, [variables, generation]);

  const [values, setValues] = useState<Record<string, VariableValue>>(initialValues);
  const [title, setTitle] = useState(generation?.title ?? `${template.title} – Generation`);
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(() => {
    if (generation && generation.selected_sizes?.length) {
      return new Set(generation.selected_sizes);
    }
    return new Set(STANDARD_SIZES.map((s) => s.name));
  });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Apply current values onto a doc clone for rendering.
  const livedoc = useMemo(() => {
    const cloned = JSON.parse(JSON.stringify(template.document)) as typeof template.document;
    applyVariableValues(cloned, variables, values);
    return cloned;
  }, [template.document, variables, values]);

  const refsBySize = useRef(new Map<string, SizePreviewHandle | null>());

  const toggleSize = (key: string) => {
    setSelectedSizes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const saveGeneration = async (): Promise<string | null> => {
    setSaving(true);
    try {
      const supabase = createClient();
      const selectedArray = Array.from(selectedSizes);

      if (generation) {
        const { error } = await supabase
          .from('ad_generations')
          .update({
            title,
            values,
            selected_sizes: selectedArray,
            updated_at: new Date().toISOString(),
          })
          .eq('id', generation.id);
        if (error) throw error;
        return generation.id;
      }

      const { data, error } = await supabase
        .from('ad_generations')
        .insert({
          project_id: activeProjectId,
          template_id: template.id,
          title,
          values,
          selected_sizes: selectedArray,
        })
        .select()
        .single();
      if (error || !data) throw error ?? new Error('insert failed');
      return (data as AdGenerationRow).id;
    } catch (err) {
      console.error('Save generation failed', err);
      alert('Save failed. See console.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const id = await saveGeneration();
    if (id && !generation) router.push(`/dashboard/ads/generations/${id}`);
  };

  const handleExport = async () => {
    if (selectedSizes.size === 0) return;
    setExporting(true);
    try {
      const id = await saveGeneration();
      // Don't block export if save failed — still allow PNG download.
      void id;
      const safe = (title || 'ad').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      for (const key of selectedSizes) {
        const handle = refsBySize.current.get(key);
        if (!handle) continue;
        const dataUrl = await handle.exportPng(2);
        const { width, height } = handle.size;
        downloadDataUrl(dataUrl, `${safe}-${width}x${height}.png`);
      }
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed. See console.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={dash.contentBody}>
      <div className={dash.largeTitleBlock}>
        <button
          className={styles.topBarBack}
          onClick={() => router.push(generation
            ? '/dashboard/ads/generations'
            : `/dashboard/ads/templates/${template.id}`)}
          aria-label="Back"
        >
          <ArrowLeft size={17} strokeWidth={1.75} />
        </button>
        <input
          className={styles.genNameInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Generation title"
        />
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-secondary"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={14} strokeWidth={2} /> {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={exporting || selectedSizes.size === 0}
        >
          <Download size={14} strokeWidth={2} />
          {exporting ? 'Exporting…' : `Export ${selectedSizes.size}`}
        </button>
      </div>

      <div className={styles.genGrid}>
        <aside className={styles.genForm}>
          <div className={styles.genSection}>Variables</div>
          {variables.length === 0 ? (
            <div className={styles.genEmpty}>
              This template has no variables. Open the editor and mark text, fonts, sizes,
              or colors as variables to expose them here.
            </div>
          ) : (
            variables.map((v) => (
              <VariableField
                key={v.id}
                variable={v}
                value={values[v.id] ?? v.defaultValue}
                onChange={(next) => setValues((prev) => ({ ...prev, [v.id]: next }))}
              />
            ))
          )}
        </aside>

        <section className={styles.genPreviews}>
          <div className={styles.genSection}>Output sizes</div>
          <p className={styles.genHint}>Click to toggle selection. Selected sizes are exported.</p>
          <div className={styles.genPreviewGrid}>
            {STANDARD_SIZES.map((size) => {
              const key = size.name;
              const selected = selectedSizes.has(key);
              return (
                <div
                  key={key}
                  className={`${styles.genPreviewCard} ${selected ? styles.genPreviewCardSelected : ''}`}
                  onClick={() => toggleSize(key)}
                >
                  <div className={styles.genPreviewHeader}>
                    <span className={styles.genPreviewName}>{size.name}</span>
                    <span className={styles.genPreviewDims}>{size.width}×{size.height}</span>
                    <span className={`${styles.genCheck} ${selected ? styles.genCheckOn : ''}`} aria-hidden>
                      {selected && '✓'}
                    </span>
                  </div>
                  <div className={styles.genPreviewBody}>
                    <SizePreview
                      ref={(h) => { refsBySize.current.set(key, h); }}
                      doc={livedoc}
                      size={size}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function VariableField({
  variable,
  value,
  onChange,
}: {
  variable: AdVariable;
  value: VariableValue;
  onChange: (v: VariableValue) => void;
}) {
  if (variable.type === 'color') {
    const str = String(value);
    const hex = /^#[0-9a-fA-F]{6}$/.test(str) ? str : '#000000';
    return (
      <label className={styles.genField}>
        <span className={styles.genFieldLabel}>{variable.label}</span>
        <div className={styles.genColorRow}>
          <div className={styles.swatch} style={{ background: str }}>
            <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} />
          </div>
          <input
            className={styles.field}
            value={str}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
        </div>
      </label>
    );
  }
  if (variable.type === 'number') {
    return (
      <label className={styles.genField}>
        <span className={styles.genFieldLabel}>{variable.label}</span>
        <input
          className={styles.field}
          type="number"
          value={Number(value)}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) onChange(v);
          }}
        />
      </label>
    );
  }
  // text (covers both 'text' content and 'fontFamily' under one input)
  return (
    <label className={styles.genField}>
      <span className={styles.genFieldLabel}>{variable.label}</span>
      {variable.property === 'fontFamily' ? (
        <input
          className={styles.field}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <textarea
          className={styles.field}
          value={String(value)}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
