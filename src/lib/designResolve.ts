/**
 * Design resolution — the single place where a stored (possibly sparse)
 * DesignConfig is resolved against the project's Brand palette into a
 * fully-populated design the renderer can consume.
 *
 * Three-tier color model:
 *   element override  →  questionnaire variable (design.colors)  →  Brand token
 *
 * `resolveDesign` fills any ABSENT color value from the Brand palette (via
 * the mapping below) and derives component colors the same way the editor
 * used to (the logic moved here from `syncColorsToComponents`). Stored
 * questionnaire color variables (`design.colors`) still win over Brand.
 * Stored COMPONENT colors, though — a deprecated layer once cached by the
 * editor — are now ignored and always re-derived from the resolved colors,
 * so legacy questionnaires track the Brand. Only structural component
 * fields (padding, radius, font size, height) still honour a stored value.
 *
 * Because `defaultBrandPalette` equals the historical default questionnaire
 * colors, an empty design resolved against the default brand reproduces the
 * previous default look pixel-for-pixel.
 */

import {
  type DesignConfig,
  type BrandPalette,
  type BrandTokenId,
  resolveBrandToken,
} from './types';

/** Stored (sparse) shapes. */
type Colors = NonNullable<DesignConfig['colors']>;
type StoredComponents = DesignConfig['components'];

/** Fully-resolved shapes (every field present). */
export type ResolvedColors = Required<Colors> & { heading: string; surfaceHighlight: string };
export type ResolvedComponents = {
  [K in keyof StoredComponents]-?: Required<NonNullable<StoredComponents[K]>>;
};
export type ResolvedDesign = Omit<DesignConfig, 'colors' | 'components'> & {
  colors: ResolvedColors;
  components: ResolvedComponents;
};

/** Which Brand token each questionnaire color variable inherits by default. */
const COLOR_TO_BRAND: Record<keyof ResolvedColors, BrandTokenId> = {
  primary: 'brand.core',
  secondary: 'brand.accent',
  background: 'background.primary',
  surface: 'surface',
  text: 'body',
  textMuted: 'line.highlight',
  accent: 'brand.core',
  error: 'brand.highlight',
  success: 'brand.accent',
  heading: 'heading',
  surfaceHighlight: 'surface.highlight',
};

/** Literal fallbacks for color variables that don't map cleanly to brand. */
const COLOR_LITERAL_FALLBACK: Partial<Record<keyof ResolvedColors, string>> = {
  error: '#ff3b30',
  success: '#34c759',
};

/* ── Color helpers (mirrors the editor's derivation) ───────────── */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return null;
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}
/** Accepts `#rrggbb` or `#rrggbbaa` (brand colors may carry opacity). The
 *  brightness/rgb helpers below read the first three pairs, ignoring alpha. */
function isValidHex(c: string) { return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c); }
function rgba(hex: string, alpha: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${alpha})`;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}
function adjustBrightness(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  return `#${[clamp(rgb[0] + amount), clamp(rgb[1] + amount), clamp(rgb[2] + amount)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
function isLight(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 > 0.55;
}

/** Resolve the questionnaire color variables: literal ?? brand ?? fallback. */
export function resolveColors(
  stored: Colors | undefined,
  brand: BrandPalette | undefined,
): ResolvedColors {
  const c: Colors = stored ?? {};
  const fromBrand = (key: keyof Colors) =>
    c[key] ?? COLOR_LITERAL_FALLBACK[key] ?? resolveBrandToken(brand, COLOR_TO_BRAND[key]);
  return {
    primary: c.primary ?? resolveBrandToken(brand, COLOR_TO_BRAND.primary),
    secondary: c.secondary ?? resolveBrandToken(brand, COLOR_TO_BRAND.secondary),
    background: c.background ?? resolveBrandToken(brand, COLOR_TO_BRAND.background),
    surface: c.surface ?? resolveBrandToken(brand, COLOR_TO_BRAND.surface),
    text: c.text ?? resolveBrandToken(brand, COLOR_TO_BRAND.text),
    textMuted: c.textMuted ?? resolveBrandToken(brand, COLOR_TO_BRAND.textMuted),
    accent: c.accent ?? c.primary ?? resolveBrandToken(brand, COLOR_TO_BRAND.accent),
    error: fromBrand('error'),
    success: fromBrand('success'),
    heading: resolveBrandToken(brand, COLOR_TO_BRAND.heading),
    surfaceHighlight: resolveBrandToken(brand, COLOR_TO_BRAND.surfaceHighlight),
  };
}

/** Derive component styling from resolved colors (the old syncColorsToComponents). */
function deriveComponents(
  colors: ResolvedColors,
  stored: StoredComponents | undefined,
): ResolvedComponents {
  const bg = colors.background;
  const primary = colors.primary;
  const surface = colors.surface;
  const surfaceHighlight = colors.surfaceHighlight;
  // Questionnaire 'secondary' inherits the Brand accent token — used as the
  // default progress fill so the filled portion stands out.
  const accent = colors.secondary;
  const light = isLight(isValidHex(bg) ? bg : '#ffffff');
  // Color fields derive straight from the resolved Brand colors — stored
  // component colors (a deprecated layer cached by an older editor) are
  // intentionally ignored so legacy questionnaires follow the Brand. Only
  // structural fields (padding, radius, font size, height) still honour a
  // stored value.
  const s: Partial<StoredComponents> = stored ?? {};

  return {
    question: {
      background: surface,
      border: `1px solid ${light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
      shadow: light ? '0 2px 8px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)' : '0 4px 24px rgba(0,0,0,0.3)',
      padding: s.question?.padding ?? '2rem',
    },
    option: {
      background: surfaceHighlight,
      hoverBackground: light ? adjustBrightness(isValidHex(bg) ? bg : '#ffffff', -16) : 'rgba(255,255,255,0.08)',
      selectedBackground: rgba(isValidHex(primary) ? primary : '#007aff', 0.08),
      border: `1px solid ${light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
      selectedBorder: `1px solid ${rgba(isValidHex(primary) ? primary : '#007aff', 0.4)}`,
    },
    button: {
      background: primary,
      color: isLight(isValidHex(primary) ? primary : '#007aff') ? '#000000' : '#ffffff',
      borderRadius: s.button?.borderRadius ?? 980,
      padding: s.button?.padding ?? '0.875rem 2rem',
      fontSize: s.button?.fontSize ?? 16,
    },
    progress: {
      background: light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
      fillColor: accent,
      height: s.progress?.height ?? 4,
    },
    input: {
      background: surface,
      border: `1px solid ${light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
      focusBorder: `1px solid ${primary}`,
      borderRadius: s.input?.borderRadius ?? 10,
    },
  };
}

/**
 * Resolve a stored design against the project brand into a fully-populated
 * design. Identity for fully-populated inputs; fills gaps from brand.
 */
export function resolveDesign(design: DesignConfig, brand?: BrandPalette): ResolvedDesign {
  const colors = resolveColors(design.colors, brand);
  const components = deriveComponents(colors, design.components);
  return { ...design, colors, components };
}
