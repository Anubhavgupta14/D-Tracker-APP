import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View, type ViewInstance } from "react-native";
import { buzz, burst, reducedMotion } from "@/lib/fx";
import { C, useTheme } from "@/lib/theme";
import { HotWaterBag } from "../illustrations";
import { Btn, Card, Eyebrow, T } from "../ui";

const FILL_SECONDS = 2.6;
const COZY_MINUTES = 20;

const LINES = [
  "Press & hold to fill it up",
  "Filling with warm water…",
  "Getting toasty…",
  "Almost there, hold on!",
  "Cozy level: MAXIMUM",
];

/** One wisp of the CSS `.steam` loop (2.4s, staggered 0.8s). */
function Steam({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion()) return;
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(Animated.timing(v, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true })),
    ]);
    anim.start();
    return () => anim.stop();
  }, [v, delay]);
  return (
    <Animated.View
      style={{
        opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.7, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, -26] }) },
          { scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) },
        ],
      }}
    >
      <T size={24} color={C.peach}>
        〰
      </T>
    </Animated.View>
  );
}

export function HotBag() {
  const theme = useTheme();
  const bag = useRef<ViewInstance>(null);
  const w = useRef(new Animated.Value(0)).current;
  const wNow = useRef(0);
  const fill = useRef<Animated.CompositeAnimation | null>(null);
  const scale = useRef(new Animated.Value(1)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const [warmth, setWarmth] = useState(0);
  const [ready, setReady] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The SVG needs the number, so mirror the animated value into state.
  useEffect(() => {
    const id = w.addListener(({ value }) => {
      wNow.current = value;
      setWarmth(value);
    });
    // Stop any running fill if the sheet closes mid-hold.
    return () => {
      w.removeListener(id);
      fill.current?.stop();
    };
  }, [w]);

  const start = () => {
    if (ready) return;
    buzz(8);
    fill.current?.stop();
    fill.current = Animated.timing(w, {
      toValue: 1,
      duration: FILL_SECONDS * 1000 * (1 - wNow.current),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    fill.current.start(({ finished }) => {
      if (!finished) return;
      setReady(true);
      buzz([20, 60, 30]);
      burst(bag, ["♨️", "💗", "✨", "🔥"], 16);
      scale.setValue(0.9);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 18 }).start();
    });
    Animated.timing(scale, { toValue: 1.04, duration: 200, useNativeDriver: true }).start();
  };

  const stop = () => {
    if (ready) return;
    fill.current?.stop();
    fill.current = Animated.timing(w, {
      toValue: 0,
      duration: wNow.current * 1200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: false,
    });
    fill.current.start();
    Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  // The CSS `.float` bob once it's warm.
  useEffect(() => {
    if (!ready || reducedMotion()) {
      bob.setValue(0);
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1800, easing: ease, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1800, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ready, bob]);

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const remaining = endsAt ? Math.max(0, endsAt - now) : 0;
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
  const line = ready ? LINES[4] : LINES[Math.min(3, Math.ceil(warmth * 3))];

  const refill = () => {
    fill.current?.stop();
    w.setValue(0);
    wNow.current = 0;
    setWarmth(0);
    setReady(false);
    setEndsAt(null);
  };

  return (
    <View style={{ alignItems: "center", paddingBottom: 16 }}>
      <View style={{ marginTop: 8 }}>
        {ready && (
          <View pointerEvents="none" style={styles.steamRow}>
            <Steam delay={0} />
            <Steam delay={800} />
            <Steam delay={1600} />
          </View>
        )}
        <Pressable
          onPressIn={start}
          onPressOut={stop}
          accessibilityRole="button"
          accessibilityLabel="Press and hold to warm up the hot water bag"
        >
          <Animated.View
            ref={bag}
            collapsable={false}
            style={{
              transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }, { scale }],
            }}
          >
            <HotWaterBag warmth={warmth} size={190} />
          </Animated.View>
        </Pressable>
      </View>

      <View style={styles.track}>
        <View style={{ width: `${warmth * 100}%`, height: "100%", borderRadius: 999, overflow: "hidden" }}>
          <LinearGradient
            colors={[C.sun, C.peach, C.berry]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>
      <T v="display" size={20} center style={{ marginTop: 12 }}>
        {line}
      </T>

      {ready ? (
        <View style={{ marginTop: 16, width: "100%", gap: 12 }}>
          <Card pad={16}>
            <T weight={600}>Place it on your lower tummy or lower back.</T>
            <T size={14} soft style={{ marginTop: 4 }}>
              Wrap it in a towel, never straight on skin. 15–20 minutes is perfect. (You know this. I just like saying it.)
            </T>
          </Card>
          {endsAt ? (
            <Card pad={20} style={{ alignItems: "center" }}>
              <Eyebrow>Cozy timer</Eyebrow>
              <T v="display" size={48} color={theme.accent} style={{ fontVariant: ["tabular-nums"] }}>
                {remaining > 0 ? `${mm}:${ss}` : "Done! 🎉"}
              </T>
              <T size={14} soft center style={{ marginTop: 4 }}>
                {remaining > 0 ? "No getting up. That's an order." : "Time for a refill, or a nap."}
              </T>
            </Card>
          ) : (
            <Btn onPress={() => setEndsAt(Date.now() + COZY_MINUTES * 60_000)}>{`⏱️ Start ${COZY_MINUTES}-min cozy timer`}</Btn>
          )}
          <Btn kind="ghost" onPress={refill}>
            Empty & refill
          </Btn>
        </View>
      ) : (
        <T size={14} soft center style={{ marginTop: 4 }}>
          Keep your finger on the bag. Please don't microwave the phone.
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  steamRow: {
    position: "absolute",
    top: -24,
    left: 0,
    right: 0,
    zIndex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  track: {
    marginTop: 16,
    height: 12,
    width: 224,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: C.line,
  },
});
