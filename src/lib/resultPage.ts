import type { ResultNode, ResultPage, TextSpan } from './types';

/** Concatenate the literal-text portions of a span array, dropping variable
 *  references. Used for surfaces that need plain text (webhook payloads,
 *  fallback rendering) before the full block renderer + variable resolver
 *  is wired up. */
export function spansToPlainText(spans: TextSpan[] | undefined): string {
  if (!spans) return '';
  return spans
    .map((s) => (s.type === 'text' ? s.value : ''))
    .join('')
    .trim();
}

/** Walk a node tree depth-first and yield text nodes in document order. */
function* iterTextNodes(node: ResultNode): Generator<{ spans: TextSpan[] }> {
  if (node.type === 'text') {
    yield { spans: node.spans };
    return;
  }
  if (node.type === 'frame') {
    for (const child of node.children) yield* iterTextNodes(child);
  }
}

/** Best-effort projection of a ResultPage to {title, description}.
 *
 *  Used during the staged rollout of the new result-page designer: the
 *  existing thank-you screen + the lead webhook payload still expose a
 *  title/description shape. We derive those from the first two text nodes
 *  found in the page's content tree (which the migration seeds from the
 *  old score_results.title / .description). Once the block renderer ships,
 *  callers that render the full page should stop relying on this and use
 *  the tree directly.
 *
 *  Falls back to {title: page.name, description: ''} if the tree is empty. */
export function deriveTitleDescription(page: ResultPage): {
  title: string;
  description: string;
} {
  const it = iterTextNodes(page.content);
  const first = it.next();
  const second = it.next();
  const title = first.done ? '' : spansToPlainText(first.value.spans);
  const description = second.done ? '' : spansToPlainText(second.value.spans);
  return {
    title: title || page.name,
    description,
  };
}
