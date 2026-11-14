import * as Battery from "expo-battery";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import { useSyncExternalStore } from "react";
import { Vibration } from "react-native";
import { api, hasToken, loadToken } from "./api";
import { stopListening, stopSpeaking } from "./jarvis/voice";
import { liveShareState, startLiveShare, stopLiveShare } from "./liveShare";

/**
 * Help mode: when Dhruvi doesn't feel safe. A loud siren, flashing torch + screen
 * (drawn by the /help screen), and her live location emailed to Anubhav through
 * the D-Tracker server (/api/sos), retried until it gets through.
 *
 * Lives at module level so it keeps running whichever screen is showing.
 */

export type HelpSource = "button" | "jarvis" | "shortcut";

export interface Fix {
  lat: number;
  lng: number;
  accuracy?: number;
  at: number;
}

export interface HelpState {
  phase: "idle" | "countdown" | "active";
  source: HelpSource;
  reason?: string;
  /** Countdown end (ms) while phase is "countdown". */
  deadline?: number;
  startedAt?: number;
  siren: boolean;
  lights: boolean;
  fix?: Fix;
  locationError?: string;
  /** The last alert that reached Anubhav. */
  sent?: { at: number; address?: string; mapsUrl?: string };
  /** Shown while an alert is still trying to get through. */
  sending: boolean;
  sendError?: string;
}

export const COUNTDOWN_S = 5;

const idle: HelpState = { phase: "idle", source: "button", siren: true, lights: true, sending: false };
let help: HelpState = idle;
const listeners = new Set<() => void>();
const get = () => help;
function set(patch: Partial<HelpState>) {
  help = { ...help, ...patch };
  listeners.forEach((l) => l());
}
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
export const useHelp = () => useSyncExternalStore(subscribe, get, get);
export const helpState = get;

/* ---------------- Starting & stopping ---------------- */

/** Increases on every start/stop so stale async work from an earlier session stops itself. */
let session = 0;
let countdownTimer: ReturnType<typeof setTimeout> | null = null;

/** Jarvis asks first: a short countdown she can cancel, in case he misheard. */
export function armHelp(reason?: string) {
  if (help.phase !== "idle") return;
  const deadline = Date.now() + COUNTDOWN_S * 1000;
  set({ ...idle, phase: "countdown", source: "jarvis", reason, deadline });
  countdownTimer = setTimeout(() => startHelp("jarvis", reason), COUNTDOWN_S * 1000);
}

export function cancelCountdown() {
  if (countdownTimer) clearTimeout(countdownTimer);
  countdownTimer = null;
  if (help.phase === "countdown") set(idle);
}

export function startHelp(source: HelpSource, reason?: string) {
  if (countdownTimer) clearTimeout(countdownTimer);
  countdownTimer = null;
  if (help.phase === "active") return;
  const id = ++session;
  const startedAt = Date.now();
  set({ ...idle, phase: "active", source, reason, startedAt });

  stopSpeaking();
  stopListening();
  void activateKeepAwakeAsync("help").catch(() => {});
  startSiren();
  void shareLocation(id);
  // Also share live (Anubhav's admin page), unless she's already sharing.
  if (liveShareState().status === "idle") void startLiveShare({ reason: "sos" }).catch(() => {});
}

/** She's safe: everything off, and Anubhav is told. */
export function stopHelp() {
  if (countdownTimer) clearTimeout(countdownTimer);
  countdownTimer = null;
  if (help.phase !== "active") return set(idle);
  session++;
  const { fix, source, reason, startedAt } = help;
  stopSiren();
  watcher?.remove();
  watcher = null;
  deactivateKeepAwake("help").catch(() => {});
  set(idle);
  void deliver({ event: "safe", source, reason, startedAt, fix }, () => true);
  if (liveShareState().share?.reason === "sos") void stopLiveShare();
}

export function setSiren(on: boolean) {
  if (help.phase !== "active") return;
  set({ siren: on });
  if (on) startSiren();
  else stopSiren();
}

export function setLights(on: boolean) {
  if (help.phase === "active") set({ lights: on });
}

/* ---------------- Siren (+ vibration) ---------------- */

let player: AudioPlayer | null = null;

function startSiren() {
  // Play even on silent and don't share the speaker with music.
  void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "doNotMix" })
    .catch(() => {})
    .then(() => {
      if (help.phase !== "active" || !help.siren) return;
      try {
        player ??= createAudioPlayer(require("../../assets/siren.wav"));
        player.loop = true;
        player.volume = 1;
        player.play();
      } catch {
        /* the lights and the alert to Anubhav still work */
      }
    });
  Vibration.vibrate([0, 600, 400], true);
}

function stopSiren() {
  Vibration.cancel();
  try {
    player?.pause();
    player?.remove();
  } catch {
    /* already gone */
  }
  player = null;
  void setAudioModeAsync({ shouldPlayInBackground: false }).catch(() => {});
}

/* ---------------- Location → Anubhav ---------------- */

let watcher: Location.LocationSubscription | null = null;

const toFix = (p: Location.LocationObject): Fix => ({
  lat: Number(p.coords.latitude.toFixed(6)),
  lng: Number(p.coords.longitude.toFixed(6)),
  accuracy: p.coords.accuracy ?? undefined,
  at: p.timestamp,
});

/** Metres between two fixes. */
function distance(a: Fix, b: Fix) {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function shareLocation(id: number) {
  const alive = () => id === session && help.phase === "active";
  const { source, reason, startedAt } = help;

  let granted = false;
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    granted = perm.granted;
  } catch {
    granted = false;
  }

  if (!granted) {
    set({ locationError: "Location is turned off for Jarvis" });
    // Still tell him straight away, just without a map.
    void deliver({ event: "start", source, reason, startedAt, locationError: "location permission denied" }, alive);
    return;
  }

  // A recent fix goes out instantly; otherwise wait a few seconds for a fresh one.
  let first: Fix | undefined;
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
    if (last) first = toFix(last);
    else {
      const p = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>((r) => setTimeout(() => r(null), 8000)),
      ]);
      if (p) first = toFix(p);
    }
  } catch {
    /* sent without a map; the watcher below follows up */
  }
  if (!alive()) return;

  let lastSent: Fix | undefined = first;
  let lastSentAt = Date.now();
  set({ fix: first, locationError: first ? undefined : "Finding your location…" });
  void deliver(
    { event: "start", source, reason, startedAt, fix: first, locationError: first ? undefined : "no GPS fix yet" },
    alive,
  );

  try {
    watcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 15_000, distanceInterval: 20 },
      (p) => {
        if (!alive()) return;
        const fix = toFix(p);
        set({ fix, locationError: undefined });
        const since = Date.now() - lastSentAt;
        const moved = lastSent ? distance(lastSent, fix) : Infinity;
        const sharper = lastSent?.accuracy && fix.accuracy && lastSent.accuracy > 150 && fix.accuracy < 50;
        // First fix, a real move, or a much better fix than the one he has.
        if (!lastSent || (moved >= 75 && since >= 90_000) || (sharper && since >= 20_000)) {
          lastSent = fix;
          lastSentAt = Date.now();
          void deliver({ event: "update", source, reason, startedAt, fix }, alive);
        }
      },
    );
    // Help mode may have ended while the watcher was starting.
    if (!alive()) {
      watcher.remove();
      watcher = null;
    }
  } catch {
    /* the first alert already went out */
  }
}

interface Alert {
  event: "start" | "update" | "safe";
  source: HelpSource;
  reason?: string;
  startedAt?: number;
  fix?: Fix;
  locationError?: string;
}

/** Sends one alert, retrying through bad signal until it lands (or no longer matters). */
async function deliver(a: Alert, stillWanted: () => boolean) {
  let battery: number | undefined;
  try {
    const level = await Battery.getBatteryLevelAsync();
    if (level >= 0) battery = level;
  } catch {
    /* optional */
  }
  const body = JSON.stringify({
    event: a.event,
    source: a.source,
    reason: a.reason,
    startedAt: a.startedAt ? new Date(a.startedAt).toISOString() : undefined,
    location: a.fix ? { lat: a.fix.lat, lng: a.fix.lng, accuracy: a.fix.accuracy } : undefined,
    locationError: a.locationError,
    battery,
  });

  // Opened cold from the lock screen, the token may not be loaded yet.
  if (!hasToken()) await loadToken();

  const showing = () => a.event !== "safe" && stillWanted();
  for (let attempt = 0; attempt < 12; attempt++) {
    if (attempt > 0 && !stillWanted()) return;
    if (showing()) set({ sending: true });
    try {
      const res = await api("/api/sos", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { error?: string; address?: string; mapsUrl?: string };
      if (res.ok) {
        if (showing()) set({ sending: false, sendError: undefined, sent: { at: Date.now(), address: json.address, mapsUrl: json.mapsUrl } });
        return;
      }
      if (showing()) set({ sendError: json.error ?? `Server error ${res.status}` });
      // Email not set up / bad request / signed out: retrying won't help.
      if (res.status === 503 || res.status === 400 || res.status === 401 || res.status === 403) break;
    } catch {
      if (showing()) set({ sendError: "No internet. Still trying…" });
    }
    await new Promise((r) => setTimeout(r, Math.min(30_000, 3000 * 2 ** attempt)));
  }
  if (showing()) set({ sending: false });
}
