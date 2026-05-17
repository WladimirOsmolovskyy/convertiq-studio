import type { TextNode } from './nodes';

let measureCtx: CanvasRenderingContext2D | null = null;

function getCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measureCtx) {
    const c = document.createElement('canvas');
    measureCtx = c.getContext('2d');
  }
  return measureCtx;
}

export function measureText(node: TextNode): { width: number; height: number } {
  const ctx = getCtx();
  const lines = node.text.split('\n');
  const lineHeightPx = node.fontSize * node.lineHeight;
  if (!ctx) {
    // SSR fallback — approximate via fontSize * char count
    const approx = lines.reduce((m, l) => Math.max(m, l.length), 0) * node.fontSize * 0.55;
    return { width: Math.ceil(approx), height: Math.ceil(lines.length * lineHeightPx) };
  }
  ctx.font = `${node.fontWeight} ${node.fontSize}px ${node.fontFamily}`;
  let maxWidth = 0;
  for (const line of lines) {
    const m = ctx.measureText(line || ' ');
    maxWidth = Math.max(maxWidth, m.width);
  }
  // Add letter-spacing across each line (approximate)
  if (node.letterSpacing) {
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
    maxWidth += node.letterSpacing * Math.max(0, longest - 1);
  }
  return {
    width: Math.ceil(maxWidth),
    height: Math.ceil(lines.length * lineHeightPx),
  };
}
