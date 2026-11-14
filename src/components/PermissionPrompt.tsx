import { Camera } from "expo-camera";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, StyleSheet, View } from "react-native";
import { useHelp } from "@/lib/help";
import { C } from "@/lib/theme";
import { Sheet } from "./Sheet";
import { Btn, T } from "./ui";

interface Perm {
  granted: boolean;
  canAskAgain: boolean;
}

/**
 * On every launch, if location isn't allowed yet, explain why and ask
 * (plus the flashlight, which Help mode needs). If Android won't show the
 * system prompt any more, send her to Settings instead.
 */
export function PermissionPrompt({ partnerName }: { partnerName: string }) {
  const [loc, setLoc] = useState<Perm | null>(null);
  const [cam, setCam] = useState<Perm | null>(null);
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  // A Modal sits above every screen, so step aside while Help mode is up.
  const helpIdle = useHelp().phase === "idle";

  const check = useCallback(
    () =>
      Promise.all([Location.getForegroundPermissionsAsync(), Camera.getCameraPermissionsAsync()]).then(
        ([l, c]) => {
          setLoc(l);
          setCam(c);
          return l;
        },
        () => null,
      ),
    [],
  );

  // Launch: ask if location isn't allowed.
  useEffect(() => {
    let live = true;
    Promise.all([Location.getForegroundPermissionsAsync(), Camera.getCameraPermissionsAsync()]).then(
      ([l, c]) => {
        if (!live) return;
        setLoc(l);
        setCam(c);
        if (!l.granted) setOpen(true);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);

  // Back from Settings: refresh, and close once location is on.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active" || !open) return;
      void check().then((l) => {
        if (l?.granted) setOpen(false);
      });
    });
    return () => sub.remove();
  }, [check, open]);

  const blocked = (loc && !loc.granted && !loc.canAskAgain) || (cam && !cam.granted && !cam.canAskAgain);

  const allow = async () => {
    setAsking(true);
    try {
      let l = loc;
      if (!l?.granted && l?.canAskAgain !== false) l = await Location.requestForegroundPermissionsAsync();
      let c = cam;
      if (!c?.granted && c?.canAskAgain !== false) c = await Camera.requestCameraPermissionsAsync();
      setLoc(l);
      setCam(c);
      if (l?.granted) setOpen(false);
      else if (l && !l.canAskAgain) void Linking.openSettings();
    } catch {
      /* the rows show what's still off */
    } finally {
      setAsking(false);
    }
  };

  return (
    <Sheet open={open && helpIdle} onClose={() => setOpen(false)} eyebrow="Keeping you safe" title="📍 Turn on location">
      <T size={15} soft style={{ lineHeight: 22 }}>
        {`Jarvis needs your location to find places near you, and so Help mode can send ${partnerName} exactly where you are if you ever don't feel safe.`}
      </T>

      <View style={{ gap: 10, marginTop: 18 }}>
        <Row emoji="📍" title="Location" detail="Jarvis + Help mode" on={loc?.granted} />
        <Row emoji="🔦" title="Flashlight" detail="Flashes SOS in Help mode (uses the camera)" on={cam?.granted} />
      </View>

      {blocked ? (
        <T size={13} soft style={{ marginTop: 14 }}>
          {"Android won't ask again, so turn it on in Settings → Permissions."}
        </T>
      ) : null}

      <Btn style={{ marginTop: 20 }} disabled={asking} onPress={blocked && !loc?.granted ? () => void Linking.openSettings() : allow}>
        {blocked && !loc?.granted ? "Open settings" : asking ? "Asking…" : "Allow"}
      </Btn>
      <Btn kind="ghost" style={{ marginTop: 6 }} onPress={() => setOpen(false)}>
        Not now
      </Btn>
    </Sheet>
  );
}

function Row({ emoji, title, detail, on }: { emoji: string; title: string; detail: string; on?: boolean }) {
  return (
    <View style={styles.row}>
      <T size={24}>{emoji}</T>
      <View style={{ flex: 1 }}>
        <T weight={700} size={15}>
          {title}
        </T>
        <T size={13} soft>
          {detail}
        </T>
      </View>
      <T size={13} weight={700} color={on ? C.mint : C.inkSoft}>
        {on ? "✓ On" : "Off"}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, backgroundColor: C.bg },
});
