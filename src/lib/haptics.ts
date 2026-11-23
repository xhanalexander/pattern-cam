/** Safe Vibration API helper — no-ops when unsupported (e.g. iOS Safari, desktop). */
export function vibrate(pattern: number | number[] = 12): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return false;
  }
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export function vibrateSnap() {
  vibrate(10);
}

export function vibrateShutter() {
  vibrate([18, 30, 12]);
}

export function vibrateTap() {
  vibrate(8);
}
