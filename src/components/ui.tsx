import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { reducedMotion } from "@/lib/fx";
import { C, FONT, RADIUS, SHADOW, useTheme } from "@/lib/theme";
import { MinusIcon, PlusIcon } from "./icons";

/* ============================================================
   Comfort tools (shared by Today, Care and Jarvis)
   ============================================================ */

export type ToolId = "chocolate" | "hotbag" | "call" | "stretch" | "game";

export const TOOLS: Record<ToolId, { emoji: string; title: string; sub: string; tint: string }> = {
  chocolate: { emoji: "🍫", title: "Chocolate box", sub: "Unwrap a surprise", tint: "#f6e2d6" },
  hotbag: { emoji: "♨️", title: "Hot water bag", sub: "Hold to warm up", tint: "#ffe2d8" },
  call: { emoji: "📞", title: "Call him", sub: "On call 24/7", tint: "#ffdbe6" },
  stretch: { emoji: "🧘‍♀️", title: "Physio Rx", sub: "Stretches for cramps", tint: "#d4f4e8" },
  game: { emoji: "👾", title: "Cramp Crusher", sub: "Squish the cramps", tint: "#ebe3ff" },
};

/* ============================================================
   Text
   ============================================================ */

type Variant = "body" | "display" | "eyebrow" | "hand";

export interface TProps extends TextProps {
  /** body (DM Sans), display (Fredoka), eyebrow (small caps label), hand (Caveat). */
  v?: Variant;
  size?: number;
  /** 400 | 500 | 600 | 700 — mapped to the loaded font files. */
  weight?: 400 | 500 | 600 | 700;
  color?: string;
  soft?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}

function fontFor(v: Variant, weight?: number) {
  if (v === "display") return weight === 700 ? FONT.displayBold : weight === 500 ? FONT.displayMedium : FONT.display;
  if (v === "hand") return FONT.hand;
  if (v === "eyebrow") return FONT.bodyBold;
  switch (weight) {
    case 500:
      return FONT.bodyMedium;
    case 600:
      return FONT.bodySemi;
    case 700:
      return FONT.bodyBold;
    default:
      return FONT.body;
  }
}

/** The one Text component: picks the right font file, colour and dark-mode ink. */
export function T({ v = "body", size, weight, color, soft, center, style, ...rest }: TProps) {
  const theme = useTheme();
  const ink = theme.dark ? (soft ? C.hudInkSoft : C.hudInk) : soft ? C.inkSoft : C.ink;
  const base: TextStyle =
    v === "eyebrow"
      ? { fontSize: size ?? 11.5, letterSpacing: 1.4, textTransform: "uppercase", color: color ?? (theme.dark ? C.hudInkSoft : C.inkSoft) }
      : { fontSize: size ?? (v === "display" ? 20 : v === "hand" ? 22 : 15), color: color ?? ink };
  return (
    <Text
      {...rest}
      style={[{ fontFamily: fontFor(v, weight) }, base, center && { textAlign: "center" }, style]}
    />
  );
}

/* ============================================================
   Surfaces
   ============================================================ */

export function Card({
  children,
  style,
  pad = 20,
  tint,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  pad?: number;
  /** Background colour instead of white. */
  tint?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { padding: pad, backgroundColor: tint ?? (theme.dark ? C.hudCard : C.card) },
        theme.dark && { borderColor: C.hudLine, shadowOpacity: 0, elevation: 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Pressable that shrinks a little when pressed (the web's `:active { scale(.96) }`). */
export function Press({
  style,
  scaleTo = 0.96,
  children,
  ...rest
}: Omit<PressableProps, "style" | "children"> & { style?: StyleProp<ViewStyle>; scaleTo?: number; children?: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: v === 1 ? 10 : 0 }).start();
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        to(scaleTo);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, rest.disabled && { opacity: 0.6 }]}>{children}</Animated.View>
    </Pressable>
  );
}

/* ============================================================
   Buttons and chips
   ============================================================ */

export function Btn({
  children,
  onPress,
  kind = "primary",
  disabled,
  style,
  textStyle,
  icon,
  small,
  accessibilityLabel,
}: {
  children?: ReactNode;
  onPress?: () => void;
  kind?: "primary" | "soft" | "ghost";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: ReactNode;
  small?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const bg = kind === "primary" ? theme.accent : kind === "soft" ? theme.accentSoft : C.card;
  const fg = kind === "primary" ? "#fff" : kind === "soft" ? theme.accentInk : C.ink;
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.btn,
        small && { paddingVertical: 9, paddingHorizontal: 16 },
        { backgroundColor: bg },
        kind === "ghost" && { borderWidth: 1.5, borderColor: C.line },
        kind === "primary" && { shadowColor: theme.accent, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
        style,
      ]}
    >
      {icon}
      {typeof children === "string" || typeof children === "number" ? (
        <T v="display" size={small ? 14 : 16} color={fg} style={textStyle}>
          {children}
        </T>
      ) : (
        children
      )}
    </Press>
  );
}

export function Chip({
  children,
  pressed,
  onPress,
  style,
  disabled,
}: {
  children: ReactNode;
  pressed?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!pressed }}
      style={[
        styles.chip,
        pressed
          ? { backgroundColor: theme.accentSoft, borderColor: theme.accent, borderWidth: 2 }
          : { backgroundColor: C.card, borderColor: C.line, borderWidth: 1.5 },
        style,
      ]}
    >
      {typeof children === "string" ? (
        <T weight={600} size={14} color={pressed ? theme.accentInk : C.ink}>
          {children}
        </T>
      ) : (
        children
      )}
    </Press>
  );
}

export function Eyebrow({ children, style, color }: { children: ReactNode; style?: StyleProp<TextStyle>; color?: string }) {
  return (
    <T v="eyebrow" style={style} color={color}>
      {children}
    </T>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <T v="display" size={20}>
        {children}
      </T>
      {action}
    </View>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  unit,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  unit: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Press
        style={styles.round}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        accessibilityLabel={`Fewer ${unit}`}
      >
        <MinusIcon size={20} />
      </Press>
      <View style={{ minWidth: 88, flexDirection: "row", alignItems: "baseline", justifyContent: "center" }}>
        <T v="display" size={36} color={theme.accent}>
          {value}
        </T>
        <T weight={600} size={14} soft style={{ marginLeft: 4 }}>
          {unit}
        </T>
      </View>
      <Press
        style={styles.round}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        accessibilityLabel={`More ${unit}`}
      >
        <PlusIcon size={20} />
      </Press>
    </View>
  );
}

/* ============================================================
   Inputs
   ============================================================ */

export function Field({ style, big, ...rest }: TextInputProps & { big?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={C.inkSoft}
      {...rest}
      style={[styles.field, big && { fontFamily: FONT.display, fontSize: 18, paddingVertical: 14, borderWidth: 2 }, style]}
    />
  );
}

/**
 * A horizontal slider (the web's <input type="range">). `gradient` paints the
 * track (used by the NPRS pain scale).
 */
export function Slider({
  value,
  min = 0,
  max = 10,
  step = 1,
  onChange,
  gradient,
  trackColor = C.line,
  accessibilityLabel,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  gradient?: string[];
  trackColor?: string;
  accessibilityLabel?: string;
}) {
  const [width, setWidth] = useState(0);
  const THUMB = 34;
  const geom = useRef({ width: 0, x0: 0, min, max, step, onChange });
  geom.current = { ...geom.current, width, min, max, step, onChange };
  const lastValue = useRef(value);
  lastValue.current = value;

  const valueAt = (x: number) => {
    const g = geom.current;
    const usable = Math.max(1, g.width - THUMB);
    const t = Math.max(0, Math.min(1, (x - THUMB / 2) / usable));
    const raw = g.min + t * (g.max - g.min);
    return Math.round(raw / g.step) * g.step;
  };
  const emit = (x: number) => {
    const v = valueAt(x);
    if (v !== lastValue.current) geom.current.onChange(v);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        geom.current.x0 = e.nativeEvent.locationX;
        emit(e.nativeEvent.locationX);
      },
      onPanResponderMove: (_, g) => emit(geom.current.x0 + g.dx),
    }),
  ).current;

  const t = (value - min) / Math.max(1, max - min);
  const left = t * Math.max(0, width - THUMB);

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "increment") onChange(Math.min(max, value + step));
        if (e.nativeEvent.actionName === "decrement") onChange(Math.max(min, value - step));
      }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: 40, justifyContent: "center" }}
      {...pan.panHandlers}
    >
      <View pointerEvents="none" style={{ height: 14, borderRadius: 999, overflow: "hidden", backgroundColor: trackColor }}>
        {gradient && (
          <LinearGradient colors={gradient as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        )}
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left, width: THUMB, height: THUMB }]} />
    </View>
  );
}

/* ============================================================
   Motion helpers (CSS .float / .pop-in / GSAP .reveal)
   ============================================================ */

/** Gentle up-and-down idle bob. */
export function Float({ children, style, amount = 6, duration = 3600 }: { children: ReactNode; style?: StyleProp<ViewStyle>; amount?: number; duration?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return (
    <Animated.View style={[style, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -amount] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** One-shot entrance: slides up and fades in. `delay` staggers a list (the GSAP `.reveal`). */
export function Reveal({ children, delay = 0, style, from = 24 }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle>; from?: number }) {
  const v = useRef(new Animated.Value(reducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Springy pop entrance (the CSS `.pop-in`). */
export function PopIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(reducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, delay, useNativeDriver: true, speed: 14, bounciness: 12 }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: "clamp" }),
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Imperative "shake" for wrong answers (the GSAP elastic x-shake). */
export function useShake() {
  const x = useRef(new Animated.Value(0)).current;
  const shake = () => {
    x.setValue(-10);
    Animated.spring(x, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 18 }).start();
  };
  return { style: { transform: [{ translateX: x }] }, shake };
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    ...SHADOW.card,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS.pill,
    paddingVertical: 13,
    paddingHorizontal: 21,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: RADIUS.pill,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  sectionTitle: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.line,
  },
  field: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.line,
    color: C.ink,
    fontFamily: FONT.body,
    fontSize: 15,
  },
  thumb: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: C.ink,
    ...SHADOW.pop,
  },
});
