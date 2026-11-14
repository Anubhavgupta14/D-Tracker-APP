import * as Battery from "expo-battery";
import { File, Paths } from "expo-file-system";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useSyncExternalStore } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { api, hasToken, loadToken } from "./api";
import { PEOPLE } from "./config";

/**
 * Live location: she shares for a set time (or Help mode does). Android runs it as
 * a foreground service with a notification, so it keeps going with the screen off.
 * Points go to the D-Tracker server (Supabase) in batches; Anubhav sees them on /admin.
 */

const TASK = "jarvis-live-location";
const EVERY_MS = 30_000;

export type ShareReason = "share" | "sos";

export interface ActiveShare {
  id: string;
  endsAt: number;
  reason: ShareReason;
}

export interface LiveState {
  status: "idle" | "starting" | "sharing";
  share?: ActiveShare;
  lastSentAt?: number;
  error?: string;
}

/* ---------------- State ---------------- */

let live: LiveState = { status: "idle" };
const listeners = new Set<() => void>();
const get = () => live;
function set(next: LiveState) {
  live = next;
  listeners.forEach((l) => l());
}
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
export const useLiveShare = () => useSyncExternalStore(subscribe, get, get);
export const liveShareState = get;

/* The share is also kept in a file: the background task may run without the app's memory. */
const file = () => new File(Paths.document, "live-share.json");

function readSaved(): ActiveShare | null {
  try {
    const f = file();
    if (!f.exists) return null;
    const s = JSON.parse(f.textSync()) as ActiveShare;
    return s && typeof s.id === "string" && typeof s.endsAt === "number" ? s : null;
  } catch {
    return null;
  }
}

function save(share: ActiveShare | null) {
  try {
    const f = file();
    if (!share) {
      if (f.exists) f.delete();
      return;
    }
    if (!f.exists) f.create();
    f.write(JSON.stringify(share));
  } catch {
    /* memory still has it */
  }
}

const current = (): ActiveShare | null => live.share ?? readSaved();

/* ---------------- Sending points ---------------- */

interface Pt {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  battery?: number;
  at: number;
}

let queue: Pt[] = [];
let flushing = false;

async function batteryLevel() {
  try {
    const b = await Battery.getBatteryLevelAsync();
    return b >= 0 ? b : undefined;
  } catch {
    return undefined;
  }
}

async function addFixes(locations: Location.LocationObject[]) {
  const battery = await batteryLevel();
  for (const l of locations) {
    queue.push({
      lat: Number(l.coords.latitude.toFixed(6)),
      lng: Number(l.coords.longitude.toFixed(6)),
      accuracy: l.coords.accuracy ?? undefined,
      speed: l.coords.speed !== null && l.coords.speed >= 0 ? l.coords.speed : undefined,
      battery,
      at: l.timestamp,
    });
  }
  // Offline for a long time: keep the newest points only.
  if (queue.length > 2000) queue = queue.slice(-2000);
}

async function flush(share: ActiveShare) {
  if (flushing || !queue.length) return;
  flushing = true;
  const batch = queue.slice(0, 200);
  try {
    if (!hasToken()) await loadToken();
    const res = await api("/api/location", {
      method: "POST",
      body: JSON.stringify({ action: "points", shareId: share.id, points: batch }),
    });
    if (res.ok) {
      queue = queue.slice(batch.length);
      if (live.share?.id === share.id) set({ ...live, lastSentAt: Date.now(), error: undefined });
    } else if (res.status === 410 || res.status === 404) {
      // Ended on the server (time's up, or deleted): stop here too.
      queue = [];
      await endLocally();
    }
  } catch {
    /* no signal: kept in the queue for the next fix */
  } finally {
    flushing = false;
  }
}

/* Runs for every batch of fixes, also with the app in the background. */
TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  if (error) return;
  const share = current();
  if (!share || Date.now() > share.endsAt) {
    await endLocally();
    return;
  }
  if (!live.share) set({ status: "sharing", share });
  await addFixes(data?.locations ?? []);
  await flush(share);
});

/* ---------------- Starting & stopping ---------------- */

async function startUpdates(share: ActiveShare) {
  const until = new Date(share.endsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: EVERY_MS,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: share.reason === "sos" ? "🚨 Help mode is sharing your location" : `📍 Sharing your location with ${PEOPLE.him}`,
      notificationBody: share.reason === "sos" ? "Until you say you're safe." : `Until ${until}. Open Jarvis to stop.`,
      notificationColor: "#e5487a",
      killServiceOnDestroy: false,
    },
  });
}

async function updatesRunning() {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TASK);
  } catch {
    return false;
  }
}

/** Starts sharing for `minutes` (Help mode: until she's safe, max 12 h). Throws a readable error. */
export async function startLiveShare(opts: { minutes?: number; reason?: ShareReason } = {}) {
  const reason = opts.reason ?? "share";
  if (live.status !== "idle" && reason === "share") await stopLiveShare();
  set({ status: "starting", share: live.share });

  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) throw new Error("Location is turned off for Jarvis. Turn it on in Settings.");

    if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
      // The "sharing" notification; sharing works without it, she just won't see it.
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => null);
    }

    if (!hasToken()) await loadToken();
    const res = await api("/api/location", {
      method: "POST",
      body: JSON.stringify({ action: "start", minutes: opts.minutes ?? 60, reason }),
    });
    const json = (await res.json().catch(() => ({}))) as { share?: { id: string; ends_at: string }; error?: string };
    if (!res.ok || !json.share) throw new Error(json.error ?? `Couldn't start sharing (${res.status}).`);

    const share: ActiveShare = { id: json.share.id, endsAt: Date.parse(json.share.ends_at), reason };
    save(share);
    queue = [];
    set({ status: "sharing", share });

    // Something on the map straight away.
    const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 }).catch(() => null);
    if (last) {
      await addFixes([last]);
      void flush(share);
    }

    try {
      await startUpdates(share);
    } catch {
      // Android only starts it while the app is open (e.g. Help mode fired from the lock screen):
      // it starts as soon as she opens the app (see resume below).
    }
    return share;
  } catch (e) {
    set({ status: "idle", error: (e as Error).message });
    throw e;
  }
}

/** Stops sharing (and tells the server, so the admin page shows it ended). */
export async function stopLiveShare() {
  const share = current();
  await endLocally();
  if (!share) return;
  try {
    if (!hasToken()) await loadToken();
    await api("/api/location", { method: "POST", body: JSON.stringify({ action: "stop", shareId: share.id }) });
  } catch {
    /* it also ends on its own at endsAt */
  }
}

async function endLocally() {
  save(null);
  queue = [];
  if (await updatesRunning()) {
    try {
      await Location.stopLocationUpdatesAsync(TASK);
    } catch {
      /* already stopped */
    }
  }
  if (live.status !== "idle") set({ status: "idle" });
}

/** On launch / coming back to the app: pick up a share that's still running. */
async function resume() {
  const share = readSaved();
  if (!share) return;
  if (Date.now() > share.endsAt) return endLocally();
  if (live.status === "idle") set({ status: "sharing", share });
  if (!(await updatesRunning())) {
    try {
      await startUpdates(share);
    } catch {
      /* tried again next time the app comes to the front */
    }
  }
}

void resume();
AppState.addEventListener("change", (s) => {
  if (s === "active") void resume();
});
