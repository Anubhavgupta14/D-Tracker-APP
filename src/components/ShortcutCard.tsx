import { useEffect, useState } from "react";
import { AppState, PermissionsAndroid, Platform, StyleSheet, View } from "react-native";
import {
  shortcut,
  shortcutAvailable,
  type ShortcutSetting,
  type ShortcutStatus,
  type VolumeStatus,
} from "@/lib/shortcut";
import { C } from "@/lib/theme";
import { Btn, Card, Chip, T } from "./ui";

/** What the power-button shortcut needs to open Help mode from outside the app. */
const POWER_CHECKS: { key: keyof ShortcutStatus; title: string; why: string }[] = [
  { key: "fullScreen", title: "Full-screen alerts", why: "Opens Help mode over the lock screen" },
  { key: "overlay", title: "Display over other apps", why: "Opens Help mode while you're in another app" },
  { key: "battery", title: "Battery: unrestricted", why: "Stops Android from switching the shortcut off" },
  { key: "notifications", title: "Notifications", why: "Shows that the shortcut is ready" },
];

/** Start Help mode without opening the app (Comfort Corner, under the Help card). */
export function ShortcutCard() {
  const available = shortcutAvailable();
  const [volume, setVolume] = useState<VolumeStatus | null>(() => shortcut.volumeStatus());
  const [powerOn, setPowerOn] = useState(() => shortcut.isEnabled());
  const [presses, setPresses] = useState(() => shortcut.presses());
  const [status, setStatus] = useState<ShortcutStatus | null>(() => shortcut.status());

  // Coming back from a Settings page: show what changed.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      setVolume(shortcut.volumeStatus());
      setStatus(shortcut.status());
      setPowerOn(shortcut.isEnabled());
    });
    return () => sub.remove();
  }, []);

  if (!available) {
    return (
      <Card pad={18}>
        <T weight={700} size={15}>
          ⚡ SOS shortcuts
        </T>
        <T size={13} soft style={{ marginTop: 4 }}>
          Hold both volume buttons to start Help mode without opening the app. This works in the installed app, not in
          Expo Go.
        </T>
      </Card>
    );
  }

  const setVolumeOn = (on: boolean) => {
    shortcut.setVolumeOn(on);
    setVolume(shortcut.volumeStatus());
  };

  const powerEnable = async (n = presses) => {
    if (await shortcut.enable(n)) setPowerOn(true);
    setStatus(shortcut.status());
  };

  const powerDisable = () => {
    shortcut.disable();
    setPowerOn(false);
  };

  const pick = (n: number) => {
    setPresses(n);
    if (powerOn) void powerEnable(n);
  };

  const fix = async (key: ShortcutSetting) => {
    if (key === "notifications" && Platform.OS === "android" && Number(Platform.Version) >= 33) {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => null);
      if (r === PermissionsAndroid.RESULTS.GRANTED) return setStatus(shortcut.status());
    }
    shortcut.openSettings(key);
  };

  const volumeReady = Boolean(volume?.accessibility);
  const missing = powerOn && status ? POWER_CHECKS.filter((c) => !status[c.key]) : [];

  return (
    <Card pad={18}>
      <T weight={700} size={15}>
        ⚡ SOS without opening the app
      </T>

      {/* Volume up + down (recommended) */}
      <View style={styles.section}>
        <View style={styles.row}>
          <T size={24}>🔊</T>
          <View style={{ flex: 1 }}>
            <T weight={700} size={14}>
              Hold volume up + volume down
            </T>
            <T size={12} soft>
              Both together for 1.5 seconds. Works in any app and on the lock screen.
            </T>
          </View>
          <T size={12} weight={700} color={volumeReady && volume?.on ? C.mint : C.inkSoft}>
            {volumeReady ? (volume?.on ? "✓ On" : "Paused") : "Off"}
          </T>
        </View>

        {!volumeReady ? (
          <>
            <T size={13} style={{ marginTop: 10, lineHeight: 19 }}>
              {"Turn it on once: Accessibility → Installed apps (or Downloaded apps) → Jarvis SOS → On."}
            </T>
            <Btn small style={{ marginTop: 10 }} onPress={() => shortcut.openSettings("accessibility")}>
              Open Accessibility settings
            </Btn>
            <T size={12} soft style={{ marginTop: 10, lineHeight: 17 }}>
              {
                'Greyed out or "Restricted setting"? Open App info → ⋮ (top right) → "Allow restricted settings", then try again.'
              }
            </T>
            <Btn small kind="ghost" style={{ marginTop: 4 }} onPress={() => shortcut.openSettings("appInfo")}>
              Open App info
            </Btn>
          </>
        ) : volume?.on ? (
          <Btn small kind="ghost" style={{ marginTop: 8 }} onPress={() => setVolumeOn(false)}>
            Pause
          </Btn>
        ) : (
          <Btn small style={{ marginTop: 8 }} onPress={() => setVolumeOn(true)}>
            Turn on
          </Btn>
        )}
      </View>

      {/* Power button (optional) */}
      <View style={[styles.section, styles.divider]}>
        <View style={styles.row}>
          <T size={24}>🔘</T>
          <View style={{ flex: 1 }}>
            <T weight={700} size={14}>
              Press the power button {presses}×
            </T>
            <T size={12} soft>
              Works with the screen off too.
            </T>
          </View>
          <T size={12} weight={700} color={powerOn ? C.mint : C.inkSoft}>
            {powerOn ? "✓ On" : "Off"}
          </T>
        </View>
        <T size={12} color={C.berry} style={{ marginTop: 8, lineHeight: 17 }}>
          {"Your phone's own SOS also uses the power button, so pressing it also starts that (it can call 112). Only turn this on if you've switched the phone's one off."}
        </T>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" }}>
          {[4, 5].map((n) => (
            <Chip key={n} pressed={presses === n} onPress={() => pick(n)}>
              {`${n}×`}
            </Chip>
          ))}
        </View>

        {missing.length > 0 && (
          <View style={{ gap: 8, marginTop: 12 }}>
            {missing.map((c) => (
              <View key={c.key} style={styles.check}>
                <View style={{ flex: 1 }}>
                  <T size={13} weight={700}>
                    {c.title}
                  </T>
                  <T size={12} soft>
                    {c.why}
                  </T>
                </View>
                <Btn small kind="soft" onPress={() => void fix(c.key)}>
                  Allow
                </Btn>
              </View>
            ))}
          </View>
        )}

        {powerOn ? (
          <Btn small kind="ghost" style={{ marginTop: 8 }} onPress={powerDisable}>
            Turn off
          </Btn>
        ) : (
          <Btn small kind="soft" style={{ marginTop: 10 }} onPress={() => void powerEnable()}>
            Turn on
          </Btn>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 14 },
  divider: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  check: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: C.bg },
});
