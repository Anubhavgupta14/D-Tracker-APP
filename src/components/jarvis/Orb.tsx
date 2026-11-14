import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";
import Svg, { Circle, Defs, G, Line, RadialGradient, Stop } from "react-native-svg";
import { reducedMotion } from "@/lib/fx";
import { level } from "@/lib/jarvis/voice";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

/** `glow` is the web's rgba() split into hex + alpha (SVG gradient stops want them apart). */
const PALETTE: Record<OrbState, { a: string; b: string; glow: string; glowA: number }> = {
  idle: { a: "#8fe9ff", b: "#b49bff", glow: "#8fe9ff", glowA: 0.45 },
  listening: { a: "#ff8fbf", b: "#ff5c93", glow: "#ff6fa5", glowA: 0.6 },
  thinking: { a: "#ffd27a", b: "#ff9f5a", glow: "#ffbe6e", glowA: 0.55 },
  speaking: { a: "#7ff0ff", b: "#4f9dff", glow: "#6edcff", glowA: 0.6 },
};

const SPEED: Record<OrbState, number> = { idle: 1, listening: 1.6, thinking: 5, speaking: 2 };

const TICKS = Array.from({ length: 72 }, (_, i) => {
  const th = (i * 5 * Math.PI) / 180;
  const r1 = 114; // y = 6
  const r2 = i % 6 === 0 ? 104 : 109; // y = 16 / 11
  return {
    i,
    x1: 120 + Math.sin(th) * r1,
    y1: 120 - Math.cos(th) * r1,
    x2: 120 + Math.sin(th) * r2,
    y2: 120 - Math.cos(th) * r2,
  };
});

/**
 * Forever-spinning value (0→1 per lap). Changing `speed` keeps the current angle
 * and just changes the pace, like GSAP's timeScale.
 */
function useSpin(seconds: number, speed: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion()) return;
    let stopped = false;
    let anim: Animated.CompositeAnimation | null = null;
    const lap = (seconds * 1000) / speed;
    v.stopAnimation((cur) => {
      if (stopped) return;
      const from = Math.min(0.999, Math.max(0, cur % 1));
      anim = Animated.timing(v, { toValue: 1, duration: lap * (1 - from), easing: Easing.linear, useNativeDriver: true });
      anim.start(({ finished }) => {
        if (!finished || stopped) return;
        v.setValue(0);
        anim = Animated.loop(Animated.timing(v, { toValue: 1, duration: lap, easing: Easing.linear, useNativeDriver: true }));
        anim.start();
      });
    });
    return () => {
      stopped = true;
      anim?.stop();
    };
  }, [v, seconds, speed]);
  return v;
}

const turn = (v: Animated.Value, dir: 1 | -1) => ({
  transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${dir * 360}deg`] }) }],
});

/** The arc-reactor-ish HUD orb. Rings spin with the state; the core pulses with his voice. */
export function Orb({ state, size = 240, onClick }: { state: OrbState; size?: number; onClick?: () => void }) {
  const speed = SPEED[state];
  const r1 = useSpin(40, speed);
  const r2 = useSpin(26, speed);
  const r3 = useSpin(14, speed);
  const r4 = useSpin(60, speed);
  const orbit = useSpin(1.4, 1);

  // Entrance: scale .6 → 1, fade in (expo.out).
  const enter = useRef(new Animated.Value(reducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 1000, easing: Easing.out(Easing.exp), useNativeDriver: true }).start();
  }, [enter]);

  // Core pulse (JS-driven: speaking reads the voice level every frame).
  const core = useRef(new Animated.Value(1)).current;
  const ripples = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reducedMotion()) return;
    const yoyo = (to: number, ms: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(core, { toValue: to, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(core, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
      );

    if (state === "speaking") {
      core.stopAnimation();
      let s = 1;
      let raf = 0;
      const tick = () => {
        const target = 1 + level() * 0.45;
        s += (target - s) * 0.3; // ~120ms ease toward the level
        core.setValue(s);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(raf);
        Animated.timing(core, { toValue: 1, duration: 400, useNativeDriver: false }).start();
      };
    }

    const anims: Animated.CompositeAnimation[] = [];
    if (state === "listening") {
      ripples.forEach((r, i) => {
        r.setValue(0);
        anims.push(
          Animated.sequence([
            Animated.delay(i * 500),
            Animated.loop(Animated.timing(r, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true })),
          ]),
        );
      });
      anims.push(yoyo(1.08, 600));
    } else if (state === "thinking") {
      anims.push(yoyo(0.9, 450));
    } else {
      anims.push(yoyo(1.04, 2400));
    }
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [state, core, ripples]);

  const p = PALETTE[state];
  const coreSize = size * 0.42;
  const layer = { position: "absolute" as const, width: size, height: size, left: 0, top: 0 };

  return (
    <Pressable
      onPress={onClick}
      accessibilityRole="button"
      accessibilityLabel={state === "listening" ? "Stop listening" : "Talk to Jarvis"}
      style={{ width: size, height: size, alignSelf: "center" }}
    >
      <Animated.View
        style={[
          styles.center,
          { width: size, height: size, opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
        ]}
      >
        {/* Soft glow (the web's blurred disc + the core's outer box-shadow) */}
        <Svg width={size} height={size} viewBox="0 0 240 240" style={layer} pointerEvents="none">
          <Defs>
            <RadialGradient id="orbGlow" cx="120" cy="120" r="110" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={p.glow} stopOpacity={p.glowA} />
              <Stop offset="0.55" stopColor={p.glow} stopOpacity={p.glowA * 0.75} />
              <Stop offset="1" stopColor={p.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="120" cy="120" r="110" fill="url(#orbGlow)" />
        </Svg>

        <Animated.View style={[layer, { opacity: 0.5 }, turn(r4, -1)]} pointerEvents="none">
          <Svg width={size} height={size} viewBox="0 0 240 240">
            <G>
              {TICKS.map((t) => (
                <Line key={t.i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={p.a} strokeWidth={t.i % 6 === 0 ? 2 : 1} />
              ))}
            </G>
          </Svg>
        </Animated.View>
        <Animated.View style={[layer, turn(r1, 1)]} pointerEvents="none">
          <Svg width={size} height={size} viewBox="0 0 240 240">
            <Circle cx="120" cy="120" r="100" fill="none" stroke={p.a} strokeWidth="1.5" strokeDasharray="3 7" opacity="0.7" />
          </Svg>
        </Animated.View>
        <Animated.View style={[layer, turn(r2, -1)]} pointerEvents="none">
          <Svg width={size} height={size} viewBox="0 0 240 240">
            <Circle cx="120" cy="120" r="88" fill="none" stroke={p.b} strokeWidth="3" strokeDasharray="70 18 8 18" strokeLinecap="round" opacity="0.85" />
          </Svg>
        </Animated.View>
        <Animated.View style={[layer, turn(r3, 1)]} pointerEvents="none">
          <Svg width={size} height={size} viewBox="0 0 240 240">
            <Circle cx="120" cy="120" r="76" fill="none" stroke={p.a} strokeWidth="1.5" strokeDasharray="120 40" opacity="0.6" />
          </Svg>
        </Animated.View>

        {state === "thinking" && (
          <Animated.View style={[layer, turn(orbit, 1)]} pointerEvents="none">
            <Svg width={size} height={size} viewBox="0 0 240 240">
              <Circle cx="120" cy="32" r="4" fill={p.a} />
              <Circle cx="120" cy="208" r="3" fill={p.b} />
            </Svg>
          </Animated.View>
        )}

        {state === "listening" &&
          ripples.map((r, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                layer,
                {
                  opacity: r.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
                  transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.35] }) }],
                },
              ]}
            >
              <Svg width={size} height={size} viewBox="0 0 240 240">
                <Circle cx="120" cy="120" r="70" fill="none" stroke={p.a} strokeWidth="2" />
              </Svg>
            </Animated.View>
          ))}

        {/* Core */}
        <Animated.View pointerEvents="none" style={{ width: coreSize, height: coreSize, transform: [{ scale: core }] }}>
          <Svg width={coreSize} height={coreSize} viewBox="0 0 100 100">
            <Defs>
              {/* radial-gradient(circle at 35% 30%, #fff 0%, a 28%, b 70%, transparent 100%) */}
              <RadialGradient id="orbCore" cx="35" cy="30" fx="35" fy="30" r="95.5" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={1} />
                <Stop offset="0.28" stopColor={p.a} stopOpacity={1} />
                <Stop offset="0.7" stopColor={p.b} stopOpacity={1} />
                <Stop offset="1" stopColor={p.b} stopOpacity={0} />
              </RadialGradient>
              {/* inset 0 0 24px rgba(255,255,255,.5) */}
              <RadialGradient id="orbInset" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                <Stop offset="0.6" stopColor="#ffffff" stopOpacity={0} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={0.5} />
              </RadialGradient>
            </Defs>
            <Circle cx="50" cy="50" r="50" fill="url(#orbCore)" />
            <Circle cx="50" cy="50" r="50" fill="url(#orbInset)" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
