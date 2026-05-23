'use client';

/**
 * Tiny drag-to-resize hook for the left/right rails of the Result editor.
 *
 * Returns the current width + a `onMouseDown` handler to attach to the
 * draggable handle element. Persists to localStorage by key so widths
 * survive reloads. `direction` is +1 for handles where dragging right
 * grows the rail (left rail), -1 for handles where dragging right
 * shrinks it (right rail).
 */

import { useCallback, useEffect, useState } from 'react';

interface Options {
  initial: number;
  min: number;
  max: number;
  direction?: 1 | -1;
  storageKey?: string;
}

export function useResize({ initial, min, max, direction = 1, storageKey }: Options) {
  // Default to `initial` on first render to keep SSR + first client paint
  // in sync; restore from localStorage in an effect to avoid hydration
  // mismatch warnings.
  const [width, setWidth] = useState(initial);

  // Restore from localStorage once on mount. Client-only storage hydration
  // is the recognized exception to the no-setState-in-effect rule.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidth(Math.max(min, Math.min(max, n)));
    } catch {
      /* ignore */
    }
  }, [storageKey, min, max]);

  // Persist with a tiny debounce so dragging doesn't hammer localStorage.
  useEffect(() => {
    if (!storageKey) return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, String(width));
      } catch {
        /* ignore */
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [storageKey, width]);

  // Functional updater + delta-from-last-x avoids needing to read the
  // latest width state from a ref during render.
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      let lastX = e.clientX;

      const handleMove = (ev: MouseEvent) => {
        const delta = (ev.clientX - lastX) * direction;
        lastX = ev.clientX;
        setWidth((w) => Math.max(min, Math.min(max, w + delta)));
      };
      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, min, max],
  );

  return { width, onMouseDown };
}
