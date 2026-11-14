import { CameraView, useCameraPermissions } from "expo-camera";
import * as SMS from "expo-sms";
import { useEffect, useState } from "react";
import { BackHandler, Linking, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HoldButton } from "./HoldButton";
import { T } from "./ui";
import { e164, telLink } from "@/lib/cheer";
import { buzz } from "@/lib/fx";
import {
  cancelCountdown,
  setLights,
  setSiren,
  startHelp,
  stopHelp,
  useHelp,
  type Fix,
  type HelpState,
} from "@/lib/help";
import { useAppState } from "@/lib/store";

const RED = "#d7263d";
const DEEP = "#3a0610";
const WHITE = "#ffffff";

/**
 * Full-screen Help mode: the countdown (when Jarvis starts it) and the active alarm.
 * Used by the /help route, and directly by the root layout when the power-button
 * shortcut opens the app before it has finished loading.
 */
export function HelpPanel() {
  const h = useHelp();
  const insets = useSafeAreaInsets();

  // Back cancels a countdown, but can't switch off an active alarm (that needs the hold).
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (h.phase === "countdown") cancelCountdown();
      return h.phase !== "idle";
    });
    return () => sub.remove();
  }, [h.phase]);

  if (h.phase === "countdown") return <Countdown h={h} top={insets.top} />;
  if (h.phase === "active") return <Active h={h} top={insets.top} bottom={insets.bottom} />;
  return <View style={[styles.fill, { backgroundColor: DEEP }]} />;
}

/* ---------------- Countdown ---------------- */

function Countdown({ h, top }: { h: HelpState; top: number }) {
  const left = useSecondsLeft(h.deadline);
  useEffect(() => {
    buzz(60);
  }, [left]);

  return (
    <View style={[styles.fill, styles.center, { backgroundColor: DEEP, paddingTop: top + 24 }]}>
      <T size={13} weight={700} color="#ffb3c0" style={styles.caps}>
        Jarvis is starting Help mode
      </T>
      <T v="display" size={120} color={WHITE} style={{ lineHeight: 140, marginVertical: 8 }}>
        {left}
      </T>
      {h.reason ? (
        <T size={15} color="#ffd6dd" center style={{ marginBottom: 8 }}>
          “{h.reason}”
        </T>
      ) : null}
      <T size={15} color="#ffd6dd" center style={{ maxWidth: 300 }}>
        Siren and lights will start, and your location will go to him.
      </T>
      <View style={{ width: "100%", gap: 12, marginTop: 36 }}>
        <BigButton label="Start now" color={RED} onPress={() => startHelp("jarvis", h.reason)} />
        <BigButton label="Cancel, I'm okay" color="rgba(255,255,255,0.14)" onPress={cancelCountdown} />
      </View>
    </View>
  );
}

const secondsUntil = (deadline?: number) => Math.max(0, Math.ceil(((deadline ?? 0) - Date.now()) / 1000));

function useSecondsLeft(deadline?: number) {
  const [left, setLeft] = useState(() => secondsUntil(deadline));
  useEffect(() => {
    const t = setInterval(() => setLeft(secondsUntil(deadline)), 200);
    return () => clearInterval(t);
  }, [deadline]);
  return left;
}

/* ---------------- Active alarm ---------------- */

function Active({ h, top, bottom }: { h: HelpState; top: number; bottom: number }) {
  const { settings } = useAppState();
  const him = settings.partnerName;
  const phone = settings.partnerPhone;
  const hasPhone = phone.replace(/\D/g, "").length >= 8;

  // Screen strobe, slow enough to stay under 3 flashes a second.
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!h.lights) return;
    const t = setInterval(() => setFlash((f) => !f), 450);
    return () => clearInterval(t);
  }, [h.lights]);

  const message = sosText(h.fix);

  return (
    <View style={[styles.fill, { backgroundColor: h.lights && flash ? WHITE : RED }]}>
      <Torch on={h.lights} />
      <View style={[styles.panel, { marginTop: top + 16, marginBottom: bottom + 16 }]}>
        <T size={12} weight={700} color="#ff8fa3" style={styles.caps}>
          Help mode is on
        </T>
        <T v="display" size={28} color={WHITE} style={{ marginTop: 4, lineHeight: 34 }}>
          {him} is being alerted
        </T>

        <Status h={h} him={him} />

        <View style={{ gap: 10, marginTop: 18 }}>
          <BigButton label="🚓 Call 112 (Police / Emergency)" color="#1d4ed8" onPress={() => void Linking.openURL("tel:112").catch(() => {})} />
        </View>

        {hasPhone && (
          <View style={{ gap: 10, marginTop: 10 }}>
            <BigButton label={`📞 Call ${him}`} color={RED} onPress={() => void Linking.openURL(telLink(phone)).catch(() => {})} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <BigButton
                small
                label="💬 Text him"
                color="rgba(255,255,255,0.14)"
                onPress={() => void textHim(phone, message)}
              />
              <BigButton
                small
                label="WhatsApp"
                color="#1f9d55"
                onPress={() =>
                  void Linking.openURL(`https://wa.me/${e164(phone).slice(1)}?text=${encodeURIComponent(message)}`).catch(() => {})
                }
              />
            </View>
          </View>
        )}

        <View style={styles.toggles}>
          <Toggle on={h.siren} label={h.siren ? "🔊 Siren on" : "🔇 Siren off"} onPress={() => setSiren(!h.siren)} />
          <Toggle on={h.lights} label={h.lights ? "🔦 Lights on" : "🌑 Lights off"} onPress={() => setLights(!h.lights)} />
        </View>
        <T size={12} color="#ffb3c0" center style={{ marginTop: 6 }}>
          Need to be quiet? Turn both off. Your location keeps going to {him}.
        </T>

        <View style={{ flex: 1 }} />

        <HoldButton
          duration={2500}
          onDone={stopHelp}
          color="rgba(255,255,255,0.92)"
          fill="#9be7c4"
          style={{ paddingVertical: 16 }}
          accessibilityLabel={`I'm safe. Turns Help mode off and tells ${him}`}
        >
          {({ holding, hint }) => (
            <T size={16} weight={700} color={DEEP}>
              {holding ? "Keep holding…" : hint ? "Hold for 2 seconds" : "Hold: I'm safe now"}
            </T>
          )}
        </HoldButton>
      </View>
    </View>
  );
}

function Status({ h, him }: { h: HelpState; him: string }) {
  const sentLine = h.sent
    ? `✓ Location sent to ${him} at ${new Date(h.sent.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
    : h.sending
      ? `Sending your location to ${him}…`
      : h.sendError
        ? `Couldn't reach ${him}: ${h.sendError}`
        : `Getting your location…`;
  const where =
    h.sent?.address?.split(",").slice(0, 3).join(",") ??
    (h.fix ? `Accurate to about ${Math.round(h.fix.accuracy ?? 0)} m` : h.locationError);

  return (
    <View style={styles.status}>
      <T size={15} weight={700} color={h.sendError && !h.sent ? "#ffd166" : WHITE}>
        {sentLine}
      </T>
      {where ? (
        <T size={13} color="#ffd6dd" style={{ marginTop: 4 }}>
          📍 {where}
        </T>
      ) : null}
      {h.sent && h.sendError ? (
        <T size={12} color="#ffd166" style={{ marginTop: 4 }}>
          Latest update is still trying: {h.sendError}
        </T>
      ) : null}
      {h.locationError && !h.fix && /off/.test(h.locationError) ? (
        <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button">
          <T size={13} weight={700} color="#ffd166" style={{ marginTop: 6, textDecorationLine: "underline" }}>
            Turn on location for Jarvis
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------------- Torch: SOS in Morse ---------------- */

const DOT = 250;
const DASH = 750;
// [lit, ms] for · · · — — — · · · then a pause.
const SOS: [boolean, number][] = [
  ...[DOT, DOT, DOT].flatMap((d, i) => [[true, d], [false, i === 2 ? DASH : DOT]] as [boolean, number][]),
  ...[DASH, DASH, DASH].flatMap((d, i) => [[true, d], [false, i === 2 ? DASH : DOT]] as [boolean, number][]),
  ...[DOT, DOT, DOT].flatMap((d, i) => [[true, d], [false, i === 2 ? 1750 : DOT]] as [boolean, number][]),
];

/**
 * The flashlight is only reachable through the camera, so a tiny invisible camera
 * view drives it. Unmounting it (lights off) releases the camera.
 */
function Torch({ on }: { on: boolean }) {
  const [perm, request] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    if (on && perm && !perm.granted && perm.canAskAgain) void request();
  }, [on, perm, request]);

  useEffect(() => {
    if (!on || !ready) return;
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      const [l, ms] = SOS[i++ % SOS.length];
      setLit(l);
      t = setTimeout(step, ms);
    };
    step();
    return () => {
      clearTimeout(t);
      setLit(false);
    };
  }, [on, ready]);

  if (!on || !perm?.granted) return null;
  return (
    <CameraView
      style={styles.camera}
      facing="back"
      enableTorch={lit}
      animateShutter={false}
      onCameraReady={() => setReady(true)}
      onMountError={() => setReady(false)}
    />
  );
}

/* ---------------- Bits ---------------- */

function sosText(fix?: Fix) {
  return fix
    ? `🚨 I don't feel safe. I'm here: https://www.google.com/maps?q=${fix.lat},${fix.lng}`
    : "🚨 I don't feel safe. Please call me now.";
}

async function textHim(phone: string, message: string) {
  try {
    if (await SMS.isAvailableAsync()) {
      await SMS.sendSMSAsync([e164(phone)], message);
      return;
    }
  } catch {
    /* fall through to the sms: link */
  }
  void Linking.openURL(`sms:${e164(phone)}?body=${encodeURIComponent(message)}`).catch(() => {});
}

function BigButton({ label, color, onPress, small }: { label: string; color: string; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        buzz(10);
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.big,
        small && { flex: 1, paddingVertical: 13 },
        { backgroundColor: color, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      <T size={small ? 15 : 17} weight={700} color={WHITE}>
        {label}
      </T>
    </Pressable>
  );
}

function Toggle({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        buzz(8);
        onPress();
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={[styles.toggle, { backgroundColor: on ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.25)" }]}
    >
      <T size={14} weight={700} color={WHITE}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", paddingHorizontal: 24 },
  caps: { letterSpacing: 1.6, textTransform: "uppercase" },
  panel: {
    flex: 1,
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 28,
    backgroundColor: "rgba(40,4,12,0.88)",
  },
  status: { marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)" },
  big: { borderRadius: 999, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  toggles: { flexDirection: "row", gap: 10, marginTop: 18 },
  toggle: { flex: 1, borderRadius: 999, paddingVertical: 11, alignItems: "center" },
  camera: { position: "absolute", top: 0, left: 0, width: 1, height: 1, opacity: 0 },
});
