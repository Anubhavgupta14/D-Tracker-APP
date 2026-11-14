import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Easing, Linking, StyleSheet, View } from "react-native";
import { SOS_PRESETS, telLink, whatsappLink } from "@/lib/cheer";
import type { Settings } from "@/lib/cycle";
import { buzz, reducedMotion } from "@/lib/fx";
import { C, SHADOW, alpha, useTheme } from "@/lib/theme";
import { ChatIcon, PhoneIcon } from "../icons";
import { Btn, Card, Eyebrow, Press, Reveal, T } from "../ui";

const open = (url: string) => {
  Linking.openURL(url).catch(() => {});
};

/** The GSAP `.pulse-ring`: grows and fades, forever, staggered 0.7s. */
function PulseRing({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion()) return;
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(Animated.timing(v, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true })),
    ]);
    anim.start();
    return () => anim.stop();
  }, [v, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.8] }) }],
        },
      ]}
    />
  );
}

export function CallHim({ settings }: { settings: Settings }) {
  const theme = useTheme();
  const initial = settings.partnerName.replace(/^the\s+/i, "").charAt(0).toUpperCase() || "♥";
  const hasPhone = settings.partnerPhone.replace(/\D/g, "").length >= 8;

  return (
    <View style={{ paddingBottom: 16 }}>
      <View style={{ alignItems: "center", paddingTop: 8 }}>
        <View style={styles.avatarWrap}>
          <PulseRing delay={0} />
          <PulseRing delay={700} />
          <PulseRing delay={1400} />
          <View style={styles.avatar}>
            <LinearGradient colors={[C.berry, C.lilac]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <T v="display" size={48} color="#fff">
              {initial}
            </T>
          </View>
        </View>
        <T v="display" size={24} center style={{ marginTop: 16 }}>
          {settings.partnerName}
        </T>
        <View style={styles.onCall}>
          <View style={styles.dot} />
          <T size={12} weight={700} color={C.mint}>
            On call 24/7 · for you only
          </T>
        </View>
        <T size={14} soft center style={{ marginTop: 12, maxWidth: 300 }}>
          Average response time: faster than your Wi-Fi. Specialises in listening, agreeing, and sending snacks.
        </T>
      </View>

      {hasPhone ? (
        <>
          <View style={{ marginTop: 24, flexDirection: "row", gap: 12 }}>
            <Btn
              style={{ flex: 1 }}
              icon={<PhoneIcon size={20} color="#fff" />}
              onPress={() => {
                buzz(20);
                open(telLink(settings.partnerPhone));
              }}
            >
              Call
            </Btn>
            <Btn
              kind="soft"
              style={{ flex: 1 }}
              icon={<ChatIcon size={20} color={theme.accentInk} />}
              onPress={() => open(whatsappLink(settings.partnerPhone, "Hey Baby 💗"))}
            >
              Message
            </Btn>
          </View>

          <Eyebrow style={{ marginTop: 28, marginBottom: 12 }}>Quick SOS (opens WhatsApp)</Eyebrow>
          <View style={{ gap: 10 }}>
            {SOS_PRESETS.map((p, i) => (
              <Reveal key={p.label} delay={200 + i * 60} from={20}>
                <Press
                  scaleTo={0.98}
                  accessibilityRole="link"
                  accessibilityLabel={p.label}
                  onPress={() => {
                    buzz(10);
                    open(whatsappLink(settings.partnerPhone, p.text));
                  }}
                >
                  <Card pad={14} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={[styles.presetIcon, { backgroundColor: theme.accentSoft }]}>
                      <T size={24}>{p.emoji}</T>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T weight={600}>{p.label}</T>
                      <T size={12} soft numberOfLines={1}>
                        {p.text}
                      </T>
                    </View>
                  </Card>
                </Press>
              </Reveal>
            ))}
          </View>
        </>
      ) : (
        <Card pad={20} style={{ marginTop: 24, alignItems: "center" }}>
          <T weight={600} center>
            His number isn't saved yet.
          </T>
          <T size={14} soft center style={{ marginTop: 4 }}>
            Tell {settings.partnerName} to add it. Yes, this is his job. 🛠️
          </T>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { width: 128, height: 128, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 64, backgroundColor: alpha(C.berry, 0.3) },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.berry,
    ...SHADOW.pop,
  },
  onCall: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: C.mintSoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.mint },
  presetIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
