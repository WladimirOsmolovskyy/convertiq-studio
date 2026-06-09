/**
 * Color helpers shared by the Brand and design editors.
 *
 * Colors are STORED as CSS hex — `#rrggbb` when fully opaque, `#rrggbbaa`
 * when they carry opacity — so they flow straight through to the renderer
 * as valid CSS. The editors, however, present the hex and the opacity as
 * two separate controls (a 6-digit hex field + a 0–100% slider).
 */

/** Accepts `#rrggbb` or `#rrggbbaa`. */
export function isValidHex(c: string): boolean {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c ?? '');
}

/** The opaque 6-digit RGB part — for a native `<input type="color">`, which
 *  has no alpha. Falls back to black for empty/partial input. */
export function rgbPart(c: string): string {
  return /^#[0-9a-fA-F]{6}/.exec(c ?? '')?.[0] ?? '#000000';
}

/** Split a stored color into its RGB hex + opacity (0–100, rounded). */
export function parseColor(c: string): { rgb: string; alpha: number } {
  const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(c ?? '');
  if (!m) return { rgb: '#000000', alpha: 100 };
  const alpha = m[2] === undefined ? 100 : Math.round((parseInt(m[2], 16) / 255) * 100);
  return { rgb: `#${m[1]}`, alpha };
}

/** Combine an RGB hex + opacity (0–100) into a stored value: 6-digit when
 *  fully opaque (clean, backward-compatible), 8-digit `#rrggbbaa` otherwise. */
export function buildColor(rgb: string, alpha: number): string {
  const a = Math.max(0, Math.min(100, Math.round(alpha)));
  const base = rgbPart(rgb);
  if (a >= 100) return base;
  const hexA = Math.round((a / 100) * 255).toString(16).padStart(2, '0');
  return `${base}${hexA}`;
}

/* ── RGB / HSV conversions (for the color-picker widget) ───────── */

export interface RGB { r: number; g: number; b: number }
export interface HSV { h: number; s: number; v: number }

export function hexToRgb(hex: string): RGB {
  const h = rgbPart(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** h ∈ [0,360), s,v ∈ [0,1]. */
export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = c; b = x; }
  else { r = c; b = x; }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
