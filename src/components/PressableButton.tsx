"use client";

import { useRef, useState } from "react";
import { vibrateTap } from "@/lib/haptics";

type Props = {
  children: React.ReactNode;
  className?: string;
  onPress: () => void;
  /** How long to hold the pressed look before firing (ms) */
  pressMs?: number;
};

export default function PressableButton({
  children,
  className = "",
  onPress,
  pressMs = 180,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const busyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const runPress = () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPressed(true);
    vibrateTap();
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setPressed(false);
      busyRef.current = false;
      timerRef.current = null;
      onPress();
    }, pressMs);
  };

  return (
    <button
      type="button"
      className={`pressable-btn pointer-events-auto ${pressed ? "is-pressed" : ""} ${className}`}
      style={{ touchAction: "manipulation" }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        runPress();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          runPress();
        }
      }}
    >
      {children}
    </button>
  );
}
