import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { buzz } from "@/lib/fx";

/**
 * Press-and-hold to confirm (so a pocket tap can't start or stop Help mode).
 * A fill sweeps across while held; letting go early resets it.
 */
export function HoldButton({
  duration,
  onDone,
  color,
  fill,
  style,
  accessibilityLabel,
  children,
}: {
  duration: number;
  onDone: () => void;
  color: string;
  fill: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  children: (state: { holding: boolean; hint: boolean }) => ReactNode;
}) {
  const [p] = useState(() => new Animated.Value(0));
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const begin = () => {
    buzz(15);
    setHolding(true);
    setHint(false);
    Animated.timing(p, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (!finished) return;
      buzz([40, 60, 40]);
      setHolding(false);
      p.setValue(0);
      onDone();
    });
  };

  const end = () => {
    if (!holding) return;
    p.stopAnimation();
    setHolding(false);
    Animated.timing(p, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    setHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), 2200);
  };

  return (
    <Pressable
      onPressIn={begin}
      onPressOut={end}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={`Press and hold for ${Math.round(duration / 100) / 10} seconds`}
      style={[styles.base, { backgroundColor: color }, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: fill, width: p.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
        ]}
      />
      <View style={styles.content}>{children({ holding, hint })}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { overflow: "hidden", borderRadius: 999 },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
