"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { copy } from "@/lib/i18n";
import {
  buildHexTile,
  buildKaleidoscopeTile,
  buildSquareTile,
  downloadPng,
  fillWithTile,
  naturalSize,
  sampleSquare,
} from "@/lib/pattern";
import VerticalSlider from "@/components/VerticalSlider";
import PressableButton from "@/components/PressableButton";
import { vibrateShutter } from "@/lib/haptics";

type Screen = "capture" | "edit";
type PatternMode = "triangle" | "square" | "hex";

const PATTERN_MODES: PatternMode[] = ["triangle", "square", "hex"];

const TILE_PX = 512;

function playShutterClick() {
  vibrateShutter();
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const t0 = ctx.currentTime;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.exp(-i / (ctx.sampleRate * 0.012));
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2200;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t0);
    noise.stop(t0 + 0.06);
    void ctx.resume();
    window.setTimeout(() => void ctx.close(), 200);
  } catch {
    // ignore audio failures
  }
}

export default function PatternApp() {
  const t = copy.en;

  const [screen, setScreen] = useState<Screen>("capture");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasSource, setHasSource] = useState(false);

  const [sampleCenter, setSampleCenter] = useState({ x: 0.5, y: 0.5 });
  const [sampleSize, setSampleSize] = useState(0.42);
  const [rotation, setRotation] = useState(0);
  const [swapSeed, setSwapSeed] = useState(false);
  const [patternMode, setPatternMode] = useState<PatternMode>("triangle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frozenRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const usingImageRef = useRef(false);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const editPreviewRef = useRef<HTMLCanvasElement>(null);
  const tileRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef(0);
  const sampleCenterRef = useRef({ x: 0.5, y: 0.5 });
  const letterboxRef = useRef({ ox: 0, oy: 0, dw: 1, dh: 1 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });
      streamRef.current = stream;
      usingImageRef.current = false;
      imageRef.current = null;
      frozenRef.current = null;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setCameraOn(true);
      setHasSource(true);
    } catch {
      setCameraError(t.cameraError);
      setCameraOn(false);
    }
  }, [t.cameraError]);

  useEffect(() => {
    const block = (e: Event) => {
      e.preventDefault();
    };
    const blockMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const blockTouchScroll = (e: TouchEvent) => {
      // Stop page rubber-band / scroll; sliders still get input via change events
      e.preventDefault();
    };
    const blockWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };

    document.addEventListener("gesturestart", block, { passive: false });
    document.addEventListener("gesturechange", block, { passive: false });
    document.addEventListener("gestureend", block, { passive: false });
    document.addEventListener("touchmove", blockTouchScroll, { passive: false });
    document.addEventListener("touchstart", blockMultiTouch, { passive: false });
    document.addEventListener("wheel", blockWheelZoom, { passive: false });

    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
      document.removeEventListener("gestureend", block);
      document.removeEventListener("touchmove", blockTouchScroll);
      document.removeEventListener("touchstart", blockMultiTouch);
      document.removeEventListener("wheel", blockWheelZoom);
    };
  }, []);

  const getSource = useCallback((): {
    source: CanvasImageSource;
    w: number;
    h: number;
  } | null => {
    if (frozenRef.current) {
      return {
        source: frozenRef.current,
        w: frozenRef.current.width,
        h: frozenRef.current.height,
      };
    }
    if (usingImageRef.current && imageRef.current) {
      const size = naturalSize(imageRef.current);
      if (!size) return null;
      return { source: imageRef.current, w: size.w, h: size.h };
    }
    const video = videoRef.current;
    if (video && cameraOn) {
      const size = naturalSize(video);
      if (!size) return null;
      return { source: video, w: size.w, h: size.h };
    }
    return null;
  }, [cameraOn]);

  const renderFrame = useEffectEvent(() => {
    const src = getSource();
    if (!src) return;

    const minDim = Math.min(src.w, src.h);
    const sizePx = Math.max(32, minDim * sampleSize);
    const cx = src.w * sampleCenterRef.current.x;
    const cy = src.h * sampleCenterRef.current.y;

    const sample = sampleSquare(
      src.source,
      src.w,
      src.h,
      cx,
      cy,
      sizePx,
      rotation,
    );
    const tile =
      patternMode === "square"
        ? buildSquareTile(sample, TILE_PX, swapSeed)
        : patternMode === "hex"
          ? buildHexTile(sample, TILE_PX, swapSeed)
          : buildKaleidoscopeTile(sample, TILE_PX, swapSeed);
    tileRef.current = tile;

    const paintLoupe = () => {
      if (!loupeRef.current) return;
      const loupe = loupeRef.current;
      const box = loupe.parentElement?.getBoundingClientRect();
      if (!box || box.width < 2 || box.height < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const lw = Math.max(1, Math.floor(box.width * dpr));
      const lh = Math.max(1, Math.floor(box.height * dpr));
      if (loupe.width !== lw || loupe.height !== lh) {
        loupe.width = lw;
        loupe.height = lh;
      }
      const lctx = loupe.getContext("2d")!;
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, lw, lh);
      lctx.imageSmoothingEnabled = true;
      lctx.drawImage(sample, 0, 0, lw, lh);
    };

    if (screen === "capture" && previewRef.current) {
      const canvas = previewRef.current;
      const parent = canvas.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.floor(rect.width * dpr));
        const h = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const cell = Math.max(48, Math.floor(Math.min(w, h) / 4));
        fillWithTile(canvas, tile, cell);
      }
      paintLoupe();
    }

    if (screen === "edit" && editPreviewRef.current) {
      const canvas = editPreviewRef.current;
      const parent = canvas.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.floor(rect.width * dpr));
        const h = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        letterboxRef.current = {
          ox: 0,
          oy: 0,
          dw: rect.width,
          dh: rect.height,
        };
        const cell = Math.max(48, Math.floor(Math.min(w, h) / 4));
        fillWithTile(canvas, tile, cell);
      }
      paintLoupe();
    }
  });

  useEffect(() => {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      if (hasSource) renderFrame();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [hasSource, screen]);

  const setCenter = (x: number, y: number) => {
    const next = {
      x: Math.min(0.92, Math.max(0.08, x)),
      y: Math.min(0.92, Math.max(0.08, y)),
    };
    sampleCenterRef.current = next;
    setSampleCenter(next);
  };

  const onUpload = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      stopCamera();
      frozenRef.current = null;
      usingImageRef.current = true;
      imageRef.current = img;
      setHasSource(true);
      setCenter(0.5, 0.5);
      setRotation(0);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const onCapture = () => {
    const src = getSource();
    if (!src || !tileRef.current) return;
    playShutterClick();
    const freeze = document.createElement("canvas");
    freeze.width = src.w;
    freeze.height = src.h;
    freeze.getContext("2d")!.drawImage(src.source, 0, 0, src.w, src.h);
    frozenRef.current = freeze;
    stopCamera();
    setHasSource(true);
    setScreen("edit");
  };

  const onSave = () => {
    const tile = tileRef.current;
    if (!tile) return;

    // Full-screen export matching the phone viewport (not the single tile)
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(cssW * dpr));
    out.height = Math.max(1, Math.round(cssH * dpr));
    const cell = Math.max(48, Math.floor(Math.min(out.width, out.height) / 4));
    fillWithTile(out, tile, cell);
    void downloadPng(out, `pattern-${Date.now()}.png`);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (screen !== "edit") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: sampleCenterRef.current.x,
      originY: sampleCenterRef.current.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.preventDefault();
    const { dw, dh } = letterboxRef.current;
    if (dw < 1 || dh < 1) return;
    const dx = (e.clientX - drag.startX) / dw;
    const dy = (e.clientY - drag.startY) / dh;
    setCenter(drag.originX + dx, drag.originY + dy);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  const loupeMask =
    patternMode === "square"
      ? swapSeed
        ? "linear-gradient(to top, transparent 49.6%, rgba(0,0,0,0.55) 50%)"
        : "linear-gradient(to right, transparent 49.6%, rgba(0,0,0,0.55) 50%)"
      : patternMode === "hex"
        ? undefined
        : swapSeed
          ? "linear-gradient(to bottom left, transparent 49.6%, rgba(0,0,0,0.55) 50%)"
          : "linear-gradient(to top right, transparent 49.6%, rgba(0,0,0,0.55) 50%)";

  const loupeOverlay = (
    <>
      <canvas ref={loupeRef} className="absolute inset-0 h-full w-full" />
      {loupeMask && (
        <div className="absolute inset-0" style={{ background: loupeMask }} />
      )}
      {patternMode === "hex" && (
        <div
          className="absolute inset-0"
          style={{
            background: swapSeed
              ? "conic-gradient(from 30deg, transparent 0deg 30deg, rgba(0,0,0,0.55) 30deg 360deg)"
              : "conic-gradient(from 0deg, transparent 0deg 30deg, rgba(0,0,0,0.55) 30deg 360deg)",
          }}
        />
      )}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {patternMode === "triangle" && (
          <line
            x1="0"
            y1="0"
            x2="100"
            y2="100"
            stroke="white"
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {patternMode === "square" && (
          <>
            <line
              x1="50"
              y1="0"
              x2="50"
              y2="100"
              stroke="white"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="0"
              y1="50"
              x2="100"
              y2="50"
              stroke="white"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
        {patternMode === "hex" && (
          <>
            <polygon
              points="50,4 93,27 93,73 50,96 7,73 7,27"
              fill="none"
              stroke="white"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="50"
              y1="50"
              x2={swapSeed ? "93" : "50"}
              y2={swapSeed ? "27" : "4"}
              stroke="white"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      {patternMode === "triangle" && (
        <>
          <span className="absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2 bg-white" />
          <span className="absolute bottom-0 left-1/2 h-2.5 w-px -translate-x-1/2 bg-white" />
          <span className="absolute left-0 top-1/2 h-px w-2.5 -translate-y-1/2 bg-white" />
          <span className="absolute right-0 top-1/2 h-px w-2.5 -translate-y-1/2 bg-white" />
        </>
      )}
    </>
  );

  const modeLabel =
    patternMode === "square"
      ? t.modeSquare
      : patternMode === "hex"
        ? t.modeHex
        : t.modeTriangle;

  const cyclePatternMode = () => {
    setPatternMode(
      (m) => PATTERN_MODES[(PATTERN_MODES.indexOf(m) + 1) % PATTERN_MODES.length],
    );
  };

  return (
    <div className="relative mx-auto h-dvh w-full max-w-md overflow-hidden overscroll-none touch-none bg-[var(--ink)] text-[var(--cream)] max-md:max-w-none">
      <div className="pointer-events-none absolute inset-0 bg-[var(--floral)] opacity-40" aria-hidden />

      {screen === "capture" ? (
        <>
          {/* Full-viewport stage */}
          <div className="absolute inset-0 z-10 overflow-hidden bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0"
            />
            <canvas ref={previewRef} className="absolute inset-0 h-full w-full" />

            {cameraError && (
              <p className="absolute inset-x-0 bottom-28 z-10 px-4 text-center text-xs text-[var(--pink)]">
                {cameraError}
              </p>
            )}

            {/* Idle: centered hint (shutter + library controls stay at bottom) */}
            {!hasSource && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-8 pb-24">
                <p className="max-w-[16.5rem] text-center text-[0.8125rem] leading-snug text-[var(--cream)]/65">
                  {t.idleSubtitle}
                </p>
              </div>
            )}

            {/* Center sample preview — tap to swap seed */}
            {hasSource && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                <PressableButton
                  title={t.flip}
                  aria-label={t.flip}
                  onPress={() => setSwapSeed((v) => !v)}
                  className="relative aspect-square w-[min(22%,7.25rem)] overflow-hidden border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                >
                  {loupeOverlay}
                </PressableButton>
              </div>
            )}

            {hasSource && (
              <>
                <VerticalSlider
                  className="side-slider-zoom"
                  min={0.18}
                  max={0.7}
                  step={0.01}
                  value={sampleSize}
                  onChange={setSampleSize}
                  label="Zoom"
                  snapTo={0.42}
                />
                <VerticalSlider
                  className="side-slider-rotate"
                  min={-180}
                  max={180}
                  step={0.1}
                  value={rotation}
                  onChange={setRotation}
                  label={t.rotate}
                  snapTo={0}
                />
              </>
            )}
          </div>

          {/* One shutter: start camera OR capture */}
          <div className="absolute inset-x-0 bottom-0 z-20 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <div className="relative flex items-center justify-center px-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  onUpload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {hasSource && (
                <PressableButton
                  title={modeLabel}
                  aria-label={t.modeToggle}
                  onPress={cyclePatternMode}
                  className="absolute left-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-black/35 text-[var(--cream)] backdrop-blur-sm"
                >
                  {patternMode === "square" ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      aria-hidden
                    >
                      <rect x="5" y="5" width="14" height="14" />
                      <path d="M12 5v14M5 12h14" />
                      <path
                        d="M5 5h7v14H5Z"
                        fill="currentColor"
                        fillOpacity="0.35"
                        stroke="none"
                      />
                    </svg>
                  ) : patternMode === "hex" ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" />
                      <path d="M12 12 12 3" />
                      <path
                        d="M12 12 20 7.5 12 3Z"
                        fill="currentColor"
                        fillOpacity="0.35"
                        stroke="none"
                      />
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M5 19V5h14v14H5Z" />
                      <path d="M5 19 19 5" />
                      <path
                        d="M5 19V5l14 14Z"
                        fill="currentColor"
                        fillOpacity="0.35"
                        stroke="none"
                      />
                    </svg>
                  )}
                </PressableButton>
              )}

              {!cameraOn && (
                <PressableButton
                  title={t.upload}
                  aria-label={t.upload}
                  onPress={() => fileInputRef.current?.click()}
                  className="absolute right-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-black/35 text-[var(--cream)] backdrop-blur-sm"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <rect x="7" y="5" width="13" height="13" rx="1.5" />
                    <path d="M4 9v9.5A1.5 1.5 0 0 0 5.5 20H15" />
                    <circle cx="11.5" cy="9.5" r="1.1" fill="currentColor" stroke="none" />
                    <path d="M7 15.5 10.2 12l2.3 2.3 2.2-2.8L20 16.2" />
                  </svg>
                </PressableButton>
              )}

              <PressableButton
                title={cameraOn || hasSource ? t.capture : t.startCamera}
                aria-label={cameraOn || hasSource ? t.capture : t.startCamera}
                onPress={() => {
                  if (!cameraOn && !usingImageRef.current && !frozenRef.current) {
                    void startCamera();
                    return;
                  }
                  if (hasSource) onCapture();
                  else void startCamera();
                }}
                className="h-[4.25rem] w-[4.25rem] rounded-full border-[3px] border-white/85 bg-transparent"
              >
                <span className="sr-only">
                  {cameraOn || hasSource ? t.capture : t.startCamera}
                </span>
              </PressableButton>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Full-height kaleidoscope preview after capture */}
          <div
            ref={stageRef}
            className="absolute inset-0 z-10 overflow-hidden bg-black"
          >
            <canvas
              ref={editPreviewRef}
              className="absolute inset-0 h-full w-full touch-none cursor-grab active:cursor-grabbing"
              style={{ touchAction: "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />

            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <PressableButton
                title={t.flip}
                aria-label={t.flip}
                onPress={() => setSwapSeed((v) => !v)}
                className="relative aspect-square w-[min(22%,7.25rem)] overflow-hidden border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              >
                {loupeOverlay}
              </PressableButton>
            </div>

            <VerticalSlider
              className="side-slider-zoom"
              min={0.18}
              max={0.7}
              step={0.01}
              value={sampleSize}
              onChange={setSampleSize}
              label="Zoom"
              snapTo={0.42}
            />
            <VerticalSlider
              className="side-slider-rotate"
              min={-180}
              max={180}
              step={0.1}
              value={rotation}
              onChange={setRotation}
              label={t.rotate}
              snapTo={0}
            />
          </div>

          {/* Back / Save overlay in front */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex items-center justify-between px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <PressableButton
              onPress={() => {
                frozenRef.current = null;
                setScreen("capture");
              }}
              className="rounded-full border border-white/50 bg-black/35 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cream)] backdrop-blur-sm"
            >
              {t.back}
            </PressableButton>
            <PressableButton
              onPress={onSave}
              className="rounded-full border border-white/90 bg-black/35 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--cream)] backdrop-blur-sm"
            >
              {t.save}
            </PressableButton>
          </div>
        </>
      )}
    </div>
  );
}
