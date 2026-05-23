'use client';

import type { Audience } from '@/lib/types';

/**
 * Allow-list picker for an integration destination.
 *
 * `value` semantics:
 *   - `null`: no filter — every lead is delivered.
 *   - `string[]`: filter is active.
 *       - Empty array: deliver none.
 *       - Populated: deliver only leads whose audience is in the list.
 *
 * The UI exposes those three states as a toggle (filter on/off) plus a
 * checkbox per audience, so the user can intentionally pick "deliver none"
 * without accidentally landing there by leaving the list empty.
 */
export default function AudienceFilter({
  audiences,
  value,
  onChange,
  disabled,
}: {
  audiences: Audience[];
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  disabled?: boolean;
}) {
  const active = value !== null;
  const selected = new Set(value ?? []);

  const toggleActive = (next: boolean) => {
    if (next) onChange([]);
    else onChange(null);
  };

  const togglePick = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <input
          type="checkbox"
          checked={active}
          disabled={disabled}
          onChange={(e) => toggleActive(e.target.checked)}
        />
        Filter by audience
      </label>

      {active && (
        <>
          {audiences.length === 0 ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              No audiences configured yet. Add audiences in the <b>Audiences</b> tab.
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                padding: '0.5rem 0.625rem',
                background: 'var(--surface)',
                border: '1px solid var(--separator)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {audiences.map((a) => (
                <label
                  key={a.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.8125rem',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                    paddingBlock: '0.125rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    disabled={disabled}
                    onChange={() => togglePick(a.id)}
                  />
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: a.color ?? 'var(--text-muted)',
                      display: 'inline-block',
                    }}
                  />
                  {a.name || '(unnamed)'}
                </label>
              ))}
            </div>
          )}
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {selected.size === 0
              ? 'No audiences selected — nothing will be delivered while the filter is on.'
              : `Deliver only leads in ${selected.size} audience${selected.size === 1 ? '' : 's'}.`}
          </p>
        </>
      )}
    </div>
  );
}
