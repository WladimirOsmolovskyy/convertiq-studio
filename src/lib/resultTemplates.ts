/**
 * Global result-page template library.
 *
 * Source-level (not per-account), so every project can drop in a polished,
 * ready-to-edit result page. Each entry's `build()` returns a fresh content
 * tree with new node ids on every call — safe to insert repeatedly.
 *
 * Templates ship with colors BOUND to project Brand tokens (`{ $var }`), so
 * they look on-brand from the first insert and follow later palette edits.
 * Authors can detach any color to a literal (or re-link it) in the inspector.
 * No literal hex lives here — only semantic Brand bindings.
 */

import { newFrameNode, newTextNode } from './types';
import type { BrandTokenId, ColorRef, ResultFrameNode } from './types';

export interface ResultTemplateEntry {
  id: string;
  /** Library label. */
  name: string;
  /** One-line blurb shown in the gallery. */
  description: string;
  /** Default name for the result page this template creates. */
  pageName: string;
  /** Build a fresh content tree (new ids each call). */
  build: () => ResultFrameNode;
}

/** Bind a color to a Brand token. */
const ref = (token: BrandTokenId): ColorRef => ({ $var: token });

/** A clean, generic "score summary" page: a brand-accented score badge, the
 *  matched page name as the headline, a one-line recap, and an editable
 *  "what this means" card. Personalizes via universal variables only
 *  ({score}, {page.name}) so it fits any questionnaire. */
function personalizedScoreResult(): ResultFrameNode {
  return newFrameNode({
    direction: 'column',
    gap: 28,
    padding: { top: 48, right: 24, bottom: 48, left: 24 },
    align: 'center',
    justify: 'start',
    children: [
      // Score badge — surface card with the score in the brand accent.
      newFrameNode({
        direction: 'column',
        gap: 6,
        padding: { top: 28, right: 40, bottom: 28, left: 40 },
        align: 'center',
        justify: 'center',
        background: ref('surface'),
        borderRadius: 28,
        width: { mode: 'fit' },
        children: [
          newTextNode({
            spans: [{ type: 'text', value: 'YOUR SCORE' }],
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.12,
            color: ref('body.secondary'),
            textAlign: 'center',
          }),
          newTextNode({
            spans: [{ type: 'var', key: 'score' }],
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1,
            color: ref('brand.core'),
            textAlign: 'center',
          }),
        ],
      }),
      // Headline — the matched result page's name (per-bracket).
      newTextNode({
        spans: [{ type: 'var', key: 'page.name' }],
        fontSize: 32,
        fontWeight: 700,
        lineHeight: 1.2,
        color: ref('heading'),
        textAlign: 'center',
      }),
      // One-line recap.
      newTextNode({
        spans: [
          { type: 'text', value: 'Based on your answers, you scored ' },
          { type: 'var', key: 'score' },
          { type: 'text', value: ' points.' },
        ],
        fontSize: 18,
        fontWeight: 400,
        lineHeight: 1.5,
        color: ref('body.secondary'),
        textAlign: 'center',
      }),
      // Divider.
      newFrameNode({
        direction: 'row',
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        align: 'stretch',
        justify: 'start',
        background: ref('line'),
        width: { mode: 'fill' },
        height: { mode: 'fixed', value: 1 },
        children: [],
      }),
      // Editable explainer card.
      newFrameNode({
        direction: 'column',
        gap: 10,
        padding: { top: 28, right: 28, bottom: 28, left: 28 },
        align: 'start',
        justify: 'start',
        background: ref('surface'),
        borderRadius: 20,
        width: { mode: 'fill' },
        children: [
          newTextNode({
            spans: [{ type: 'text', value: 'What this means' }],
            fontSize: 18,
            fontWeight: 600,
            color: ref('heading'),
            textAlign: 'left',
          }),
          newTextNode({
            spans: [
              {
                type: 'text',
                value:
                  "Here's a personalized summary based on your result. Edit this text to explain what the score means and the recommended next step.",
              },
            ],
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1.6,
            color: ref('body'),
            textAlign: 'left',
          }),
        ],
      }),
      // Footer note.
      newTextNode({
        spans: [
          { type: 'text', value: 'You can customize every part of this page in the editor.' },
        ],
        fontSize: 13,
        fontWeight: 400,
        color: ref('body.secondary'),
        textAlign: 'center',
      }),
    ],
  });
}

export const RESULT_TEMPLATES: ResultTemplateEntry[] = [
  {
    id: 'personalized-score-result',
    name: 'Personalized score result',
    description: 'Brand-accented score badge, result headline, and an editable summary card.',
    pageName: 'Your result',
    build: personalizedScoreResult,
  },
];

export function getResultTemplate(id: string): ResultTemplateEntry | undefined {
  return RESULT_TEMPLATES.find((t) => t.id === id);
}
