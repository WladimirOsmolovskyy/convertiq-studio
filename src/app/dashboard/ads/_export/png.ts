import type Konva from 'konva';
import type { AdDocument } from '../_model/nodes';

export async function exportStageToPng(
  stage: Konva.Stage,
  doc: AdDocument,
  pixelRatio = 2,
): Promise<string> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      /* noop */
    }
  }

  // Temporarily reset stage to 1:1 at target size so dataURL is correct.
  const oldScaleX = stage.scaleX();
  const oldScaleY = stage.scaleY();
  const oldWidth = stage.width();
  const oldHeight = stage.height();

  stage.scaleX(1);
  stage.scaleY(1);
  stage.width(doc.size.width);
  stage.height(doc.size.height);
  stage.batchDraw();

  const dataUrl = stage.toDataURL({
    pixelRatio,
    mimeType: 'image/png',
  });

  // Restore.
  stage.scaleX(oldScaleX);
  stage.scaleY(oldScaleY);
  stage.width(oldWidth);
  stage.height(oldHeight);
  stage.batchDraw();

  return dataUrl;
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
