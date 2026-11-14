import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Linking, StyleSheet, View } from "react-native";
import { reducedMotion } from "@/lib/fx";
import type { DatePlan } from "@/lib/jarvis/protocol";
import { Press, T } from "../ui";

const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

const PAD = 20;
const TIME_W = 67; // 4.2rem
const GAP = 24;
/** The timeline rail sits under the dots (web: left 6.3rem). */
const RAIL_X = PAD + TIME_W + GAP - 15 + 5;

/** Each stop slides in from the left, staggered (GSAP .stop). */
function StopIn({ i, children }: { i: number; children: ReactNode }) {
  const v = useRef(new Animated.Value(reducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 500, delay: 150 + i * 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, i]);
  return (
    <Animated.View
      style={[styles.stop, { opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

export function DatePlanCard({ plan, onSend }: { plan: DatePlan; onSend?: () => void }) {
  const stops = Array.isArray(plan.stops) ? plan.stops : [];
  const total = stops.reduce((s, x) => s + (Number(x.cost_inr) || 0), 0);

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={["rgba(255,111,165,0.3)", "rgba(143,110,230,0.25)", "rgba(79,157,255,0.2)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: PAD }}
      >
        <T size={11} weight={700} color="rgba(255,255,255,0.6)" style={{ letterSpacing: 1.76, textTransform: "uppercase" }}>
          Date plan · {plan.location}
        </T>
        <T v="display" size={24} style={{ marginTop: 4, lineHeight: 30 }}>
          {plan.title}
        </T>
        <T v="hand" size={20} color="rgba(255,255,255,0.8)" style={{ marginTop: 4 }}>
          {plan.vibe}
        </T>
        <View style={styles.pills}>
          <View style={[styles.pill, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <T size={12} weight={700}>
              {inr(plan.budget_min_inr)} – {inr(plan.budget_max_inr)} for two
            </T>
          </View>
          <View style={[styles.pill, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
            <T size={12} weight={700}>
              {stops.length} stops
            </T>
          </View>
        </View>
      </LinearGradient>

      <View style={{ padding: PAD, gap: 16 }}>
        <View style={styles.rail} />
        {stops.map((s, i) => (
          <StopIn key={i} i={i}>
            <T size={12} weight={700} color="rgba(255,255,255,0.6)" style={styles.time}>
              {s.time}
            </T>
            <View style={{ flex: 1 }}>
              <View style={styles.dot} />
              <View style={styles.nameRow}>
                <T weight={600} style={{ flex: 1, lineHeight: 20 }}>
                  {s.name}
                </T>
                <View style={styles.cost}>
                  <T size={11} weight={700}>
                    {inr(s.cost_inr)}
                  </T>
                </View>
              </View>
              <T size={14} color="rgba(255,255,255,0.75)">
                {s.activity}
                {s.area ? ` · ${s.area}` : ""}
              </T>
              {!!s.why && (
                <T size={12} color="rgba(255,255,255,0.55)" style={{ marginTop: 2, fontStyle: "italic" }}>
                  {s.why}
                </T>
              )}
              <Press
                scaleTo={0.95}
                style={{ marginTop: 4, alignSelf: "flex-start" }}
                accessibilityRole="link"
                onPress={() =>
                  void Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.name, s.area, plan.location].filter(Boolean).join(", "))}`,
                  ).catch(() => {})
                }
              >
                <T size={12} weight={600} color="#8fe9ff">
                  Open in Maps ↗
                </T>
              </Press>
            </View>
          </StopIn>
        ))}
      </View>

      {plan.tips && plan.tips.length > 0 && (
        <View style={styles.tips}>
          {plan.tips.map((t, i) => (
            <T key={i} size={12} color="rgba(255,255,255,0.7)">
              ✦ {t}
            </T>
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <T size={12} color="rgba(255,255,255,0.6)" style={{ flexShrink: 1 }}>
          Stops add up to{" "}
          <T size={12} weight={700} color="#ffffff">
            {inr(total)}
          </T>
        </T>
        {onSend && (
          <Press scaleTo={0.95} onPress={onSend} accessibilityRole="button" style={styles.send}>
            <T size={14} weight={700} color="#ffffff">
              Send to him 💌
            </T>
          </Press>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  pills: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  rail: {
    position: "absolute",
    top: 28,
    bottom: 28,
    left: RAIL_X,
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  stop: { flexDirection: "row", gap: GAP },
  time: { width: TIME_W, paddingTop: 2, textAlign: "right", fontVariant: ["tabular-nums"] },
  dot: {
    position: "absolute",
    top: 6,
    left: -15,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ff8fbf",
    boxShadow: "0 0 10px #ff8fbf",
  },
  nameRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  cost: { flexShrink: 0, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 8, paddingVertical: 2 },
  tips: { marginHorizontal: PAD, marginBottom: 16, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.05)", padding: 12 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: PAD,
    paddingVertical: 16,
  },
  send: { borderRadius: 999, backgroundColor: "#ff6fa5", paddingHorizontal: 16, paddingVertical: 8 },
});
