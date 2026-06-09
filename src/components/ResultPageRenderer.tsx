/**
 * Renders a ResultPage's content node tree to the DOM with CSS flexbox.
 *
 * Used by:
 *   - QuestionnaireRenderer (public + preview): replaces the legacy
 *     thank-you JSX once a page matches the visitor's score.
 *   - The future Result tab editor canvas (wave 2): same render path with
 *     a selection overlay layered on top.
 *
 * The node model mirrors the ad editor's autolayout shape, but where the
 * ads renderer rasterizes to Konva for pixel-perfect PNG export, this one
 * emits real DOM elements so result pages stay accessible, link-friendly,
 * and mobile-reflowable. `widthMode`/`heightMode` map to flex semantics
 * depending on the parent's direction (see {@link sizeStyle}).
 *
 * No editor-specific state lives here — pure rendering.
 */

import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactElement } from 'react';
import type {
  BrandPalette,
  DesignConfig,
  ResultColor,
  ResultFrameNode,
  ResultImageNode,
  ResultNode,
  ResultPage,
  ResultSize,
  ResultTextNode,
} from '@/lib/types';
import { isColorRef, resolveBrandToken } from '@/lib/types';
import { resolveSpans, type ResultRenderContext } from '@/lib/resultVariables';

export interface ResultPageRendererProps {
  page: ResultPage;
  ctx: ResultRenderContext;
  design: DesignConfig;
  /** Project Brand palette. Node colors bound to a Brand token (`{ $var }`)
   *  resolve against this, so the page stays on-brand and follows palette
   *  edits. Literal node colors ignore it. */
  brand?: BrandPalette;
  /** Editor mode: when set, every rendered node gets a click handler that
   *  calls `onSelectNode(id)`, and the node whose id matches `selectedNodeId`
   *  is outlined. Omit for production/public rendering. */
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
}

interface RenderEnv {
  ctx: ResultRenderContext;
  design: DesignConfig;
  brand?: BrandPalette;
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
}

/** Resolve a node color value to a CSS string: a Brand-token binding resolves
 *  against the palette; a literal passes through; absent stays undefined. */
function resolveColor(
  v: ResultColor | undefined,
  brand: BrandPalette | undefined,
): string | undefined {
  if (v == null) return undefined;
  if (isColorRef(v)) return resolveBrandToken(brand, v.$var);
  return v;
}

interface EditorAttrs {
  onClick?: (e: ReactMouseEvent) => void;
  'data-node-id'?: string;
  /** Style additions to merge into the node's `style`. */
  styleOverlay: CSSProperties;
}

/** Build the click handler + selection outline for a node, or no-ops when
 *  not in editor mode. */
function editorAttrs(env: RenderEnv, nodeId: string): EditorAttrs {
  if (!env.onSelectNode) return { styleOverlay: {} };
  return {
    onClick: (e: ReactMouseEvent) => {
      e.stopPropagation();
      env.onSelectNode?.(nodeId);
    },
    'data-node-id': nodeId,
    styleOverlay:
      env.selectedNodeId === nodeId
        ? { outline: '2px solid var(--accent, #007aff)', outlineOffset: '-2px' }
        : { cursor: 'pointer' },
  };
}

const ALIGN_TO_FLEX: Record<ResultFrameNode['align'], CSSProperties['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

const JUSTIFY_TO_FLEX: Record<ResultFrameNode['justify'], CSSProperties['justifyContent']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-between': 'space-between',
};

/** Translate a {mode, value} into the right CSS for one axis. Direction
 *  context matters because 'fill' means `flex: 1` on the main axis but
 *  `stretch` on the cross axis. */
function sizeStyle(
  axis: 'width' | 'height',
  size: ResultSize | undefined,
  parentDirection: 'row' | 'column' | undefined,
): CSSProperties {
  if (!size) return {};
  const isMainAxis =
    (axis === 'width' && parentDirection === 'row') ||
    (axis === 'height' && parentDirection === 'column');

  if (size.mode === 'fixed') {
    return { [axis]: typeof size.value === 'number' ? `${size.value}px` : undefined };
  }
  if (size.mode === 'fit') {
    return { [axis]: 'max-content' };
  }
  // 'fill'
  if (isMainAxis) return { flex: '1 1 0', [axis]: 0 };
  // cross axis fill
  return { [axis]: '100%', alignSelf: 'stretch' };
}

function renderFrame(
  node: ResultFrameNode,
  env: RenderEnv,
  parentDirection: 'row' | 'column' | undefined,
): ReactElement {
  const attrs = editorAttrs(env, node.id);
  const style: CSSProperties = {
    display: 'flex',
    flexDirection: node.direction,
    gap: `${node.gap}px`,
    paddingTop: `${node.padding.top}px`,
    paddingRight: `${node.padding.right}px`,
    paddingBottom: `${node.padding.bottom}px`,
    paddingLeft: `${node.padding.left}px`,
    alignItems: ALIGN_TO_FLEX[node.align],
    justifyContent: JUSTIFY_TO_FLEX[node.justify],
    background: resolveColor(node.background, env.brand),
    borderRadius: node.borderRadius != null ? `${node.borderRadius}px` : undefined,
    boxSizing: 'border-box',
    ...sizeStyle('width', node.width, parentDirection),
    ...sizeStyle('height', node.height, parentDirection),
    ...attrs.styleOverlay,
  };
  return (
    <div
      key={node.id}
      style={style}
      onClick={attrs.onClick}
      data-node-id={attrs['data-node-id']}
    >
      {node.children.map((child) => renderNode(child, env, node.direction))}
    </div>
  );
}

function renderText(
  node: ResultTextNode,
  env: RenderEnv,
  parentDirection: 'row' | 'column' | undefined,
): ReactElement {
  const attrs = editorAttrs(env, node.id);
  const text = resolveSpans(node.spans, env.ctx);
  const style: CSSProperties = {
    margin: 0,
    fontFamily: node.fontFamily || env.design.typography.fontFamily,
    fontSize: node.fontSize != null ? `${node.fontSize}px` : undefined,
    fontWeight: node.fontWeight,
    lineHeight: node.lineHeight,
    letterSpacing: node.letterSpacing != null ? `${node.letterSpacing}em` : undefined,
    color: resolveColor(node.color, env.brand) || env.design.colors.text,
    textAlign: node.textAlign,
    whiteSpace: 'pre-wrap',
    ...sizeStyle('width', node.width, parentDirection),
    ...sizeStyle('height', node.height, parentDirection),
    ...attrs.styleOverlay,
  };
  return (
    <div
      key={node.id}
      style={style}
      onClick={attrs.onClick}
      data-node-id={attrs['data-node-id']}
    >
      {text || (env.onSelectNode ? ' ' : null)}
    </div>
  );
}

function renderImage(
  node: ResultImageNode,
  env: RenderEnv,
  parentDirection: 'row' | 'column' | undefined,
): ReactElement {
  const attrs = editorAttrs(env, node.id);
  // Use plain <img>: result pages render on user-owned custom domains where
  // next/image's optimizer doesn't have the source domains pre-allowlisted,
  // and these images are typically small CTAs / logos, not hero photos.
  const style: CSSProperties = {
    display: 'block',
    objectFit: node.fit || 'cover',
    borderRadius: node.borderRadius != null ? `${node.borderRadius}px` : undefined,
    ...sizeStyle('width', node.width, parentDirection),
    ...sizeStyle('height', node.height, parentDirection),
    ...attrs.styleOverlay,
  };
  // In editor mode, fall back to a placeholder block so authors can see
  // and click the node before they've set a src.
  if (env.onSelectNode && !node.src) {
    return (
      <div
        key={node.id}
        style={{
          ...style,
          background: 'var(--fill-quaternary, #eef0f2)',
          color: 'var(--text-muted, #999)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          minHeight: '40px',
        }}
        onClick={attrs.onClick}
        data-node-id={attrs['data-node-id']}
      >
        Image
      </div>
    );
  }
  const el = (
    <img
      key={node.id}
      src={node.src}
      alt={node.alt || ''}
      style={style}
      onClick={attrs.onClick}
      data-node-id={attrs['data-node-id']}
    />
  );
  return el;
}

function renderNode(
  node: ResultNode,
  env: RenderEnv,
  parentDirection: 'row' | 'column' | undefined,
): ReactElement {
  switch (node.type) {
    case 'frame':
      return renderFrame(node, env, parentDirection);
    case 'text':
      return renderText(node, env, parentDirection);
    case 'image':
      return renderImage(node, env, parentDirection);
  }
}

export default function ResultPageRenderer({
  page,
  ctx,
  design,
  brand,
  selectedNodeId,
  onSelectNode,
}: ResultPageRendererProps) {
  const env: RenderEnv = { ctx, design, brand, selectedNodeId, onSelectNode };
  // Center the root frame inside a max-width container so result pages feel
  // visually consistent with the rest of the questionnaire. The root frame
  // can still set its own width if the author overrides it.
  return (
    <div
      style={{
        width: '100%',
        maxWidth: `${design.layout.maxWidth}px`,
        marginInline: 'auto',
      }}
    >
      {renderNode(page.content, env, undefined)}
    </div>
  );
}
