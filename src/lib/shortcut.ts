import { NativeModule, requireOptionalNativeModule } from "expo";
import { PermissionsAndroid, Platform } from "react-native";

/**
 * The power-button SOS shortcut (native code in modules/sos-shortcut).
 * Only in the installed app: Expo Go doesn't have it, so everything here
 * degrades to "not available" instead of crashing.
 */

export interface ShortcutStatus {
  notifications: boolean;
  overlay: boolean;
  fullScreen: boolean;
  battery: boolean;
}

export type ShortcutSetting = keyof ShortcutStatus | "accessibility" | "appInfo";

export interface VolumeStatus {
  /** The Accessibility service is switched on in Android settings. */
  accessibility: boolean;
  /** Not paused in the app. */
  on: boolean;
}

declare class SosShortcutModule extends NativeModule<{ onTrigger: () => void }> {
  isEnabled(): boolean;
  isRunning(): boolean;
  getPresses(): number;
  enable(presses: number): void;
  disable(): void;
  consumePending(): boolean;
  status(): ShortcutStatus;
  openSettings(which: ShortcutSetting): void;
  setShowOnLockScreen(on: boolean): void;
  volumeStatus(): VolumeStatus;
  setVolumeOn(on: boolean): void;
}

const mod = Platform.OS === "android" ? requireOptionalNativeModule<SosShortcutModule>("SosShortcut") : null;

export const shortcutAvailable = () => mod !== null;

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const shortcut = {
  isEnabled: () => safe(() => mod?.isEnabled() ?? false, false),
  isRunning: () => safe(() => mod?.isRunning() ?? false, false),
  presses: () => safe(() => mod?.getPresses() ?? 4, 4),
  status: (): ShortcutStatus | null => safe(() => mod?.status() ?? null, null),
  openSettings: (which: ShortcutSetting) => safe(() => mod?.openSettings(which), undefined),

  async enable(presses: number) {
    if (!mod) return false;
    // Android 13+: the "shortcut is on" notification (and the SOS banner) need this.
    if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
      try {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      } catch {
        /* the service still runs without it */
      }
    }
    return safe(() => {
      mod.enable(presses);
      return true;
    }, false);
  },

  disable: () => safe(() => mod?.disable(), undefined),

  volumeStatus: (): VolumeStatus | null => safe(() => mod?.volumeStatus() ?? null, null),
  setVolumeOn: (on: boolean) => safe(() => mod?.setVolumeOn(on), undefined),

  /** True once if the app was just opened by the shortcut. */
  consumePending: () => safe(() => mod?.consumePending() ?? false, false),

  setShowOnLockScreen: (on: boolean) => safe(() => mod?.setShowOnLockScreen(on), undefined),

  /** Fires when the shortcut is pressed while the app is running (even in the background). */
  onTrigger(cb: () => void) {
    if (!mod) return () => {};
    const sub = mod.addListener("onTrigger", cb);
    return () => sub.remove();
  },
};
