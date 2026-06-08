'use client';

/**
 * Floating color-picker popover: HSV saturation/value square, hue track,
 * alpha track, hex + opacity fields, format dropdown and an eyedropper.
 *
 * Stores/emits a CSS hex value (6-digit when opaque, 8-digit `#rrggbbaa`
 * when translucent) via `onChange`. Rendered in a portal and positioned
 * next to `anchor`.
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Pipette, ChevronDown } from 'lucide-react';
import {
  parseColor, buildColor, rgbPart,
  hexToRgb, rgbToHex, rgbToHsv, hsvToRgb,
  type HSV,
} from '@/lib/color';
import styles from './ColorPicker.module.css';

interface Props {
  title: string;
  /** Stored color: `#rrggbb` or `#rrggbbaa`. */
  value: string;
  /** Bounding rect of the element the picker is anchored to. */
  anchor: DOMRect;
  onChange: (v: string) => void;
  onClose: () => void;
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

const PANEL_W = 264;
const PANEL_H = 332;

export default function ColorPicker({ title, value, anchor, onChange, onClose }: Props) {
  const { rgb, alpha } = parseColor(value);
  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(hexToRgb(rgb)));
  const [hexText, setHexText] = useState(() => rgbPart(value).slice(1).toUpperCase());

  const panelRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);

  const hexNow = rgbToHex(hsvToRgb(hsv));
  const hueHex = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));

  /* ── Emit helpers ──────────────────────────────────────────── */
  const emitHsv = (next: HSV) => {
    setHsv(next);
    const hex = rgbToHex(hsvToRgb(next));
    setHexText(hex.slice(1).toUpperCase());
    onChange(buildColor(hex, alpha));
  };
  const emitAlpha = (a: number) => onChange(buildColor(hexNow, clamp(a, 0, 100)));
  const setFromHex = (hex: string) => {
    setHsv(rgbToHsv(hexToRgb(hex)));
    setHexText(rgbPart(hex).slice(1).toUpperCase());
    onChange(buildColor(hex, alpha));
  };

  /* ── Close on Escape / outside click ───────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => window.addEventListener('mousedown', onDown), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      window.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  /* ── Pointer dragging on the square / tracks ───────────────── */
  const startDrag = (
    ref: { current: HTMLDivElement | null },
    e: ReactPointerEvent,
    cb: (x: number, y: number) => void,
  ) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const apply = (cx: number, cy: number) =>
      cb(clamp((cx - rect.left) / rect.width), clamp((cy - rect.top) / rect.height));
    apply(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => apply(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onHexInput = (t: string) => {
    setHexText(t.toUpperCase());
    const norm = t.startsWith('#') ? t : `#${t}`;
    if (/^#[0-9a-fA-F]{6}$/.test(norm)) setFromHex(norm);
  };

  const eyedrop = () => {
    const Ctor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!Ctor) return;
    new Ctor().open().then((r) => setFromHex(rgbPart(r.sRGBHex))).catch(() => {});
  };
  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  /* ── Position (right of anchor, clamped to viewport) ───────── */
  const left = Math.max(8, Math.min(anchor.right + 8, window.innerWidth - PANEL_W - 8));
  const top = Math.max(8, Math.min(anchor.top, window.innerHeight - PANEL_H - 8));

  return createPortal(
    <div ref={panelRef} className={styles.panel} style={{ left, top, width: PANEL_W }}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Saturation / Value square */}
      <div
        ref={svRef}
        className={styles.svArea}
        style={{ backgroundColor: hueHex }}
        onPointerDown={(e) => startDrag(svRef, e, (x, y) => emitHsv({ h: hsv.h, s: x, v: 1 - y }))}
      >
        <div className={styles.svWhite} />
        <div className={styles.svBlack} />
        <div
          className={styles.svHandle}
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hexNow }}
        />
      </div>

      {/* Hue */}
      <div
        ref={hueRef}
        className={styles.hueTrack}
        onPointerDown={(e) => startDrag(hueRef, e, (x) => emitHsv({ ...hsv, h: x * 360 }))}
      >
        <div className={styles.trackHandle} style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>

      {/* Alpha */}
      <div
        ref={alphaRef}
        className={styles.alphaTrack}
        onPointerDown={(e) => startDrag(alphaRef, e, (x) => emitAlpha(Math.round(x * 100)))}
      >
        <div className={styles.alphaFill} style={{ backgroundImage: `linear-gradient(to right, transparent, ${hexNow})` }} />
        <div className={styles.trackHandle} style={{ left: `${alpha}%` }} />
      </div>

      {/* Hex + opacity */}
      <div className={styles.fields}>
        <div className={styles.hexField}>
          <span className={styles.hexHash}>#</span>
          <input
            className={styles.hexInput}
            value={hexText}
            spellCheck={false}
            onChange={(e) => onHexInput(e.target.value)}
            aria-label="Hex"
          />
        </div>
        <input
          className={styles.opacityField}
          value={`${alpha}%`}
          onChange={(e) => {
            const n = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
            if (!Number.isNaN(n)) emitAlpha(n);
          }}
          aria-label="Opacity (%)"
        />
      </div>

      {/* Format + eyedropper */}
      <div className={styles.fields}>
        <button type="button" className={styles.formatBtn} aria-label="Color format">
          HEX <ChevronDown size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={styles.formatBtn}
          onClick={eyedrop}
          disabled={!hasEyeDropper}
          aria-label="Pick color from screen"
          title={hasEyeDropper ? 'Pick from screen' : 'Eyedropper not supported in this browser'}
        >
          <Pipette size={15} strokeWidth={1.75} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
