import { Caveat_600SemiBold } from "@expo-google-fonts/caveat";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from "@expo-google-fonts/fredoka";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, AppState as RNAppState, StyleSheet, View, type ViewInstance } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Backdrop } from "@/components/Backdrop";
import { HelpPanel } from "@/components/HelpPanel";
import { BurstLayer } from "@/components/Burst";
import { Btn, Card, Field, Float, Reveal, T, useShake } from "@/components/ui";
import { loadToken, saveToken } from "@/lib/api";
import { getCycleInfo } from "@/lib/cycle";
import { buzz, burst } from "@/lib/fx";
import { startHelp, useHelp } from "@/lib/help";
import { hydrateChat } from "@/lib/jarvis/agent";
import "@/lib/liveShare"; // defines the background location task
import { registerPush } from "@/lib/push";
import { startLocationRequestWatch } from "@/lib/remoteLocate"; // defines the data-push task
import { applyUpdateOnLaunch } from "@/lib/updates";
import { hydrate, useAppState, useToday } from "@/lib/store";
import { shortcut } from "@/lib/shortcut";
import { loadSnapshot, setOnLocked, unlock, useSyncStatus } from "@/lib/sync";
import { C, DarkContext, ThemeContext, themeFor } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync();

type Phase = { kind: "loading" } | { kind: "locked" } | { kind: "error"; message: string } | { kind: "ready" };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Caveat_600SemiBold,
  });

  const state = useAppState();
  const today = useToday();
  const phaseId = getCycleInfo(state, today)?.phase.id ?? "period";
  const [dark, setDark] = useState(false);
  const theme = themeFor(phaseId, dark);

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const helpPhase = useHelp().phase;

  // Power-button SOS shortcut: start Help mode at once, before anything else loads.
  useEffect(() => {
    const fire = () => {
      shortcut.consumePending();
      startHelp("shortcut");
    };
    if (shortcut.consumePending()) startHelp("shortcut");
    const off = shortcut.onTrigger(fire);
    const sub = RNAppState.addEventListener("change", (s) => {
      if (s === "active" && shortcut.consumePending()) startHelp("shortcut");
    });
    return () => {
      off();
      sub.remove();
    };
  }, []);

  // Over the lock screen only while Help mode is on (her data stays behind the lock otherwise).
  useEffect(() => {
    shortcut.setShowOnLockScreen(helpPhase !== "idle");
  }, [helpPhase]);

  /** Loads her data from Supabase (asking for the passcode first if needed), then shows the app. */
  const boot = useCallback(async () => {
    setPhase({ kind: "loading" });
    const token = await loadToken();
    if (!token) return setPhase({ kind: "locked" });
    const r = await loadSnapshot();
    if (r.kind === "locked") {
      await saveToken(null);
      return setPhase({ kind: "locked" });
    }
    if (r.kind === "error") return setPhase({ kind: "error", message: r.message });
    hydrate(r.data);
    hydrateChat(r.data.messages);
    setPhase({ kind: "ready" });
    // Signed in: register for push (health check + location requests) and pick up
    // any location request that was waiting while the app was closed.
    void registerPush();
    startLocationRequestWatch();
  }, []);

  // Pull any over-the-air update before showing the app.
  useEffect(() => {
    void applyUpdateOnLaunch();
  }, []);

  useEffect(() => {
    void boot();
    setOnLocked(() => {
      void saveToken(null);
      setPhase({ kind: "locked" });
    });
  }, [boot]);

  useEffect(() => {
    if (fontsLoaded && phase.kind !== "loading") void SplashScreen.hideAsync();
  }, [fontsLoaded, phase.kind]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={theme}>
        <DarkContext.Provider value={setDark}>
          <StatusBar style={dark ? "light" : "dark"} />
          <Backdrop />
          {phase.kind !== "ready" && helpPhase !== "idle" ? (
            // Help can't wait for her data (or a network) to load.
            <HelpPanel />
          ) : phase.kind === "ready" ? (
            <>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" }, animation: "fade" }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="help"
                  options={{ presentation: "fullScreenModal", gestureEnabled: false, animation: "slide_from_bottom" }}
                />
              </Stack>
              <SyncPill />
            </>
          ) : (
            <SafeAreaView style={styles.center}>
              {phase.kind === "loading" && (
                <Float>
                  <T size={48}>💗</T>
                </Float>
              )}
              {phase.kind === "locked" && <Lock onUnlocked={boot} />}
              {phase.kind === "error" && (
                <Card style={{ width: "100%", alignItems: "center" }} pad={24}>
                  <T size={36}>🛠️</T>
                  <T v="display" size={20} style={{ marginTop: 12 }}>
                    Couldn't load your data
                  </T>
                  <T size={14} soft center style={{ marginTop: 8 }}>
                    {phase.message}
                  </T>
                  <Btn style={{ marginTop: 20 }} onPress={boot}>
                    Try again
                  </Btn>
                </Card>
              )}
            </SafeAreaView>
          )}
          <BurstLayer />
        </DarkContext.Provider>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}

function Lock({ onUnlocked }: { onUnlocked: () => void }) {
  const card = useRef<ViewInstance>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { style: shakeStyle, shake } = useShake();

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError("");
    const r = await unlock(code.trim());
    setBusy(false);
    if (r.ok) {
      buzz([20, 50, 20]);
      burst(card, ["💗", "✨", "🌙"], 18);
      setTimeout(onUnlocked, 500);
    } else {
      buzz([60, 40, 60]);
      setError(r.error ?? "That's not it.");
      setCode("");
      shake();
    }
  };

  return (
    <Reveal style={{ width: "100%" }}>
      <Animated.View ref={card} collapsable={false} style={shakeStyle}>
        <Card pad={28} style={{ alignItems: "center" }}>
          <Float>
            <T size={48}>🌙</T>
          </Float>
          <T v="display" size={24} style={{ marginTop: 12 }}>
            Hi Doctor
          </T>
          <T size={14} soft center style={{ marginTop: 4 }}>
            Enter the passcode. You only need to do this once on this phone.
          </T>
          <Field
            big
            secureTextEntry
            keyboardType="number-pad"
            autoFocus
            value={code}
            onChangeText={setCode}
            onSubmitEditing={submit}
            accessibilityLabel="Passcode"
            placeholder="••••"
            style={{ marginTop: 20, textAlign: "center", letterSpacing: 8 }}
          />
          {error ? (
            <T weight={600} size={14} color={C.berry} style={{ marginTop: 8 }}>
              {error}
            </T>
          ) : null}
          <Btn onPress={submit} disabled={busy} style={{ marginTop: 20, alignSelf: "stretch" }}>
            {busy ? "Checking…" : "Unlock 💗"}
          </Btn>
        </Card>
      </Animated.View>
    </Reveal>
  );
}

/** A small pill when changes haven't reached the server yet. */
function SyncPill() {
  const status = useSyncStatus();
  if (status !== "offline") return null;
  return (
    <SafeAreaView pointerEvents="none" style={styles.pillWrap} edges={["top"]}>
      <View style={styles.pill}>
        <T weight={600} size={12} color="#fff">
          Offline · will save when you're back
        </T>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  pillWrap: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" },
  pill: { marginTop: 12, borderRadius: 999, backgroundColor: "rgba(46,26,43,0.85)", paddingHorizontal: 16, paddingVertical: 6 },
});
