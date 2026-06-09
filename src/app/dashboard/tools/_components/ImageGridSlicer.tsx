'use client';

import { useRef, useState } from 'react';
import { Upload, Grid3x3, Download, X } from 'lucide-react';
import dash from '../../dashboard.module.css';
import styles from './ImageGridSlicer.module.css';

const MAX_LINES = 20;

// Distinct hues for visualizing tiles (editor-only, not the design system).
const TILE_COLORS = [
  '#007aff',
  '#34c759',
  '#ff9500',
  '#af52de',
  '#ff2d55',
  '#5ac8fa',
  '#ffcc00',
  '#30b0c7',
];

interface Tile {
  id: number;
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}

function clampLines(n: number): number {
  if (Number.isNaN(n)) return 1;
  return Math.min(MAX_LINES, Math.max(1, Math.floor(n)));
}

function cellRC(idx: number, cols: number): { r: number; c: number } {
  return { r: Math.floor(idx / cols), c: idx % cols };
}

function normRect(a: number, b: number, cols: number): Omit<Tile, 'id'> {
  const A = cellRC(a, cols);
  const B = cellRC(b, cols);
  return {
    r0: Math.min(A.r, B.r),
    r1: Math.max(A.r, B.r),
    c0: Math.min(A.c, B.c),
    c1: Math.max(A.c, B.c),
  };
}

function tileColor(index: number): string {
  return TILE_COLORS[index % TILE_COLORS.length];
}

export function ImageGridSlicer() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [baseName, setBaseName] = useState('grid');
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(3);
  const [gapCss, setGapCss] = useState(10);
  const [displayW, setDisplayW] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ anchor: number; current: number } | null>(null);
  const [exporting, setExporting] = useState(false);

  const W = dims?.w ?? 0;
  const H = dims?.h ?? 0;

  // Source-pixel gap = CSS gap scaled by image / layout width.
  // (gap_css = scale · gap_src and scale = displayW / W → gap_src = gap_css · W / displayW.)
  const gapSrc = dims && displayW > 0 ? (gapCss * W) / displayW : 0;
  const cellW = dims ? (W - (cols - 1) * gapSrc) / cols : 0;
  const cellH = dims ? (H - (rows - 1) * gapSrc) / rows : 0;
  const valid = cellW > 0 && cellH > 0;

  const handleFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setImageSrc(reader.result);
      const dot = file.name.lastIndexOf('.');
      setBaseName(dot > 0 ? file.name.slice(0, dot) : file.name);
      setTiles([]);
      setSelectedId(null);
    };
    reader.readAsDataURL(file);
  };

  const onImgLoad = () => {
    const el = imgRef.current;
    if (!el) return;
    setDims({ w: el.naturalWidth, h: el.naturalHeight });
    setDisplayW(el.naturalWidth); // default: native size (gap_src === gap_css)
  };

  // Keep tiles inside the grid when its shape changes.
  const clampTiles = (nextCols: number, nextRows: number) => {
    setTiles((prev) =>
      prev.map((t) => ({
        ...t,
        c0: Math.min(t.c0, nextCols - 1),
        c1: Math.min(t.c1, nextCols - 1),
        r0: Math.min(t.r0, nextRows - 1),
        r1: Math.min(t.r1, nextRows - 1),
      })),
    );
  };
  const applyCols = (value: number) => {
    const c = clampLines(value);
    setCols(c);
    clampTiles(c, rows);
  };
  const applyRows = (value: number) => {
    const r = clampLines(value);
    setRows(r);
    clampTiles(cols, r);
  };

  const removeTile = (id: number) => {
    setTiles((prev) => prev.filter((t) => t.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };
  const clearTiles = () => {
    setTiles([]);
    setSelectedId(null);
  };

  // ── Drag to add a tile ───────────────────────────────────────
  const cellFromPointer = (clientX: number, clientY: number): number => {
    const el = overlayRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const c = Math.min(cols - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * cols)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * rows)));
    return r * cols + c;
  };

  const tileAtCell = (idx: number): Tile | undefined => {
    const { r, c } = cellRC(idx, cols);
    return tiles.find((t) => r >= t.r0 && r <= t.r1 && c >= t.c0 && c <= t.c1);
  };

  const addTile = (anchor: number, current: number) => {
    const rect = normRect(anchor, current, cols);
    const id = idRef.current++;
    setTiles((prev) => [...prev, { id, ...rect }]);
    setSelectedId(id);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    overlayRef.current?.setPointerCapture(e.pointerId);
    const i = cellFromPointer(e.clientX, e.clientY);
    setDrag({ anchor: i, current: i });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const i = cellFromPointer(e.clientX, e.clientY);
    if (i !== drag.current) setDrag({ anchor: drag.anchor, current: i });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const current = cellFromPointer(e.clientX, e.clientY);
    if (drag.anchor === current) {
      const hit = tileAtCell(current);
      if (hit) setSelectedId(hit.id);
      else addTile(current, current);
    } else {
      addTile(drag.anchor, current);
    }
    setDrag(null);
  };
  const onPointerCancel = () => setDrag(null);

  // ── Export each tile as its own PNG ──────────────────────────
  const exportTiles = async () => {
    const img = imgRef.current;
    if (!img || !dims || tiles.length === 0 || !valid) return;
    setExporting(true);
    try {
      const ordered = [...tiles].sort((a, b) => a.r0 - b.r0 || a.c0 - b.c0);
      let n = 0;
      for (const t of ordered) {
        n++;
        const sx0 = Math.round(t.c0 * (cellW + gapSrc));
        const sx1 = Math.round(t.c1 * (cellW + gapSrc) + cellW);
        const sy0 = Math.round(t.r0 * (cellH + gapSrc));
        const sy1 = Math.round(t.r1 * (cellH + gapSrc) + cellH);
        const w = sx1 - sx0;
        const h = sy1 - sy0;
        if (w <= 0 || h <= 0) continue;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.drawImage(img, sx0, sy0, w, h, 0, 0, w, h);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `${baseName}_tile-${n}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    } finally {
      setExporting(false);
    }
  };

  if (!imageSrc) {
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
            <Grid3x3 size={28} strokeWidth={1.5} />
          </div>
          <h2 className={dash.emptyStateTitle}>Upload an image to begin</h2>
          <p className={dash.emptyStateDesc}>
            Split it into a grid, draw tiles, set your layout gap, and export each tile cropped so
            they reassemble cleanly in a gapped grid.
          </p>
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} strokeWidth={2} />
            Upload image
          </button>
        </div>
      </>
    );
  }

  // ── Geometry helpers for the preview (percentages of the image) ──
  const xStart = (c: number) => c * (cellW + gapSrc);
  const xEnd = (c: number) => xStart(c) + cellW;
  const yStart = (r: number) => r * (cellH + gapSrc);
  const yEnd = (r: number) => yStart(r) + cellH;
  const pX = (px: number) => `${(px / W) * 100}%`;
  const pY = (px: number) => `${(px / H) * 100}%`;

  const dragRect = drag ? normRect(drag.anchor, drag.current, cols) : null;

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
        <div className={styles.field}>
          <label htmlFor="grid-cols">Columns</label>
          <input
            id="grid-cols"
            type="number"
            min={1}
            max={MAX_LINES}
            value={cols}
            onChange={(e) => applyCols(e.target.valueAsNumber)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="grid-rows">Rows</label>
          <input
            id="grid-rows"
            type="number"
            min={1}
            max={MAX_LINES}
            value={rows}
            onChange={(e) => applyRows(e.target.valueAsNumber)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="grid-gap">Gap (px)</label>
          <input
            id="grid-gap"
            type="number"
            min={0}
            max={500}
            value={gapCss}
            onChange={(e) =>
              setGapCss(Number.isNaN(e.target.valueAsNumber) ? 0 : Math.max(0, Math.floor(e.target.valueAsNumber)))
            }
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="grid-dispw">Layout width</label>
          <input
            id="grid-dispw"
            type="number"
            min={1}
            value={displayW}
            onChange={(e) =>
              setDisplayW(Number.isNaN(e.target.valueAsNumber) ? 1 : Math.max(1, Math.floor(e.target.valueAsNumber)))
            }
          />
        </div>

        <div className={styles.spacer} />

        <span className={styles.count}>
          {tiles.length} tile{tiles.length === 1 ? '' : 's'}
        </span>
        <button className="btn btn-bordered btn-sm" onClick={clearTiles} disabled={tiles.length === 0}>
          Clear all
        </button>
        <button className="btn btn-bordered btn-sm" onClick={() => fileInputRef.current?.click()}>
          Replace image
        </button>
        <button
          className="btn btn-primary"
          onClick={exportTiles}
          disabled={tiles.length === 0 || !valid || exporting}
        >
          <Download size={16} strokeWidth={2} />
          {exporting ? 'Exporting…' : 'Export tiles'}
        </button>
      </div>

      {tiles.length > 0 && (
        <div className={styles.tileList}>
          {tiles.map((t, i) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.chip} ${selectedId === t.id ? styles.chipSelected : ''}`}
              onClick={() => setSelectedId(t.id)}
            >
              <span className={styles.swatch} style={{ background: tileColor(i) }} />
              {t.c1 - t.c0 + 1}×{t.r1 - t.r0 + 1}
              <span
                className={styles.chipRemove}
                role="button"
                aria-label="Remove tile"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTile(t.id);
                }}
              >
                <X size={13} strokeWidth={2.5} />
              </span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.stage}>
        <div className={styles.canvasWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Source"
            className={styles.image}
            draggable={false}
            onLoad={onImgLoad}
          />
          {dims && (
            <div
              ref={overlayRef}
              className={styles.overlay}
              role="group"
              aria-label="Image grid — drag to add a tile, click a tile to select it"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            >
              {/* Grid reference lines */}
              {Array.from({ length: cols - 1 }, (_, k) => (
                <div
                  key={`v${k}`}
                  className={styles.gridLine}
                  style={{ left: pX((xEnd(k) + xStart(k + 1)) / 2), top: 0, bottom: 0, width: 1 }}
                />
              ))}
              {Array.from({ length: rows - 1 }, (_, k) => (
                <div
                  key={`h${k}`}
                  className={styles.gridLine}
                  style={{ top: pY((yEnd(k) + yStart(k + 1)) / 2), left: 0, right: 0, height: 1 }}
                />
              ))}

              {/* Gap strips that get cut between tiles */}
              {gapSrc > 0 &&
                Array.from({ length: cols - 1 }, (_, k) => (
                  <div
                    key={`gv${k}`}
                    className={styles.cutStrip}
                    style={{ left: pX(xEnd(k)), top: 0, bottom: 0, width: pX(gapSrc) }}
                  />
                ))}
              {gapSrc > 0 &&
                Array.from({ length: rows - 1 }, (_, k) => (
                  <div
                    key={`gh${k}`}
                    className={styles.cutStrip}
                    style={{ top: pY(yEnd(k)), left: 0, right: 0, height: pY(gapSrc) }}
                  />
                ))}

              {/* Tiles */}
              {tiles.map((t, i) => {
                const color = tileColor(i);
                return (
                  <div
                    key={t.id}
                    className={`${styles.tile} ${selectedId === t.id ? styles.tileSelected : ''}`}
                    style={{
                      left: pX(xStart(t.c0)),
                      top: pY(yStart(t.r0)),
                      width: pX(xEnd(t.c1) - xStart(t.c0)),
                      height: pY(yEnd(t.r1) - yStart(t.r0)),
                      borderColor: color,
                      background: `${color}26`,
                    }}
                  >
                    <span className={styles.tileLabel} style={{ background: color }}>
                      {i + 1}
                    </span>
                  </div>
                );
              })}

              {/* Live drag preview */}
              {dragRect && (
                <div
                  className={styles.dragPreview}
                  style={{
                    left: pX(xStart(dragRect.c0)),
                    top: pY(yStart(dragRect.r0)),
                    width: pX(xEnd(dragRect.c1) - xStart(dragRect.c0)),
                    height: pY(yEnd(dragRect.r1) - yStart(dragRect.r0)),
                    borderColor: tileColor(tiles.length),
                  }}
                />
              )}
            </div>
          )}
        </div>

        <p className={styles.hint}>
          Drag on the image to add a tile · click a tile to select it
        </p>
        {dims && !valid && (
          <p className={styles.warning}>Gap is too large for this grid and layout width.</p>
        )}
        {dims && valid && (
          <p className={styles.meta}>
            {W} × {H}px · cell ~{Math.round(cellW)} × {Math.round(cellH)}px
            {gapSrc > 0 ? ` · cutting ~${Math.round(gapSrc)}px between tiles` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
