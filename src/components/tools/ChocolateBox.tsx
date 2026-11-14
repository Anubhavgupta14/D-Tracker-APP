import * as Location from "expo-location";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View, type ViewInstance } from "react-native";
import { postJSON } from "@/lib/api";
import type { Settings } from "@/lib/cycle";
import { buzz, burst, reducedMotion } from "@/lib/fx";
import { actions } from "@/lib/store";
import { C, useTheme } from "@/lib/theme";
import { GiftBox, Rasgulla } from "../illustrations";
import { Btn, Card, Float, PopIn, Press, T } from "../ui";

/* Real, hardcoded treats. She picks, "claims", and it reaches him for a surprise delivery. */
const ITEMS: { id: string; name: string; emoji?: string; fav?: boolean }[] = [
  { id: "kitkat", name: "KitKat", emoji: "🍫" },
  { id: "silk", name: "Dairy Milk Silk", emoji: "🍫" },
  { id: "dairymilk", name: "Cadbury Dairy Milk", emoji: "🍫" },
  { id: "amuldark", name: "Amul Dark Chocolate", emoji: "🖤" },
  { id: "ferrero", name: "Ferrero Rocher", emoji: "✨" },
  { id: "darkfantasy", name: "Dark Fantasy", emoji: "🍪" },
  { id: "oreo", name: "Oreo", emoji: "🍪" },
  { id: "amulicecream", name: "Amul Ice Cream", emoji: "🍨" },
  { id: "cornetto", name: "Cornetto", emoji: "🍦" },
  { id: "kulfi", name: "Kulfi", emoji: "🍧" },
  { id: "rasgulla", name: "Rasgulla", fav: true },
  { id: "gems", name: "Cadbury Gems", emoji: "🌈" },
];

const LOCATION_TIMEOUT = 20_000;
const TIMED_OUT = "Location request timed out.";

/** Ask the phone for location. Never throws; reports why it failed so the email can say so. */
async function getLocation(): Promise<{ loc: { lat: number; lng: number } | null; error?: string }> {
  const round = (p: Location.LocationObject) => ({
    loc: { lat: Number(p.coords.latitude.toFixed(5)), lng: Number(p.coords.longitude.toFixed(5)) },
  });
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return { loc: null, error: "Location permission was denied." };
    // Same as the web's maximumAge: 5 min — a recent fix is plenty for a delivery.
    const last = await Location.getLastKnownPositionAsync({ maxAge: 300_000 }).catch(() => null);
    if (last) return round(last);
    // Balanced accuracy (Wi-Fi / cell) = the web's enableHighAccuracy: false; same 20s timeout.
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(TIMED_OUT)), LOCATION_TIMEOUT)),
    ]);
    return round(pos);
  } catch (e) {
    return {
      loc: null,
      error:
        (e as Error)?.message === TIMED_OUT
          ? TIMED_OUT
          : "Location unavailable — check the device's location services are on.",
    };
  }
}

/** The CSS `.wiggle` loop. */
function Wiggle({ on, children }: { on: boolean; children: ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on || reducedMotion()) {
      v.setValue(0);
      return;
    }
    const ease = Easing.inOut(Easing.ease);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: -1, duration: 150, easing: ease, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 300, easing: ease, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 150, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [on, v]);
  const rotate = v.interpolate({ inputRange: [-1, 1], outputRange: ["-6deg", "6deg"] });
  return <Animated.View style={{ transform: [{ rotate }] }}>{children}</Animated.View>;
}

type Status = "idle" | "sending" | "done" | "error";

export function ChocolateBox({ settings }: { settings: Settings }) {
  const theme = useTheme();
  const root = useRef<ViewInstance>(null);
  const box = useRef<ViewInstance>(null);
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>("idle");
  const [ordered, setOrdered] = useState<typeof ITEMS>([]);
  const [error, setError] = useState("");

  const shake = useRef(new Animated.Value(0)).current;
  const lid = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const openBox = () => {
    if (opened || opening) return;
    setOpening(true);
    buzz([10, 40, 20]);
    // Rattle (-4° yoyo ×5), then fling the lid up and away.
    const rattle = Array.from({ length: 6 }, (_, i) =>
      Animated.timing(shake, { toValue: i % 2 === 0 ? 1 : 0, duration: 80, easing: Easing.linear, useNativeDriver: true }),
    );
    Animated.sequence([
      ...rattle,
      Animated.timing(lid, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    // GSAP added this at "-=0.4", i.e. 0.2s into the lid fling.
    timer.current = setTimeout(() => {
      burst(box, ["🍫", "✨", "💗", "🍬"], 16);
      setOpened(true);
    }, 480 + 200);
  };

  const toggle = (id: string, at: { x: number; y: number }) => {
    buzz(8);
    const adding = !selected.has(id);
    if (adding) burst(at, ["💗", "✨"], 6);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const claim = async () => {
    if (!selected.size || status === "sending") return;
    setStatus("sending");
    setError("");
    buzz([10, 30, 10]);
    const { loc, error: locError } = await getLocation();
    const picked = ITEMS.filter((i) => selected.has(i.id));
    try {
      await postJSON("/api/claim", {
        items: picked.map((i) => i.name),
        location: loc,
        locationError: loc ? undefined : locError,
      });
      actions.openTreat();
      setOrdered(picked);
      setStatus("done");
      buzz([20, 50, 20, 50, 40]);
      burst(root, ["🍫", "💗", "✨", "🛵"], 20);
    } catch (e) {
      setError((e as Error).message || "Couldn't send the claim.");
      setStatus("error");
    }
  };

  const reset = () => {
    setSelected(new Set());
    setStatus("idle");
    setError("");
  };

  /* ---- Closed box ---- */
  if (!opened) {
    const s = 210 / 180; // svg units → px
    return (
      <View ref={root} collapsable={false} style={{ alignItems: "center", paddingTop: 16, paddingBottom: 24 }}>
        <Press onPress={openBox} accessibilityRole="button" accessibilityLabel="Open the chocolate box">
          <Float>
            <Animated.View
              ref={box}
              collapsable={false}
              style={{ transform: [{ rotate: shake.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-4deg"] }) }] }}
            >
              <GiftBox
                size={210}
                lidStyle={{
                  opacity: lid.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  transform: [
                    { translateX: lid.interpolate({ inputRange: [0, 1], outputRange: [0, 40 * s] }) },
                    { translateY: lid.interpolate({ inputRange: [0, 1], outputRange: [0, -90 * s] }) },
                    { rotate: lid.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "35deg"] }) },
                  ],
                }}
              />
            </Animated.View>
          </Float>
        </Press>
        <T v="display" size={20} center style={{ marginTop: 16 }}>
          A box arrived for you!
        </T>
        <T size={14} soft center style={{ marginTop: 4 }}>
          Sender: {settings.partnerName}. Tap to open.
        </T>
      </View>
    );
  }

  /* ---- Confirmation: an order receipt of the picked treats ---- */
  if (status === "done") {
    return (
      <View ref={root} collapsable={false} style={{ alignItems: "center", paddingVertical: 24 }}>
        <Float>
          <T size={72}>🛵</T>
        </Float>
        <T v="display" size={24} center style={{ marginTop: 16 }}>
          Here is your claim! 💗
        </T>
        <T size={14} soft center style={{ marginTop: 4, maxWidth: 320 }}>
          Here are your treats, {settings.herName}
        </T>

        <View style={{ marginTop: 20, width: "100%", gap: 10 }}>
          {ordered.map((t) => (
            <Card key={t.id} pad={12} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[styles.receiptIcon, { backgroundColor: theme.accentSoft }]}>
                {t.emoji ? <T size={24}>{t.emoji}</T> : <Rasgulla size={30} />}
              </View>
              <T weight={600} style={{ flex: 1 }}>
                {t.name}
                {t.fav && (
                  <T size={11} color={C.berry}>
                    {" "}your favourite 💗
                  </T>
                )}
              </T>
              <T size={12} weight={700} color={C.mint}>
                Ready ✓
              </T>
            </Card>
          ))}
        </View>

        <Btn style={{ marginTop: 24, alignSelf: "stretch" }} onPress={reset}>
          Claim something else
        </Btn>
      </View>
    );
  }

  /* ---- Picker ---- */
  const count = selected.size;
  return (
    <View ref={root} collapsable={false} style={{ paddingBottom: 16 }}>
      <T size={14} soft center style={{ marginBottom: 16 }}>
        Pick what you're craving. As many as you like. 💗
      </T>
      <View style={styles.grid}>
        {ITEMS.map((t, i) => {
          const on = selected.has(t.id);
          return (
            <PopIn key={t.id} delay={i * 40} style={styles.cell}>
              <Press
                onPress={(e) => toggle(t.id, { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t.name}
                style={[
                  styles.treat,
                  on
                    ? { backgroundColor: theme.accentSoft, borderColor: theme.accent }
                    : [styles.treatOff],
                ]}
              >
                {on && (
                  <View style={[styles.tick, { backgroundColor: theme.accent }]}>
                    <T size={14} color="#fff">
                      ✓
                    </T>
                  </View>
                )}
                <Wiggle on={on}>{t.emoji ? <T size={36}>{t.emoji}</T> : <Rasgulla size={46} />}</Wiggle>
                <T size={14} weight={600} center style={{ lineHeight: 17 }}>
                  {t.name}
                </T>
                {t.fav && (
                  <T size={11} color={C.berry}>
                    your favourite 💗
                  </T>
                )}
              </Press>
            </PopIn>
          );
        })}
      </View>

      {!!error && (
        <View style={styles.error}>
          <T size={14} weight={500} color={C.berry} center>
            {error}
          </T>
        </View>
      )}

      <View style={{ marginTop: 24, gap: 10 }}>
        <Btn onPress={claim} disabled={!count || status === "sending"}>
          {status === "sending" ? "Getting…" : count ? `Claim ${count} treat${count > 1 ? "s" : ""} 🛵` : "Pick a treat first"}
        </Btn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { width: "46%", flexGrow: 1 },
  treat: {
    minHeight: 116,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 24,
    padding: 12,
    borderWidth: 2.5,
  },
  treatOff: {
    backgroundColor: C.card,
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#782846",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  tick: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  error: { marginTop: 16, borderRadius: 16, backgroundColor: C.berrySoft, padding: 12 },
});
