import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { onBurst, type BurstEvent } from "@/lib/fx";

interface Particle {
  key: string;
  emoji: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rot: number;
  scale: number;
  dur: number;
}

/** Full-screen, touch-through layer that draws emoji bursts fired by `burst()`. */
export function BurstLayer() {
  const [bursts, setBursts] = useState<{ id: number; particles: Particle[] }[]>([]);

  useEffect(
    () =>
      onBurst((e: BurstEvent) => {
        const particles: Particle[] = Array.from({ length: e.count }, (_, i) => {
          const angle = Math.random() * Math.PI * 2;
          const dist = 60 + Math.random() * 110;
          return {
            key: `${e.id}-${i}`,
            emoji: e.emojis[i % e.emojis.length],
            x: e.x,
            y: e.y,
            dx: Math.cos(angle) * dist,
            dy: Math.sin(angle) * dist - 40,
            rot: (Math.random() - 0.5) * 120,
            scale: 0.8 + Math.random() * 0.8,
            dur: 700 + Math.random() * 400,
          };
        });
        setBursts((b) => [...b, { id: e.id, particles }]);
        setTimeout(() => setBursts((b) => b.filter((x) => x.id !== e.id)), 1900);
      }),
    [],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.flatMap((b) => b.particles.map((p) => <Bit key={p.key} p={p} />))}
    </View>
  );
}

function Bit({ p }: { p: Particle }) {
  const out = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(out, { toValue: 1, duration: p.dur, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fall, { toValue: 1, duration: 600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [out, fall, p.dur]);

  return (
    <Animated.Text
      style={[
        styles.bit,
        {
          left: p.x - 14,
          top: p.y - 14,
          opacity: fall.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            { translateX: out.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
            {
              translateY: Animated.add(
                out.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }),
                fall.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }),
              ),
            },
            { scale: out.interpolate({ inputRange: [0, 1], outputRange: [0.3, p.scale] }) },
            { rotate: out.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.rot}deg`] }) },
          ],
        },
      ]}
    >
      {p.emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  bit: { position: "absolute", fontSize: 22, width: 28, height: 28, textAlign: "center" },
});

