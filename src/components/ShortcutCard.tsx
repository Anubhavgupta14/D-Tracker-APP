import { useEffect, useState } from "react";
import { AppState, PermissionsAndroid, Platform, StyleSheet, View } from "react-native";
import { shortcut, shortcutAvailable, type ShortcutSetting, type ShortcutStatus } from "@/lib/shortcut";
import { C } from "@/lib/theme";
import { Btn, Card, Chip, T } from "./ui";

const CHECKS: { key: ShortcutSetting; title: string; why: string }[] = [
  { key: "fullScreen", title: "Full-screen alerts", why: "Opens Help mode over the lock screen" },
  { key: "overlay", title: "Display over other apps", why: "Opens Help mode while you're in another app" },
  { key: "battery", title: "Battery: unrestricted", why: "Stops Android from switching the shortcut off" },
  { key: "notifications", title: "Notifications", why: "Shows that the shortcut is ready" },
];

/** Power-button SOS shortcut settings (Comfort Corner, under the Help card). */
export function ShortcutCard() {
  const available = shortcutAvailable();
  const [on, setOn] = useState(() => shortcut.isEnabled());
  const [presses, setPresses] = useState(() => shortcut.presses());
  const [status, setStatus] = useState<ShortcutStatus | null>(() => shortcut.status());

  // Coming back from a Settings page: show what changed.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      setStatus(shortcut.status());
      setOn(shortcut.isEnabled());
    });
    return () => sub.remove();
  }, []);

  if (!available) {
    return (
      <Card pad={18}>
        <T weight={700} size={15}>
          ⚡ Power-button SOS
        </T>
        <T size={13} soft style={{ marginTop: 4 }}>
          Press the power button a few times to start Help mode without opening the app. This works in the installed
          app, not in Expo Go.
        </T>
      </Card>
    );
  }

  const turnOn = async (n = presses) => {
    if (await shortcut.enable(n)) setOn(true);
    setStatus(shortcut.status());
  };

  const turnOff = () => {
    shortcut.disable();
    setOn(false);
  };

  const pick = (n: number) => {
    setPresses(n);
    if (on) void turnOn(n);
  };

  const fix = async (key: ShortcutSetting) => {
    if (key === "notifications" && Platform.OS === "android" && Number(Platform.Version) >= 33) {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => null);
      if (r === PermissionsAndroid.RESULTS.GRANTED) return setStatus(shortcut.status());
    }
    shortcut.openSettings(key);
  };

  const missing = on && status ? CHECKS.filter((c) => !status[c.key]) : [];

  return (
    <Card pad={18}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <T size={26}>⚡</T>
        <View style={{ flex: 1 }}>
          <T weight={700} size={15}>
            Power-button SOS
          </T>
          <T size={13} soft>
            {on
              ? `On: press the power button ${presses} times quickly, even with the phone locked.`
              : "Start Help mode without opening the app."}
          </T>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 14, alignItems: "center" }}>
        <T size={13} weight={600} soft>
          Presses:
        </T>
        {[3, 4, 5].map((n) => (
          <Chip key={n} pressed={presses === n} onPress={() => pick(n)}>
            {`${n}×`}
          </Chip>
        ))}
      </View>
      {presses === 5 ? (
        <T size={12} soft style={{ marginTop: 6 }}>
          {"On many phones 5 presses also starts Android's own Emergency SOS (which calls 112)."}
        </T>
      ) : null}

      {missing.length > 0 && (
        <View style={{ gap: 8, marginTop: 14 }}>
          <T size={13} weight={700} color={C.berry}>
            {"Allow these so it works when you're not in the app:"}
          </T>
          {missing.map((c) => (
            <View key={c.key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <T size={14} weight={700}>
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

      {on ? (
        <Btn kind="ghost" style={{ marginTop: 12 }} onPress={turnOff}>
          Turn off
        </Btn>
      ) : (
        <Btn style={{ marginTop: 14 }} onPress={() => void turnOn()}>
          Turn on
        </Btn>
      )}
      {on && missing.length === 0 ? (
        <T size={12} soft center style={{ marginTop: 6 }}>
          {`Try it: lock the phone and press power ${presses}× quickly. Hold "I'm safe" to stop.`}
        </T>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: C.bg },
});
