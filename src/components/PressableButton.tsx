"use client";

import { useRef, useState } from "react";
import { vibrateTap } from "@/lib/haptics";

type Props = {
  children: React.ReactNode;
  className?: string;
  onPress: () => void;
  title?: string;
  "aria-label"?: string;
};

export default function PressableButton({
  children,
  className = "",
  onPress,
  title,
  "aria-label": ariaLabel,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const armedRef = useRef(false);

  const arm = () => {
    if (armedRef.current) return;
    armedRef.current = true;
    setPressed(true);
    vibrateTap();
  };

  const release = (fire: boolean) => {
    if (!armedRef.current) return;
    armedRef.current = false;
    setPressed(false);
    if (fire) onPress();
  };

  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      className={`pressable-btn pointer-events-auto ${pressed ? "is-pressed" : ""} ${className}`}
      style={{ touchAction: "manipulation" }}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        arm();
      }}
      onPointerUp={(e) => {
        if (!armedRef.current) return;
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const inside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (el.hasPointerCapture(e.pointerId)) {
          el.releasePointerCapture(e.pointerId);
        }
        release(inside);
      }}
      onPointerCancel={() => release(false)}
      onLostPointerCapture={() => {
        if (armedRef.current) release(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          arm();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          release(true);
        }
      }}
      onBlur={() => release(false)}
    >
      {children}
    </button>
  );
}
