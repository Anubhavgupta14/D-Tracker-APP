import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View, type ViewInstance } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { PHASES, type CycleInfo } from "@/lib/cycle";
import { buzz, burst, reducedMotion } from "@/lib/fx";
import { C as COLORS, useTheme } from "@/lib/theme";
import { Eyebrow, T } from "./ui";

const SIZE = 300;
const C = SIZE / 2;
const R = 122;
const STROKE = 24;
const CIRC = 2 * Math.PI * R;
const GAP = 5;
/** Extra room around the viewBox so the landmarks/marker can poke out (web: overflow-visible). */
const PAD = 30;

/** Where on the ring (in degrees, 0 = top) a cycle day sits. */
const angleFor = (day: number, len: number) => ((day - 0.5) / len) * 360;

function polar(deg: number, r = R) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}

/* GSAP eases, used by the entrance timeline below. */
const power3 = (t: number) => 1 - Math.pow(1 - t, 3);
const expo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
/** Local progress (0..1) of a tween that starts at `start` s and lasts `dur` s, at `now` s. */
const prog = (now: number, start: number, dur: number) => Math.max(0, Math.min(1, (now - start) / dur));

/** Whole entrance timeline length in seconds (segments stagger, marker, center, counter). */
const timelineEnd = (segs: number) => Math.max((segs - 1) * 0.12 + 0.9, 0.25 + 1.3, 0.3 + 3 * 0.08 + 0.6, 0.3 + 1.2);

export function CycleRing({ info }: { info: CycleInfo }) {
  const theme = useTheme();
  const root = useRef<ViewInstance>(null);
  const scale = useRef(new Animated.Value(1)).current;

  const len = info.cycleLength;
  const markerDay = Math.min(info.day, len);
  const target = angleFor(markerDay, len);
  const ovDay = len - 14;
  const end = timelineEnd(info.segments.length);

  // The GSAP timeline, replayed with a frame clock: one number (seconds) drives
  // the segment draw-in, the marker swinging round, the centre text and the counter.
  const [now, setNow] = useState(() => (reducedMotion() ? end : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setNow(end);
      return;
    }
    setNow(0);
    let raf = 0;
    const t0 = Date.now();
    const tick = () => {
      const s = (Date.now() - t0) / 1000;
      setNow(Math.min(s, end));
      if (s < end) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [info.cycleStart, info.day, len, end]);

  const markerRot = target * expo(prog(now, 0.25, 1.3));
  const shownDay = Math.round(1 + (info.day - 1) * expo(prog(now, 0.3, 1.2)));
  const centerStyle = (i: number) => {
    const p = power3(prog(now, 0.3 + i * 0.08, 0.6));
    return { opacity: p, transform: [{ translateY: 12 * (1 - p) }] };
  };

  const onTap = () => {
    buzz(15);
    burst(root, [info.phase.emoji, "💗", "✨"], 12);
    // elastic.out(1, 0.4)
    scale.setValue(0.96);
    Animated.spring(scale, { toValue: 1, friction: 3, tension: 60, useNativeDriver: true }).start();
  };

  const subline = info.onPeriod
    ? `Day ${info.periodDay} of your period`
    : info.daysUntilNext > 0
      ? `Period in ${info.daysUntilNext} day${info.daysUntilNext === 1 ? "" : "s"}`
      : info.daysUntilNext === 0
        ? "Period expected today"
        : `${-info.daysUntilNext} day${info.daysUntilNext === -1 ? "" : "s"} late`;

  const ovPos = polar(angleFor(ovDay, len), R + 30);
  const startPos = polar(angleFor(1, len), R + 30);
  const pct = (v: number) => `${(v / SIZE) * 100}%` as const;
  const padPct = `${-(PAD / SIZE) * 100}%` as const;
  const fullPct = `${((SIZE + 2 * PAD) / SIZE) * 100}%` as const;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }]}>
      <View ref={root} collapsable={false} style={StyleSheet.absoluteFill}>
        <Svg
          viewBox={`${-PAD} ${-PAD} ${SIZE + 2 * PAD} ${SIZE + 2 * PAD}`}
          style={{ position: "absolute", left: padPct, top: padPct, width: fullPct, height: fullPct }}
        >
          {/* track */}
          <Circle cx={C} cy={C} r={R} fill="none" stroke={COLORS.line} strokeWidth={STROKE} opacity={0.7} />
          <G transform={`rotate(-90 ${C} ${C})`}>
            {info.segments.map((s, i) => {
              const from = ((s.from - 1) / len) * CIRC;
              const length = Math.max(0, ((s.to - s.from + 1) / len) * CIRC - GAP);
              const drawn = length * power3(prog(now, i * 0.12, 0.9));
              return (
                <Circle
                  key={s.phase}
                  cx={C}
                  cy={C}
                  r={R}
                  fill="none"
                  stroke={PHASES[s.phase].color}
                  strokeWidth={STROKE}
                  strokeDasharray={[drawn, CIRC]}
                  strokeDashoffset={-from - GAP / 2}
                  opacity={s.phase === info.phase.id || (info.phase.id === "ovulation" && s.phase === "fertile") ? 1 : 0.5}
                />
              );
            })}
          </G>
          {/* today marker */}
          <G transform={`rotate(${markerRot} ${C} ${C})`}>
            <Circle cx={C} cy={C - R} r={STROKE / 2 + 7} fill="white" stroke={COLORS.ink} strokeWidth={4} />
            <Circle cx={C} cy={C - R} r={5} fill={theme.accent} />
          </G>
        </Svg>

        {/* little landmarks outside the ring (RN Text renders emoji more reliably than SVG text on Android) */}
        <View pointerEvents="none" style={[styles.landmark, { left: pct(startPos.x), top: pct(startPos.y) }]}>
          <T size={18}>🌙</T>
        </View>
        <View pointerEvents="none" style={[styles.landmark, { left: pct(ovPos.x), top: pct(ovPos.y) }]}>
          <T size={18}>🌟</T>
        </View>

        <Pressable
          onPress={onTap}
          accessibilityRole="button"
          accessibilityLabel="Tap for a little sparkle"
          style={styles.center}
        >
          <Animated.View style={centerStyle(0)}>
            <Eyebrow>Cycle day</Eyebrow>
          </Animated.View>
          <Animated.View style={centerStyle(1)}>
            <T v="display" size={64} color={theme.accent} style={styles.dayNum}>
              {shownDay}
            </T>
          </Animated.View>
          <Animated.View style={[{ marginTop: 4 }, centerStyle(2)]}>
            <T v="display" size={15} center>
              {info.phase.emoji} {info.phase.name}
            </T>
          </Animated.View>
          <Animated.View style={[{ marginTop: 2 }, centerStyle(3)]}>
            <T size={12} weight={500} soft center>
              {subline}
            </T>
          </Animated.View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 320,
    aspectRatio: 1,
    alignSelf: "center",
  },
  landmark: {
    position: "absolute",
    width: 30,
    height: 30,
    marginLeft: -15,
    marginTop: -15,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    top: "22%",
    left: "22%",
    right: "22%",
    bottom: "22%",
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#782846",
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 20 },
    elevation: 10,
  },
  dayNum: {
    lineHeight: 68,
    letterSpacing: -1.6,
    includeFontPadding: false,
  },
});
