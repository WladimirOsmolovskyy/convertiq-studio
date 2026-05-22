'use client';

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import NodeRenderer from '../../../../_components/Renderer';
import { computeLayout } from '../../../../_model/autolayout';
import type { AdDocument, AdSize } from '../../../../_model/nodes';

const PREVIEW_MAX = 240;

export interface SizePreviewHandle {
  /** Reset stage to native size + 1:1, return dataURL, then restore. */
  exportPng: (pixelRatio?: number) => Promise<string>;
  size: AdSize;
}

interface Props {
  doc: AdDocument;
  size: AdSize;
}

const SizePreview = forwardRef<SizePreviewHandle, Props>(function SizePreview({ doc, size }, ref) {
  const stageRef = useRef<Konva.Stage | null>(null);

  // Clone the doc with root frame resized to this preview's target size.
  const sizedDoc = useMemo<AdDocument>(() => {
    const clone = JSON.parse(JSON.stringify(doc)) as AdDocument;
    clone.size = { width: size.width, height: size.height };
    clone.root.transform.width = size.width;
    clone.root.transform.height = size.height;
    return clone;
  }, [doc, size.width, size.height]);

  const layouts = useMemo(() => computeLayout(sizedDoc.root), [sizedDoc]);

  const scale = useMemo(() => {
    const aspect = size.width / size.height;
    if (aspect >= 1) return PREVIEW_MAX / size.width;
    return PREVIEW_MAX / size.height;
  }, [size.width, size.height]);

  const previewW = size.width * scale;
  const previewH = size.height * scale;

  useImperativeHandle(ref, () => ({
    size,
    exportPng: async (pixelRatio = 2) => {
      const stage = stageRef.current;
      if (!stage) throw new Error('stage not ready');
      if (typeof document !== 'undefined' && 'fonts' in document) {
        try { await document.fonts.ready; } catch { /* noop */ }
      }
      const oldScaleX = stage.scaleX();
      const oldScaleY = stage.scaleY();
      const oldWidth = stage.width();
      const oldHeight = stage.height();
      stage.scaleX(1);
      stage.scaleY(1);
      stage.width(size.width);
      stage.height(size.height);
      stage.batchDraw();
      const dataUrl = stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
      stage.scaleX(oldScaleX);
      stage.scaleY(oldScaleY);
      stage.width(oldWidth);
      stage.height(oldHeight);
      stage.batchDraw();
      return dataUrl;
    },
  }), [size]);

  return (
    <Stage
      ref={stageRef}
      width={previewW}
      height={previewH}
      scaleX={scale}
      scaleY={scale}
      listening={false}
    >
      <Layer>
        <NodeRenderer
          node={sizedDoc.root}
          layouts={layouts}
          onSelect={() => {}}
          canDrag={false}
        />
      </Layer>
    </Stage>
  );
});

export default SizePreview;
