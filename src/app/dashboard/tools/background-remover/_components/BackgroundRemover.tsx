'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Download, Scissors, Brush, Eraser, RefreshCw } from 'lucide-react';
import dash from '../../../dashboard.module.css';
import styles from './BackgroundRemover.module.css';

const MAX_DIM = 2048;
const MIN_BRUSH = 4;
const MAX_BRUSH = 200;

type Phase = 'idle' | 'processing' | 'ready' | 'error';
type Tool = 'none' | 'include' | 'exclude';

interface SourceData {
  width: number;
  height: number;
  rgba: Uint8ClampedArray; // RGBA from upload (alpha = 255)
  apiAlpha: Uint8ClampedArray; // alpha channel from the API result
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function BackgroundRemover() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef<SourceData | null>(null);
  const overridesRef = useRef<Uint8Array | null>(null); // 0 none, 1 include, 2 exclude
  const baseNameRef = useRef('cutout');

  // Transient pointer/stroke state (refs to avoid re-render churn).
  const strokingRef = useRef(false);
  const strokeBufferRef = useRef<Uint8Array | null>(null);
  const strokeBboxRef = useRef<BBox | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('none');
  const [brushSize, setBrushSize] = useState(40);
  const [tolerance, setTolerance] = useState(40);
  const [feather, setFeather] = useState(0);
  const [expand, setExpand] = useState(0);
  const [revision, setRevision] = useState(0);

  // ────────────── Upload + API call ──────────────
  const handleFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setErrorMsg(null);
    setPhase('processing');

    const dot = file.name.lastIndexOf('.');
    baseNameRef.current = `${dot > 0 ? file.name.slice(0, dot) : file.name}_cutout`;

    try {
      // 1. Decode + resize to MAX_DIM.
      const img = await loadImage(file);
      const resized = resizeToMax(img, MAX_DIM);
      const rctx = resized.canvas.getContext('2d');
      if (!rctx) throw new Error('Canvas context unavailable');
      const origImageData = rctx.getImageData(0, 0, resized.width, resized.height);

      // 2. Encode as JPEG for upload (smaller body, alpha not needed).
      const blob = await new Promise<Blob | null>((resolve) =>
        resized.canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('Failed to encode upload');

      // 3. Hit the route handler.
      const fd = new FormData();
      fd.append('image', blob, 'upload.jpg');
      const res = await fetch('/api/tools/remove-bg', { method: 'POST', body: fd });
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* not json */
        }
        throw new Error(msg);
      }
      const pngBlob = await res.blob();

      // 4. Decode result, sample its alpha channel.
      const pngImg = await loadImage(pngBlob);
      const cw = pngImg.naturalWidth;
      const ch = pngImg.naturalHeight;
      const apiCanvas = document.createElement('canvas');
      apiCanvas.width = cw;
      apiCanvas.height = ch;
      const actx = apiCanvas.getContext('2d');
      if (!actx) throw new Error('Canvas context unavailable');
      actx.drawImage(pngImg, 0, 0);
      const apiImageData = actx.getImageData(0, 0, cw, ch);

      // 5. If the API resized, also resize the original RGB to the result's dims
      //    so working pixel arrays line up.
      let workRGBA = origImageData.data;
      if (cw !== resized.width || ch !== resized.height) {
        const matchCanvas = document.createElement('canvas');
        matchCanvas.width = cw;
        matchCanvas.height = ch;
        const mctx = matchCanvas.getContext('2d');
        if (!mctx) throw new Error('Canvas context unavailable');
        mctx.imageSmoothingEnabled = true;
        mctx.imageSmoothingQuality = 'high';
        mctx.drawImage(resized.canvas, 0, 0, cw, ch);
        workRGBA = mctx.getImageData(0, 0, cw, ch).data;
      }

      const apiAlpha = new Uint8ClampedArray(cw * ch);
      const apiData = apiImageData.data;
      for (let i = 0, j = 0; i < apiData.length; i += 4, j++) {
        apiAlpha[j] = apiData[i + 3];
      }

      dataRef.current = { width: cw, height: ch, rgba: workRGBA, apiAlpha };
      overridesRef.current = new Uint8Array(cw * ch);
      setFeather(0);
      setExpand(0);
      setTool('none');
      setPhase('ready');
      setRevision((r) => r + 1);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setErrorMsg(msg);
      setPhase('error');
    }
  };

  // ────────────── Re-render composite (debounced) ──────────────
  useEffect(() => {
    if (phase !== 'ready') return;
    const data = dataRef.current;
    const overrides = overridesRef.current;
    const canvas = canvasRef.current;
    if (!data || !overrides || !canvas) return;

    const handle = window.setTimeout(() => {
      if (canvas.width !== data.width) canvas.width = data.width;
      if (canvas.height !== data.height) canvas.height = data.height;
      const stroke = strokeCanvasRef.current;
      if (stroke) {
        if (stroke.width !== data.width) stroke.width = data.width;
        if (stroke.height !== data.height) stroke.height = data.height;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Compose working alpha.
      let working: Uint8ClampedArray = new Uint8ClampedArray(data.apiAlpha);
      if (expand !== 0) working = expandMask(working, data.width, data.height, expand);
      if (feather > 0) working = boxBlur(working, data.width, data.height, feather);
      for (let i = 0; i < overrides.length; i++) {
        if (overrides[i] === 1) working[i] = 255;
        else if (overrides[i] === 2) working[i] = 0;
      }

      // Composite into ImageData.
      const out = ctx.createImageData(data.width, data.height);
      const od = out.data;
      const rgba = data.rgba;
      for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
        od[i] = rgba[i];
        od[i + 1] = rgba[i + 1];
        od[i + 2] = rgba[i + 2];
        od[i + 3] = working[j];
      }
      ctx.putImageData(out, 0, 0);
    }, 30);

    return () => window.clearTimeout(handle);
  }, [phase, feather, expand, revision]);

  // ────────────── Brush input ──────────────
  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * sx),
      y: Math.round((e.clientY - rect.top) * sy),
    };
  };

  const stampStroke = (cx: number, cy: number) => {
    const data = dataRef.current;
    const buf = strokeBufferRef.current;
    const bbox = strokeBboxRef.current;
    const stroke = strokeCanvasRef.current;
    if (!data || !buf || !bbox || !stroke) return;

    const r = brushSize / 2;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(data.width, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(data.height, Math.ceil(cy + r));

    bbox.minX = Math.min(bbox.minX, x0);
    bbox.minY = Math.min(bbox.minY, y0);
    bbox.maxX = Math.max(bbox.maxX, x1);
    bbox.maxY = Math.max(bbox.maxY, y1);

    const r2 = r * r;
    for (let y = y0; y < y1; y++) {
      const dy = y - cy;
      for (let x = x0; x < x1; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy <= r2) buf[y * data.width + x] = 1;
      }
    }

    const sctx = stroke.getContext('2d');
    if (!sctx) return;
    sctx.fillStyle = tool === 'include' ? 'rgba(52, 199, 89, 0.45)' : 'rgba(255, 59, 48, 0.45)';
    sctx.beginPath();
    sctx.arc(cx, cy, r, 0, Math.PI * 2);
    sctx.fill();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'none' || !dataRef.current) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    if (!p) return;
    const data = dataRef.current;
    strokingRef.current = true;
    strokeBufferRef.current = new Uint8Array(data.width * data.height);
    strokeBboxRef.current = { minX: data.width, minY: data.height, maxX: 0, maxY: 0 };
    lastPointRef.current = p;
    stampStroke(p.x, p.y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!strokingRef.current) return;
    const p = pointFromEvent(e);
    if (!p) return;
    const last = lastPointRef.current;
    if (last) {
      const dx = p.x - last.x;
      const dy = p.y - last.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(1, brushSize / 4);
      const steps = Math.ceil(dist / step);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        stampStroke(last.x + dx * t, last.y + dy * t);
      }
    }
    lastPointRef.current = p;
  };

  const commitStroke = () => {
    const data = dataRef.current;
    const buf = strokeBufferRef.current;
    const bbox = strokeBboxRef.current;
    const overrides = overridesRef.current;
    if (!data || !buf || !bbox || !overrides) return;
    if (bbox.maxX <= bbox.minX || bbox.maxY <= bbox.minY) return;
    applySmartFill(data, buf, bbox, tool, tolerance, brushSize, overrides);
  };

  const clearStrokeOverlay = () => {
    const stroke = strokeCanvasRef.current;
    if (!stroke) return;
    stroke.getContext('2d')?.clearRect(0, 0, stroke.width, stroke.height);
  };

  const onPointerUp = () => {
    if (!strokingRef.current) return;
    strokingRef.current = false;
    commitStroke();
    clearStrokeOverlay();
    setRevision((r) => r + 1);
  };

  const onPointerCancel = () => {
    strokingRef.current = false;
    clearStrokeOverlay();
  };

  const resetEdits = () => {
    const data = dataRef.current;
    if (!data) return;
    overridesRef.current = new Uint8Array(data.width * data.height);
    setFeather(0);
    setExpand(0);
    setRevision((r) => r + 1);
  };

  const downloadResult = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${baseNameRef.current}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ────────────── Render ──────────────
  if (phase === 'idle' || phase === 'error') {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className={dash.emptyState}>
          <div className={dash.emptyStateIcon}>
            <Scissors size={28} strokeWidth={1.5} />
          </div>
          <h2 className={dash.emptyStateTitle}>Lift the subject out of any photo</h2>
          <p className={dash.emptyStateDesc}>
            Upload an image and we&apos;ll remove the background. Refine with edge sliders and an
            include / exclude brush.
          </p>
          {errorMsg && <p className={styles.error}>{errorMsg}</p>}
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} strokeWidth={2} />
            Upload image
          </button>
        </div>
      </>
    );
  }

  if (phase === 'processing') {
    return (
      <div className={dash.emptyState}>
        <div className={dash.emptyStateIcon}>
          <Scissors size={28} strokeWidth={1.5} />
        </div>
        <h2 className={dash.emptyStateTitle}>Removing background…</h2>
        <p className={dash.emptyStateDesc}>This usually takes a few seconds.</p>
      </div>
    );
  }

  // phase === 'ready'
  return (
    <div className={styles.tool}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <button
            type="button"
            className={`${styles.toolBtn} ${tool === 'include' ? styles.toolBtnActiveIn : ''}`}
            onClick={() => setTool(tool === 'include' ? 'none' : 'include')}
            title="Include brush — paint to add to the subject"
          >
            <Brush size={15} strokeWidth={2} />
            Include
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${tool === 'exclude' ? styles.toolBtnActiveOut : ''}`}
            onClick={() => setTool(tool === 'exclude' ? 'none' : 'exclude')}
            title="Exclude brush — paint to remove from the subject"
          >
            <Eraser size={15} strokeWidth={2} />
            Exclude
          </button>
        </div>

        <Slider label="Brush" min={MIN_BRUSH} max={MAX_BRUSH} value={brushSize} onChange={setBrushSize} disabled={tool === 'none'} />
        <Slider label="Tolerance" min={0} max={120} value={tolerance} onChange={setTolerance} disabled={tool === 'none'} />

        <div className={styles.divider} />

        <Slider label="Feather" min={0} max={10} value={feather} onChange={setFeather} />
        <Slider label="Expand" min={-10} max={10} value={expand} onChange={setExpand} />

        <div className={styles.spacer} />

        <button className="btn btn-bordered btn-sm" onClick={resetEdits}>
          <RefreshCw size={14} strokeWidth={2} />
          Reset
        </button>
        <button className="btn btn-bordered btn-sm" onClick={() => fileInputRef.current?.click()}>
          Replace image
        </button>
        <button className="btn btn-primary" onClick={downloadResult}>
          <Download size={16} strokeWidth={2} />
          Download
        </button>
      </div>

      <div className={styles.stage}>
        <div className={styles.canvasWrap}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            style={{ cursor: tool === 'none' ? 'default' : 'crosshair' }}
          />
          <canvas ref={strokeCanvasRef} className={styles.strokeCanvas} />
        </div>
        <p className={styles.hint}>
          {tool === 'none'
            ? 'Adjust sliders to refine the edge · pick Include or Exclude to brush'
            : 'Paint roughly — the brush picks up similar nearby pixels (Tolerance controls strictness)'}
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function loadImage(src: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(src);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image'));
    };
    img.src = url;
  });
}

function resizeToMax(
  img: HTMLImageElement,
  max: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * ratio);
  const h = Math.round(img.naturalHeight * ratio);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
  }
  return { canvas: c, width: w, height: h };
}

// Separable max (dilate) / min (erode) filter.
function expandMask(src: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  if (radius === 0) return src;
  const r = Math.abs(radius);
  const dilate = radius > 0;
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      let v = dilate ? 0 : 255;
      for (let xx = x0; xx <= x1; xx++) {
        const s = src[y * w + xx];
        if (dilate) {
          if (s > v) v = s;
        } else if (s < v) v = s;
      }
      tmp[y * w + x] = v;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      let v = dilate ? 0 : 255;
      for (let yy = y0; yy <= y1; yy++) {
        const s = tmp[yy * w + x];
        if (dilate) {
          if (s > v) v = s;
        } else if (s < v) v = s;
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

// Separable box blur; one pass approximates Gaussian well enough for an alpha feather.
function boxBlur(src: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  if (radius <= 0) return src;
  const r = Math.floor(radius);
  const tmp = new Float32Array(src.length);
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      let sum = 0;
      let n = 0;
      for (let xx = x0; xx <= x1; xx++) {
        sum += src[y * w + xx];
        n++;
      }
      tmp[y * w + x] = sum / n;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      let sum = 0;
      let n = 0;
      for (let yy = y0; yy <= y1; yy++) {
        sum += tmp[yy * w + x];
        n++;
      }
      out[y * w + x] = Math.round(sum / n);
    }
  }
  return out;
}

function applySmartFill(
  data: { width: number; height: number; rgba: Uint8ClampedArray },
  strokeBuf: Uint8Array,
  bbox: BBox,
  tool: Tool,
  tolerance: number,
  brushSize: number,
  overrides: Uint8Array,
) {
  if (tool === 'none') return;
  const { width: w, height: h, rgba } = data;
  const margin = Math.max(brushSize, 24);
  const minX = Math.max(0, bbox.minX - margin);
  const minY = Math.max(0, bbox.minY - margin);
  const maxX = Math.min(w, bbox.maxX + margin);
  const maxY = Math.min(h, bbox.maxY + margin);

  // 1. Mean stroke color.
  let strokeCount = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let y = bbox.minY; y < bbox.maxY; y++) {
    for (let x = bbox.minX; x < bbox.maxX; x++) {
      const idx = y * w + x;
      if (strokeBuf[idx] === 1) {
        const o = idx * 4;
        sumR += rgba[o];
        sumG += rgba[o + 1];
        sumB += rgba[o + 2];
        strokeCount++;
      }
    }
  }
  if (strokeCount === 0) return;
  const mR = sumR / strokeCount;
  const mG = sumG / strokeCount;
  const mB = sumB / strokeCount;

  // 2. Chebyshev dilation of stroke by `margin` → candidate region.
  const candH = new Uint8Array(w * h);
  for (let y = minY; y < maxY; y++) {
    let runEnd = -1;
    for (let x = minX; x < maxX; x++) {
      const idx = y * w + x;
      if (strokeBuf[idx] === 1) runEnd = x + margin;
      if (x <= runEnd) candH[idx] = 1;
    }
    let runStart = w + 1;
    for (let x = maxX - 1; x >= minX; x--) {
      const idx = y * w + x;
      if (strokeBuf[idx] === 1) runStart = x - margin;
      if (x >= runStart) candH[idx] = 1;
    }
  }
  const candidate = new Uint8Array(w * h);
  for (let x = minX; x < maxX; x++) {
    let runEnd = -1;
    for (let y = minY; y < maxY; y++) {
      const idx = y * w + x;
      if (candH[idx] === 1) runEnd = y + margin;
      if (y <= runEnd) candidate[idx] = 1;
    }
    let runStart = h + 1;
    for (let y = maxY - 1; y >= minY; y--) {
      const idx = y * w + x;
      if (candH[idx] === 1) runStart = y - margin;
      if (y >= runStart) candidate[idx] = 1;
    }
  }

  // 3. Commit: stroke pixels always, neighbours only if their color matches.
  const overrideValue = tool === 'include' ? 1 : 2;
  const tol2 = tolerance * tolerance * 3; // (sum of squared diffs across RGB)
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const idx = y * w + x;
      if (candidate[idx] !== 1) continue;
      if (strokeBuf[idx] === 1) {
        overrides[idx] = overrideValue;
        continue;
      }
      const o = idx * 4;
      const dr = rgba[o] - mR;
      const dg = rgba[o + 1] - mG;
      const db = rgba[o + 2] - mB;
      const d2 = dr * dr + dg * dg + db * db;
      if (d2 <= tol2) overrides[idx] = overrideValue;
    }
  }
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`${styles.sliderField} ${disabled ? styles.sliderDisabled : ''}`}>
      <label>
        {label}: <span>{value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
    </div>
  );
}
