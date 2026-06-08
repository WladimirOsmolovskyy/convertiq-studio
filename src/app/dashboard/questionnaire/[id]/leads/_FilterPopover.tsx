'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './leads.module.css';

type Coords = { top: number; left?: number; right?: number };

/**
 * Trigger + dropdown panel used across the leads filter toolbar (Add Filter
 * menu, and each added-column filter chip).
 *
 * The panel is position:fixed (measured from the trigger) so it's never clipped
 * by an `overflow` ancestor, and closes on outside click, Escape, or any
 * scroll/resize. `children` may be a render-prop receiving a `close` callback
 * (used by the Add Filter menu to close itself when an item is picked).
 */
export function FilterPopover({
  label,
  summary,
  active,
  triggerClassName,
  icon,
  alignRight = false,
  children,
}: {
  label: string;
  summary?: string;
  active: boolean;
  triggerClassName: string;
  icon?: ReactNode;
  alignRight?: boolean;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords(
      alignRight
        ? { top: r.bottom + 4, right: window.innerWidth - r.right }
        : { top: r.bottom + 4, left: r.left },
    );
  };

  const toggle = () => {
    if (!open) place();
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onReflow = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open]);

  return (
    <div className={styles.popoverWrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        data-active={active || undefined}
        onClick={toggle}
      >
        <span className={styles.triggerLabel}>{active && summary ? summary : label}</span>
        {icon ?? <ChevronDown size={13} strokeWidth={2} style={{ flexShrink: 0 }} />}
      </button>
      {open && coords && (
        <div
          ref={panelRef}
          className={styles.popoverPanel}
          style={{ position: 'fixed', top: coords.top, left: coords.left, right: coords.right }}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}
