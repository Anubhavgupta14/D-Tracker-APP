import * as ImageManipulator from "expo-image-manipulator";
import { api, postJSON } from "./api";

/** Shared types + client calls for the Glow (makeup assistant) tab. */

export interface GlowProfile {
  skinTone?: string; // Fair / Wheatish / Medium / Dusky / Deep
  undertone?: string; // Warm / Cool / Neutral
  skinType?: string; // Oily / Dry / Combination / Normal / Sensitive
  eyeColour?: string; // Dark brown / Brown / Hazel / Black
  notes?: string; // allergies, dislikes, favourites
}

export interface Product {
  type: string; // e.g. "Liquid lipstick"
  suggestion: string; // shade / finish, India-friendly brand ideas
}

export type Difficulty = "easy" | "medium" | "glam";

export interface Look {
  id: string;
  name: string;
  vibe: string;
  occasion?: string;
  difficulty: Difficulty;
  palette: string[]; // hex colours for the little swatch row
  skin: string;
  eyes: string;
  lips: string;
  cheeks: string;
  extras?: string;
  products: Product[];
}

export interface Step {
  title: string;
  detail: string;
  tip?: string;
}

export interface Tutorial {
  title: string;
  minutes: number;
  steps: Step[];
  shopping: Product[];
}

export interface Trend {
  summary: string;
  highlights: string[];
  sources: { title: string; url: string }[];
  live: boolean; // false if we couldn't reach the live web
}

export interface Analysis {
  summary: string;
  undertone: string;
  flatters: string[];
  tips: string[];
}

export const OCCASIONS = [
  { id: "everyday", label: "Everyday", emoji: "☀️" },
  { id: "date", label: "Date night", emoji: "💗" },
  { id: "diwali", label: "Diwali", emoji: "🪔" },
  { id: "wedding", label: "Wedding guest", emoji: "💍" },
  { id: "party", label: "Party", emoji: "🎉" },
  { id: "work", label: "Work", emoji: "💼" },
  { id: "navratri", label: "Navratri", emoji: "💃" },
  { id: "nomakeup", label: "No-makeup", emoji: "🌿" },
];

export const PROFILE_FIELDS = {
  skinTone: { label: "Skin tone", options: ["Fair", "Wheatish", "Medium", "Dusky", "Deep"] },
  undertone: { label: "Undertone", options: ["Warm", "Cool", "Neutral", "Not sure"] },
  skinType: { label: "Skin type", options: ["Oily", "Dry", "Combination", "Normal", "Sensitive"] },
  eyeColour: { label: "Eye colour", options: ["Black", "Dark brown", "Brown", "Hazel"] },
} as const;

/* ---------- Client calls ---------- */

function post<T>(mode: string, payload: Record<string, unknown> = {}): Promise<T> {
  return postJSON<T>("/api/glow", { mode, ...payload });
}

export const glow = {
  state: () => post<{ profile: GlowProfile; saved: Look[] }>("state"),
  saveProfile: (profile: GlowProfile) => post<{ ok: true }>("saveProfile", { profile }),
  trends: (occasion?: string) => post<{ trend: Trend }>("trends", { occasion }),
  looks: (occasion: string, note?: string) => post<{ looks: Look[] }>("looks", { occasion, note }),
  tutorial: (look: Look) => post<{ tutorial: Tutorial }>("tutorial", { look }),
  /** Streams the reply; `onText` is called with the full answer-so-far each time. Resolves with the final text. */
  ask: askStream,
  recreate: (image: string, note?: string) => post<{ intro: string; tutorial: Tutorial }>("recreate", { image, note }),
  analyze: (image: string) => post<{ analysis: Analysis }>("analyze", { image }),
  saveLook: (look: Look) => post<{ ok: true }>("saveLook", { look }),
  removeLook: (id: string) => post<{ ok: true }>("removeLook", { id }),
};

/** Ask Glow, streaming the answer. Calls `onText` with the accumulated reply as it grows. */
async function askStream(question: string, onText: (full: string) => void): Promise<string> {
  const res = await api("/api/glow", { method: "POST", body: JSON.stringify({ mode: "ask", question }) });
  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `Something went wrong (${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const event = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const line = event.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      let obj: { delta?: string; error?: string; done?: boolean };
      try {
        obj = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (obj.error) throw new Error(obj.error);
      if (obj.delta) {
        full += obj.delta;
        onText(full);
      }
    }
  }
  return full;
}

/** Downscale a picked image (max ~1024px, JPEG) to a data URL before upload. */
export async function compressImage(
  uri: string,
  size: { width: number; height: number },
  max = 1024,
  quality = 0.82,
): Promise<string> {
  const scale = Math.min(1, max / Math.max(size.width || max, size.height || max));
  const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
  if (scale < 1) ctx.resize({ width: Math.round(size.width * scale), height: Math.round(size.height * scale) });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error("Couldn't read that image.");
  return `data:image/jpeg;base64,${out.base64}`;
}
