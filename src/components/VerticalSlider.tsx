"use client";

import { useRef, useState } from "react";
import { vibrateSnap } from "@/lib/haptics";

type Props = {
  className?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label: string;
  snapTo?: number;
  snapStrength?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function snapStep(n: number, step: number) {
  if (step <= 0) return n;
  return Math.round(n / step) * step;
}

export default function VerticalSlider({
  className = "",
  min,
  max,
  step = 0.01,
  value,
  onChange,
  label,
  snapTo,
  snapStrength = 0.055,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const wasSnappedRef = useRef(false);
  const [active, setActive] = useState(false);
  const range = max - min || 1;
  const normal = snapTo ?? (min + max) / 2;

  const applySnap = (n: number, withHaptic: boolean) => {
    let v = clamp(snapStep(n, step), min, max);
    let snapped = false;
    if (snapTo !== undefined) {
      const threshold = range * snapStrength;
      if (Math.abs(v - snapTo) <= threshold) {
        v = snapTo;
        snapped = true;
      }
    }
    if (withHaptic && snapped && !wasSnappedRef.current) {
      vibrateSnap();
    }
    wasSnappedRef.current = snapped;
    return v;
  };

  const ratio = (clamp(value, min, max) - min) / range;
  const thumbTop = `${(1 - ratio) * 100}%`;
  const snapTop = `${(1 - (clamp(normal, min, max) - min) / range) * 100}%`;

  // At normal (center) = 1; above = larger; below = smaller
  const fromNormal = (value - normal) / (range / 2);
  const sizeScale = clamp(1 + fromNormal * 0.38, 0.62, 1.38);

  const valueFromClientY = (clientY: number, withHaptic: boolean) => {
    const el = trackRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const t = clamp((clientY - rect.top) / (rect.height || 1), 0, 1);
    return applySnap(max - t * range, withHaptic);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setActive(false);
    onChange(applySnap(value, true));
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number(value.toFixed(3))}
      tabIndex={0}
      className={`side-slider ${active ? "is-active" : ""} ${className}`}
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setActive(true);
        wasSnappedRef.current = snapTo !== undefined && Math.abs(value - snapTo) < 1e-6;
        onChange(valueFromClientY(e.clientY, true));
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        e.preventDefault();
        e.stopPropagation();
        onChange(valueFromClientY(e.clientY, true));
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={() => setActive(false)}
      onKeyDown={(e) => {
        const delta =
          e.key === "ArrowUp" || e.key === "ArrowRight"
            ? step
            : e.key === "ArrowDown" || e.key === "ArrowLeft"
              ? -step
              : 0;
        if (!delta) return;
        e.preventDefault();
        onChange(applySnap(value + delta, true));
      }}
    >
      <span className="side-slider-track" aria-hidden />
      <span className="side-slider-snap" style={{ top: snapTop }} aria-hidden />
      {active && (
        <span
          className="side-slider-thumb"
          style={{
            top: thumbTop,
            width: `${1.05 * sizeScale}rem`,
            height: `${1.05 * sizeScale}rem`,
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
