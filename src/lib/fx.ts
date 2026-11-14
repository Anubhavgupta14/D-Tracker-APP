import * as Haptics from "expo-haptics";
import { AccessibilityInfo, Vibration, type ViewInstance } from "react-native";
import type { RefObject } from "react";

let reduced = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((r) => (reduced = r))
  .catch(() => {});
AccessibilityInfo.addEventListener("reduceMotionChanged", (r) => (reduced = r));

export const reducedMotion = () => reduced;

/** A tiny buzz. Numbers map to haptic strengths; arrays become a vibration pattern. */
export function buzz(pattern: number | number[] = 12) {
  try {
    if (Array.isArray(pattern)) {
      Vibration.vibrate([0, ...pattern]);
      return;
    }
    const style =
      pattern <= 8
        ? Haptics.ImpactFeedbackStyle.Light
        : pattern <= 20
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Heavy;
    void Haptics.impactAsync(style);
  } catch {
    /* not supported */
  }
}

/* ---------- Emoji bursts (drawn by <BurstLayer /> at the app root) ---------- */

export interface BurstEvent {
  id: number;
  x: number;
  y: number;
  emojis: string[];
  count: number;
}

type Listener = (e: BurstEvent) => void;
const listeners = new Set<Listener>();
let n = 0;

export function onBurst(cb: Listener) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Throw a handful of emoji out from a point (window coordinates) or from the
 * centre of a view. Used for hearts, sparkles and chocolate confetti.
 */
export function burst(
  from: RefObject<ViewInstance | null> | { x: number; y: number } | null | undefined,
  emojis: string[] = ["💗", "✨", "💖", "🌸"],
  count = 14,
) {
  // Confetti is decoration: never let a missing view break the real action.
  if (!from || reduced) return;
  const fire = (x: number, y: number) => {
    const e = { id: n++, x, y, emojis, count };
    listeners.forEach((l) => l(e));
  };
  if ("x" in from) return fire(from.x, from.y);
  from.current?.measureInWindow((x, y, w, h) => fire(x + w / 2, y + h / 2));
}
