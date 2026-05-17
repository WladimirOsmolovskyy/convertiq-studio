'use client';

import { useEffect, useState, Fragment, memo } from 'react';
import { Group, Rect, Ellipse, Line, Text, Path, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { LayoutMap } from '../_model/autolayout';
import type { SceneNode, FrameNode, ImageNode, Transform } from '../_model/nodes';

interface Origin {
  x: number;
  y: number;
}

interface RendererProps {
  node: SceneNode;
  layouts: LayoutMap;
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragEnd?: (id: string, localX: number, localY: number) => void;
  hiddenIds?: Set<string>;
  origin?: Origin;
  /** Set to false when the immediate parent is an auto-layout container (positions are computed). */
  canDrag?: boolean;
}

function useLoadedImage(src: string | undefined) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    const el = new window.Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => setImg(el);
    el.onerror = () => setImg(null);
    el.src = src;
  }, [src]);
  return img;
}

const NodeRenderer = memo(function NodeRenderer(props: RendererProps) {
  const { node, layouts, onSelect, onDragEnd, hiddenIds, origin = { x: 0, y: 0 }, canDrag = false } = props;
  if (!node.visible) return null;
  if (hiddenIds?.has(node.id)) return null;

  const t = layouts.get(node.id);
  if (!t) return null;
  const lx = t.x - origin.x;
  const ly = t.y - origin.y;

  const draggable = canDrag && !node.locked;

  const common = {
    id: node.id,
    listening: !node.locked,
    opacity: node.opacity,
    draggable,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect(node.id, e);
    },
    onTap: (e: Konva.KonvaEventObject<TouchEvent>) => {
      e.cancelBubble = true;
      onSelect(node.id, e);
    },
    onDragEnd: draggable
      ? (e: Konva.KonvaEventObject<DragEvent>) => {
          e.cancelBubble = true;
          if (e.target.id() !== node.id) return;
          onDragEnd?.(node.id, e.target.x(), e.target.y());
        }
      : undefined,
    globalCompositeOperation:
      node.blendMode === 'multiply'
        ? ('multiply' as GlobalCompositeOperation)
        : node.blendMode === 'screen'
        ? ('screen' as GlobalCompositeOperation)
        : ('source-over' as GlobalCompositeOperation),
  };

  if (node.type === 'frame') {
    return (
      <FrameRenderer
        frame={node}
        t={t}
        lx={lx}
        ly={ly}
        common={common}
        layouts={layouts}
        onSelect={onSelect}
        onDragEnd={onDragEnd}
        hiddenIds={hiddenIds}
      />
    );
  }

  if (node.type === 'text') {
    // Only constrain width when wrapping is requested or alignment needs it; otherwise
    // forcing a width from the measurement can introduce off-by-one wraps.
    const widthProp =
      node.autofit === 'wrap' || node.align !== 'left'
        ? Math.ceil(t.width) + 2
        : undefined;
    return (
      <Text
        {...common}
        x={lx}
        y={ly}
        width={widthProp}
        text={node.text}
        fontFamily={node.fontFamily}
        fontSize={node.fontSize}
        fontStyle={String(node.fontWeight)}
        fill={node.color}
        lineHeight={node.lineHeight}
        letterSpacing={node.letterSpacing}
        align={node.align}
        rotation={t.rotation}
      />
    );
  }

  if (node.type === 'shape') {
    if (node.shape === 'rect') {
      return (
        <Rect
          {...common}
          x={lx}
          y={ly}
          width={t.width}
          height={t.height}
          fill={node.fill}
          stroke={node.stroke}
          strokeWidth={node.strokeWidth}
          cornerRadius={node.cornerRadius}
          rotation={t.rotation}
        />
      );
    }
    if (node.shape === 'ellipse') {
      return (
        <Ellipse
          {...common}
          x={lx + t.width / 2}
          y={ly + t.height / 2}
          radiusX={t.width / 2}
          radiusY={t.height / 2}
          fill={node.fill}
          stroke={node.stroke}
          strokeWidth={node.strokeWidth}
          rotation={t.rotation}
        />
      );
    }
    if (node.shape === 'line') {
      return (
        <Line
          {...common}
          x={lx}
          y={ly}
          points={[0, t.height / 2, t.width, t.height / 2]}
          stroke={node.stroke || node.fill || '#000'}
          strokeWidth={node.strokeWidth || t.height}
          lineCap="round"
        />
      );
    }
  }

  if (node.type === 'image') {
    return <ImageRenderer node={node} t={t} lx={lx} ly={ly} common={common} />;
  }

  if (node.type === 'icon') {
    const [vbX, vbY, vbW, vbH] = node.viewBox.split(' ').map(Number);
    const scaleX = t.width / (vbW || 1);
    const scaleY = t.height / (vbH || 1);
    return (
      <Group {...common} x={lx} y={ly} rotation={t.rotation}>
        <Path
          data={node.path}
          x={-vbX * scaleX}
          y={-vbY * scaleY}
          scaleX={scaleX}
          scaleY={scaleY}
          stroke={node.color}
          strokeWidth={node.strokeWidth || 1.5}
          lineCap="round"
          lineJoin="round"
          fillEnabled={false}
        />
      </Group>
    );
  }

  return null;
});

function FrameRenderer({
  frame,
  t,
  lx,
  ly,
  common,
  layouts,
  onSelect,
  onDragEnd,
  hiddenIds,
}: {
  frame: FrameNode;
  t: Transform;
  lx: number;
  ly: number;
  common: Record<string, unknown>;
  layouts: LayoutMap;
  onSelect: RendererProps['onSelect'];
  onDragEnd?: RendererProps['onDragEnd'];
  hiddenIds?: Set<string>;
}) {
  const isAutoLayout = !!frame.autoLayout && frame.autoLayout.direction !== 'none';
  const clipFunc = frame.clip
    ? (ctx: Konva.Context) => {
        const r = frame.cornerRadius || 0;
        const w = t.width;
        const h = t.height;
        if (r <= 0) {
          ctx.rect(0, 0, w, h);
          return;
        }
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, h - r);
        ctx.quadraticCurveTo(w, h, w - r, h);
        ctx.lineTo(r, h);
        ctx.quadraticCurveTo(0, h, 0, h - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
      }
    : undefined;

  return (
    <Group
      {...common}
      x={lx}
      y={ly}
      rotation={t.rotation}
      clipFunc={clipFunc}
    >
      {frame.fill && (
        <Rect
          x={0}
          y={0}
          width={t.width}
          height={t.height}
          fill={frame.fill}
          cornerRadius={frame.cornerRadius}
          listening={false}
        />
      )}
      {frame.children.map((child) => {
        // Auto-layout containers compute participants' positions — those children cannot be dragged.
        const childCanDrag = isAutoLayout
          ? !(child.participatesInAutoLayout ?? true)
          : true;
        return (
          <NodeRenderer
            key={child.id}
            node={child}
            layouts={layouts}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
            hiddenIds={hiddenIds}
            origin={{ x: t.x, y: t.y }}
            canDrag={childCanDrag}
          />
        );
      })}
    </Group>
  );
}

function ImageRenderer({
  node,
  t,
  lx,
  ly,
  common,
}: {
  node: ImageNode;
  t: Transform;
  lx: number;
  ly: number;
  common: Record<string, unknown>;
}) {
  const img = useLoadedImage(node.src);
  if (!img) {
    return (
      <Rect
        {...common}
        x={lx}
        y={ly}
        width={t.width}
        height={t.height}
        fill="rgba(120,120,128,0.16)"
      />
    );
  }
  const iw = img.width;
  const ih = img.height;
  let drawW = t.width;
  let drawH = t.height;
  let offsetX = 0;
  let offsetY = 0;
  if (node.fit === 'cover') {
    const scale = Math.max(t.width / iw, t.height / ih);
    drawW = iw * scale;
    drawH = ih * scale;
    offsetX = (t.width - drawW) / 2;
    offsetY = (t.height - drawH) / 2;
  } else if (node.fit === 'contain') {
    const scale = Math.min(t.width / iw, t.height / ih);
    drawW = iw * scale;
    drawH = ih * scale;
    offsetX = (t.width - drawW) / 2;
    offsetY = (t.height - drawH) / 2;
  }
  return (
    <Group
      {...common}
      x={lx}
      y={ly}
      clipFunc={(ctx: Konva.Context) => {
        ctx.rect(0, 0, t.width, t.height);
      }}
    >
      <KonvaImage image={img} x={offsetX} y={offsetY} width={drawW} height={drawH} />
    </Group>
  );
}

export default NodeRenderer;
