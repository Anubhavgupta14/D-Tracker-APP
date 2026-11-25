import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { api, hasToken, loadToken } from "./api";

/**
 * Push registration.
 *
 * Two honest purposes, both visible to the person holding the phone:
 *   1. Health check — the server can send a push and read the receipt. An
 *      Expo `DeviceNotRegistered` receipt means the app was uninstalled. (The
 *      server does this; see docs/ADMIN_SERVER.md.)
 *   2. A high-priority *data* push is how a location request reaches the phone
 *      (see remoteLocate.ts). When that request runs, the phone starts the
 *      normal foreground-service share, so she always sees the location
 *      notification — nothing happens silently.
 *
 * We register an Expo push token and hand it to the D-Tracker server, which
 * keeps it next to her account in Supabase.
 */

function projectId(): string | undefined {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } })?.easConfig?.projectId
  );
}

/** Ask for notification permission and return the Expo push token, or null. */
export async function getPushToken(): Promise<string | null> {
  try {
    // Android needs a channel before the OS will hand out a token or show the prompt.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Jarvis",
        importance: AndroidImportance.DEFAULT,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;

    const id = projectId();
    if (!id) return null;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return data ?? null;
  } catch {
    return null;
  }
}

let lastSent: string | null = null;

/**
 * Register for push and upload the token to the server. Safe to call on every
 * launch; it only POSTs when the token changed or hasn't been sent this run.
 * Needs a signed-in session (the token is stored against her account).
 */
export async function registerPush(): Promise<void> {
  try {
    if (!hasToken()) await loadToken();
    if (!hasToken()) return; // not signed in yet

    const token = await getPushToken();
    if (!token || token === lastSent) return;

    const res = await api("/api/push/register", {
      method: "POST",
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    if (res.ok) lastSent = token;
  } catch {
    /* offline or server down: try again next launch */
  }
}
