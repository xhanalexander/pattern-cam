/** Sample a rotated square from a source canvas/video/image into an offscreen canvas. */
export function sampleSquare(
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  centerX: number,
  centerY: number,
  size: number,
  rotationDeg: number,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(size));
  out.height = out.width;
  const ctx = out.getContext("2d")!;
  const half = out.width / 2;
  const rad = (rotationDeg * Math.PI) / 180;

  ctx.translate(half, half);
  ctx.rotate(-rad);
  ctx.translate(-centerX, -centerY);
  ctx.drawImage(source, 0, 0, sourceW, sourceH);
  return out;
}

/**
 * Adobe Capture–style tile: one right triangle mirrored across the diagonal
 * into a square, then reflected into 4 quadrants for a seamless kaleidoscope.
 * `swap` uses the opposite triangle as the seed.
 */
export function buildKaleidoscopeTile(
  sample: CanvasImageSource,
  tileSize: number,
  swap = false,
): HTMLCanvasElement {
  const s = Math.max(2, Math.round(tileSize));
  const half = s / 2;

  // Triangle → square via diagonal mirror
  const square = document.createElement("canvas");
  square.width = half;
  square.height = half;
  const sctx = square.getContext("2d")!;

  if (!swap) {
    // Source = lower-left triangle; mirror across diagonal into top-right
    sctx.save();
    sctx.beginPath();
    sctx.moveTo(0, 0);
    sctx.lineTo(half, half);
    sctx.lineTo(0, half);
    sctx.closePath();
    sctx.clip();
    sctx.drawImage(sample, 0, 0, half, half);
    sctx.restore();

    sctx.save();
    sctx.beginPath();
    sctx.moveTo(0, 0);
    sctx.lineTo(half, 0);
    sctx.lineTo(half, half);
    sctx.closePath();
    sctx.clip();
    sctx.transform(0, 1, 1, 0, 0, 0);
    sctx.drawImage(sample, 0, 0, half, half);
    sctx.restore();
  } else {
    // Source = upper-right triangle; mirror across diagonal into lower-left
    sctx.save();
    sctx.beginPath();
    sctx.moveTo(0, 0);
    sctx.lineTo(half, 0);
    sctx.lineTo(half, half);
    sctx.closePath();
    sctx.clip();
    sctx.drawImage(sample, 0, 0, half, half);
    sctx.restore();

    sctx.save();
    sctx.beginPath();
    sctx.moveTo(0, 0);
    sctx.lineTo(half, half);
    sctx.lineTo(0, half);
    sctx.closePath();
    sctx.clip();
    sctx.transform(0, 1, 1, 0, 0, 0);
    sctx.drawImage(sample, 0, 0, half, half);
    sctx.restore();
  }

  return mirrorQuadrants(square, s);
}

/**
 * Orthogonal square mode: mirror one half of the sample across the midline,
 * then 4-fold into a seamless tile. `swap` uses top/bottom instead of left/right.
 */
export function buildSquareTile(
  sample: CanvasImageSource,
  tileSize: number,
  swap = false,
): HTMLCanvasElement {
  const s = Math.max(2, Math.round(tileSize));
  const half = s / 2;
  const mid = half / 2;

  const cell = document.createElement("canvas");
  cell.width = half;
  cell.height = half;
  const ctx = cell.getContext("2d")!;

  if (!swap) {
    // Left seed → mirror to right
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, mid, half);
    ctx.clip();
    ctx.drawImage(sample, 0, 0, half, half);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(mid, 0, mid, half);
    ctx.clip();
    ctx.translate(half, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sample, 0, 0, half, half);
    ctx.restore();
  } else {
    // Top seed → mirror to bottom
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, half, mid);
    ctx.clip();
    ctx.drawImage(sample, 0, 0, half, half);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, mid, half, mid);
    ctx.clip();
    ctx.translate(0, half);
    ctx.scale(1, -1);
    ctx.drawImage(sample, 0, 0, half, half);
    ctx.restore();
  }

  return mirrorQuadrants(cell, s);
}

/**
 * Hex-style 6-fold kaleidoscope built as a seamless square tile: paint a
 * fully-filled half-cell with mirrored 30° wedges, then 4-fold mirror so
 * repeats have no blank gaps or edge holes. `swap` rotates the seed wedge.
 */
export function buildHexTile(
  sample: CanvasImageSource,
  tileSize: number,
  swap = false,
): HTMLCanvasElement {
  const s = Math.max(2, Math.round(tileSize));
  const half = s / 2;

  const cell = document.createElement("canvas");
  cell.width = half;
  cell.height = half;
  const ctx = cell.getContext("2d")!;

  // Opaque base so no transparent pixels can survive
  ctx.drawImage(sample, 0, 0, half, half);

  const cx = half / 2;
  const cy = half / 2;
  const radius = Math.hypot(cx, cy) + 2;
  const halfWedge = Math.PI / 6;
  const offset = swap ? halfWedge / 2 : 0;

  for (let i = 0; i < 12; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(offset + i * halfWedge);
    if (i % 2 === 1) ctx.scale(1, -1);
    // Triangular wedges (not arcs) so corners of the cell are always covered
    const x1 = Math.cos(-halfWedge) * radius;
    const y1 = Math.sin(-halfWedge) * radius;
    const x2 = Math.cos(halfWedge) * radius;
    const y2 = Math.sin(halfWedge) * radius;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(sample, -cx, -cy, half, half);
    ctx.restore();
  }

  return mirrorQuadrants(cell, s);
}

/** Reflect a half-size cell into a full seamless 4-fold tile. */
function mirrorQuadrants(
  cell: HTMLCanvasElement,
  tileSize: number,
): HTMLCanvasElement {
  const s = tileSize;
  const tile = document.createElement("canvas");
  tile.width = s;
  tile.height = s;
  const tctx = tile.getContext("2d")!;

  tctx.drawImage(cell, 0, 0);

  tctx.save();
  tctx.translate(s, 0);
  tctx.scale(-1, 1);
  tctx.drawImage(cell, 0, 0);
  tctx.restore();

  tctx.save();
  tctx.translate(0, s);
  tctx.scale(1, -1);
  tctx.drawImage(cell, 0, 0);
  tctx.restore();

  tctx.save();
  tctx.translate(s, s);
  tctx.scale(-1, -1);
  tctx.drawImage(cell, 0, 0);
  tctx.restore();

  return tile;
}

/** Fill a canvas by repeating a tile. */
export function fillWithTile(
  target: HTMLCanvasElement,
  tile: CanvasImageSource,
  tileSize: number,
): void {
  const ctx = target.getContext("2d")!;
  const pattern = ctx.createPattern(tile as CanvasImageSource, "repeat");
  if (!pattern) {
    ctx.clearRect(0, 0, target.width, target.height);
    return;
  }
  // Scale pattern so each repeat is tileSize CSS-ish pixels in bitmap space
  const scale = tileSize / (tile as HTMLCanvasElement).width;
  if ("setTransform" in pattern && typeof pattern.setTransform === "function") {
    const m = new DOMMatrix().scale(scale, scale);
    pattern.setTransform(m);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, target.width, target.height);
}

/** Build a PNG Blob synchronously so share/download stays in the user gesture. */
function canvasPngBlob(canvas: HTMLCanvasElement): Blob {
  const dataUrl = canvas.toDataURL("image/png");
  const marker = ";base64,";
  const idx = dataUrl.indexOf(marker);
  const b64 = idx >= 0 ? dataUrl.slice(idx + marker.length) : "";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

/** Save PNG — Web Share on mobile (iOS ignores <a download>), else file download. */
export async function downloadPng(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<void> {
  const blob = canvasPngBlob(canvas);
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (typeof nav.share === "function") {
    try {
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return;
      }
    } catch (err) {
      // User cancel — stop; other errors fall through to download
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function naturalSize(
  source: CanvasImageSource,
): { w: number; h: number } | null {
  if (source instanceof HTMLVideoElement) {
    if (!source.videoWidth) return null;
    return { w: source.videoWidth, h: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    if (!source.naturalWidth) return null;
    return { w: source.naturalWidth, h: source.naturalHeight };
  }
  if (source instanceof HTMLCanvasElement) {
    return { w: source.width, h: source.height };
  }
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return { w: source.width, h: source.height };
  }
  return null;
}
