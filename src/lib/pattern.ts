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
 */
export function buildKaleidoscopeTile(
  sample: CanvasImageSource,
  tileSize: number,
): HTMLCanvasElement {
  const s = Math.max(2, Math.round(tileSize));
  const half = s / 2;

  // Triangle → square via diagonal mirror
  const square = document.createElement("canvas");
  square.width = half;
  square.height = half;
  const sctx = square.getContext("2d")!;

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

  // 4-fold mirror for seamless tiling (jaguar-style meeting faces)
  const tile = document.createElement("canvas");
  tile.width = s;
  tile.height = s;
  const tctx = tile.getContext("2d")!;

  tctx.drawImage(square, 0, 0);

  tctx.save();
  tctx.translate(s, 0);
  tctx.scale(-1, 1);
  tctx.drawImage(square, 0, 0);
  tctx.restore();

  tctx.save();
  tctx.translate(0, s);
  tctx.scale(1, -1);
  tctx.drawImage(square, 0, 0);
  tctx.restore();

  tctx.save();
  tctx.translate(s, s);
  tctx.scale(-1, -1);
  tctx.drawImage(square, 0, 0);
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

export function downloadPng(canvas: HTMLCanvasElement, filename: string): void {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename;
  a.click();
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
