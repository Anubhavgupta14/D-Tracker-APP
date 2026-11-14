import { createContext, useContext } from "react";
import type { PhaseId } from "./cycle";

/** Design tokens, matching the web app's globals.css. */
export const C = {
  bg: "#fff5ef",
  bg2: "#ffe7df",
  card: "#ffffff",
  ink: "#2e1a2b",
  inkSoft: "#806878",
  line: "#f3e1da",

  berry: "#e5487a",
  berrySoft: "#ffdbe6",
  mint: "#2fb58a",
  mintSoft: "#d4f4e8",
  sun: "#f5a524",
  sunSoft: "#fff0c7",
  lilac: "#8f6ee6",
  lilacSoft: "#ebe3ff",
  peach: "#ff7f5c",
  peachSoft: "#ffe2d8",
  cocoa: "#6e3f2a",

  /* Jarvis tab: dark HUD */
  hudBg: "#0d0a1a",
  hudNav: "rgba(27,21,48,0.92)",
  hudCard: "rgba(255,255,255,0.06)",
  hudLine: "rgba(255,255,255,0.12)",
  hudInk: "#ffffff",
  hudInkSoft: "rgba(255,255,255,0.55)",
} as const;

export type ColorToken = keyof typeof C;

/** Each phase tints the whole app. */
export const PHASE_ACCENT: Record<PhaseId, { accent: string; soft: string }> = {
  period: { accent: C.berry, soft: C.berrySoft },
  follicular: { accent: C.mint, soft: C.mintSoft },
  fertile: { accent: C.sun, soft: C.sunSoft },
  ovulation: { accent: C.sun, soft: C.sunSoft },
  luteal: { accent: C.lilac, soft: C.lilacSoft },
  late: { accent: C.peach, soft: C.peachSoft },
};

/** Mix two #rrggbb colours (t = share of `b`). Stands in for CSS color-mix(). */
export function mix(a: string, b: string, t: number): string {
  const pa = parse(a);
  const pb = parse(b);
  const ch = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
  return `#${[ch(0), ch(1), ch(2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** #rrggbb + alpha → rgba() */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function parse(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export const FONT = {
  display: "Fredoka_600SemiBold",
  displayMedium: "Fredoka_500Medium",
  displayBold: "Fredoka_700Bold",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodySemi: "DMSans_600SemiBold",
  bodyBold: "DMSans_700Bold",
  hand: "Caveat_600SemiBold",
} as const;

export const RADIUS = { card: 28, pill: 999, sheet: 34 } as const;

/** Soft card shadow (Android uses elevation). */
export const SHADOW = {
  card: { shadowColor: "#782846", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  pop: { shadowColor: "#782846", shadowOpacity: 0.3, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
} as const;

export interface Theme {
  phase: PhaseId;
  accent: string;
  accentSoft: string;
  /** Accent text on accent-soft backgrounds (CSS: color-mix(accent 70%, ink)). */
  accentInk: string;
  dark: boolean;
}

export function themeFor(phase: PhaseId, dark = false): Theme {
  const { accent, soft } = PHASE_ACCENT[phase];
  return { phase, accent, accentSoft: soft, accentInk: mix(accent, C.ink, 0.3), dark };
}

export const ThemeContext = createContext<Theme>(themeFor("period"));
export const useTheme = () => useContext(ThemeContext);

/** Lets the tabs layout switch the dark Jarvis HUD on and off. */
export const DarkContext = createContext<(dark: boolean) => void>(() => {});
