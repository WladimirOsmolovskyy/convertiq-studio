import type { DesignConfig } from '@/lib/types';
import type { ResolvedDesign } from '@/lib/designResolve';

/**
 * The CSS background a page actually renders on, matching the published
 * QuestionnaireRenderer: gradient/image use `design.background.value`; solid
 * falls back to the resolved (brand-aware) background color. Shared by the
 * result-editor canvas and the full-screen preview so both match production.
 */
export function pageBackgroundCss(design: DesignConfig, resolved: ResolvedDesign): string {
  if (design.background.type === 'gradient') return design.background.value;
  if (design.background.type === 'image') {
    return `url(${design.background.value}) center/cover no-repeat`;
  }
  return resolved.colors.background;
}
