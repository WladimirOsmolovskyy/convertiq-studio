'use client';

/**
 * Brand palette editor. Grouped color tokens (Background / UI / Texts /
 * Brand) per the design reference. Each row is a swatch (native color
 * picker) + name + hex, with a reset-to-default affordance when the value
 * diverges. Changes persist to `projects.brand` (debounced).
 */

import { useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, RotateCcw, Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  BRAND_GROUPS,
  defaultBrandPalette,
  type BrandPalette,
  type BrandTokenId,
} from '@/lib/types';
import dash from '../dashboard.module.css';
import styles from './brand.module.css';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_DELAY = 600;

function isValidHex(c: string) {
  return /^#[0-9a-fA-F]{6}$/.test(c);
}

export default function BrandEditor({
  projectId,
  projectName,
  initialPalette,
}: {
  projectId: string;
  projectName: string;
  initialPalette: Record<BrandTokenId, string>;
}) {
  const [palette, setPalette] = useState<Record<BrandTokenId, string>>(initialPalette);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<SaveStatus>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = (next: Record<BrandTokenId, string>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setStatus('saving');
    saveTimer.current = setTimeout(async () => {
      const supabase = createClient();
      // Store the full palette as a plain object (BrandPalette is sparse,
      // but persisting the full set is harmless and keeps reads simple).
      const { error } = await supabase
        .from('projects')
        .update({ brand: next as BrandPalette })
        .eq('id', projectId);
      setStatus(error ? 'error' : 'saved');
    }, SAVE_DELAY);
  };

  const setToken = (id: BrandTokenId, value: string) => {
    const next = { ...palette, [id]: value };
    setPalette(next);
    persist(next);
  };

  const toggleGroup = (id: string) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  return (
    <div className={dash.contentBody}>
      <div className={dash.largeTitleBlock}>
        <h1 className={dash.largeTitle}>Brand</h1>
        <SaveBadge status={status} />
      </div>
      <p className={styles.intro}>
        The shared color palette for <strong>{projectName}</strong>. These are the
        most global tokens — questionnaire designs default from them.
      </p>

      <div className={styles.groups}>
        {BRAND_GROUPS.map((group, gi) => {
          const isCollapsed = collapsed[group.id];
          return (
            <section key={group.id} className={styles.group}>
              <button
                type="button"
                className={styles.groupHeader}
                onClick={() => toggleGroup(group.id)}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed
                  ? <ChevronRight size={14} strokeWidth={2} className={styles.chevron} />
                  : <ChevronDown size={14} strokeWidth={2} className={styles.chevron} />}
                <Folder size={14} strokeWidth={1.75} className={styles.folder} />
                <span className={styles.groupIndex}>{String(gi + 1).padStart(2, '0')}</span>
                <span className={styles.groupLabel}>{group.label}</span>
              </button>

              {!isCollapsed && (
                <div className={styles.tokens}>
                  {group.tokens.map((token) => {
                    const value = palette[token.id];
                    const display = isValidHex(value) ? value : '#000000';
                    const isOverridden = value !== defaultBrandPalette[token.id];
                    return (
                      <div key={token.id} className={styles.tokenRow}>
                        <div className={styles.swatch} style={{ backgroundColor: display }}>
                          <input
                            type="color"
                            value={display}
                            onChange={(e) => setToken(token.id, e.target.value)}
                            aria-label={`${token.label} color`}
                          />
                        </div>
                        <span className={styles.tokenLabel}>{token.label}</span>
                        <input
                          className={styles.hexInput}
                          value={value}
                          spellCheck={false}
                          onChange={(e) => setToken(token.id, e.target.value)}
                        />
                        {isOverridden && (
                          <button
                            type="button"
                            className={styles.resetBtn}
                            onClick={() => setToken(token.id, defaultBrandPalette[token.id])}
                            title="Reset to default"
                            aria-label={`Reset ${token.label} to default`}
                          >
                            <RotateCcw size={12} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  return (
    <span className={styles.saveBadge} data-status={status}>
      {status === 'saving' && <><Loader2 size={12} strokeWidth={2} className={styles.spin} /> Saving</>}
      {status === 'saved' && <><Check size={12} strokeWidth={2} /> Saved</>}
      {status === 'error' && 'Save failed'}
    </span>
  );
}
