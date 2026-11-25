import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { AppState } from "react-native";
import { api, hasToken, loadToken } from "./api";
import { PEOPLE } from "./config";
import { startLiveShare } from "./liveShare";

/**
 * On-demand location request.
 *
 * The admin (a parent) asks for a location from the D-Tracker admin panel. The
 * server sends a high-priority *data* push to this phone. We DO NOT read
 * location silently: we start the ordinary foreground-service share, which puts
 * a persistent "requested your location" notification on her screen for as long
 * as it runs. She always sees it.
 *
 * It is best-effort by design. If the phone is off, offline, in Doze, or the app
 * was force-stopped, the push may not wake it — then the request simply waits and
 * runs the next time the app is opened (see checkForLocationRequest). There is no
 * way here to pull a location she can't see; that is deliberate.
 */

const BACKGROUND_TASK = "jarvis-locate-request";

/** How long the requested share runs — long enough for a few accurate fixes. */
const REQUEST_MINUTES = 3;

/** Foreground pushes should still show, so a request is never invisible. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface RequestData {
  type?: string;
  requestId?: string;
}

/** Start the visible share and tell the server the request was picked up. */
async function fulfil(requestId?: string) {
  try {
    if (!hasToken()) await loadToken();
    if (!hasToken()) return;

    // Make sure she sees it even if the foreground service is slow to come up.
    // await Notifications.scheduleNotificationAsync({
    //   content: {
    //     title: `📍 ${PEOPLE.him} requested your location`,
    //     body: "Jarvis is sharing where you are.",
    //   },
    //   trigger: null,
    // }).catch(() => null);

    await startLiveShare({ reason: "request", minutes: REQUEST_MINUTES });

    if (requestId) {
      await api("/api/location", {
        method: "POST",
        body: JSON.stringify({ action: "ack-request", requestId }),
      }).catch(() => null);
    }
  } catch {
    /* left pending on the server; picked up next time the app opens */
  }
}

/* Runs when a data push arrives, including with the app backgrounded. */
TaskManager.defineTask<Notifications.NotificationTaskPayload>(BACKGROUND_TASK, async ({ data, error }) => {
  if (error || !data) return;
  // Only headless (data-only) pushes carry a request; ignore taps on normal ones.
  if ("actionIdentifier" in data) return;
  let payload: RequestData = {};
  try {
    payload = JSON.parse((data as { dataString?: string }).dataString ?? "{}") as RequestData;
  } catch {
    return;
  }
  if (payload.type === "locate") await fulfil(payload.requestId);
});

try {
  void Notifications.registerTaskAsync(BACKGROUND_TASK);
} catch {
  /* registered on next launch */
}

/**
 * Fallback for when the push couldn't wake the app: ask the server whether a
 * request is waiting, and fulfil it. Called on launch and when the app comes to
 * the foreground.
 */
export async function checkForLocationRequest() {
  try {
    if (!hasToken()) await loadToken();
    if (!hasToken()) return;
    const res = await api("/api/location?pending=1");
    if (!res.ok) return;
    const json = (await res.json().catch(() => ({}))) as { request?: { id?: string } };
    if (json.request) await fulfil(json.request.id);
  } catch {
    /* offline: try again next time */
  }
}

let wired = false;
/** Wire up the foreground-resume check (call once, from the app root). */
export function startLocationRequestWatch() {
  if (wired) return;
  wired = true;
  void checkForLocationRequest();
  AppState.addEventListener("change", (s) => {
    if (s === "active") void checkForLocationRequest();
  });
}
