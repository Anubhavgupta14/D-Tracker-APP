import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { Screen } from "@/components/Screen";
import type { AppState, CycleInfo } from "@/lib/cycle";
import { C } from "@/lib/theme";
import { HelpCard } from "../HelpButton";
import { LiveShareCard } from "../LiveShareCard";
import { ShortcutCard } from "../ShortcutCard";
import { ChevronLeft } from "../icons";
import { GiftBox, HotWaterBag } from "../illustrations";
import { Card, Float, Press, Reveal, T, TOOLS, type ToolId } from "../ui";

export function CareView({
  state,
  info,
  openTool,
  onBack,
}: {
  state: AppState;
  info: CycleInfo | null;
  openTool: (t: ToolId) => void;
  /** Care isn't in the tab bar on Android, so it needs its own way home. */
  onBack?: () => void;
}) {
  const small: ToolId[] = ["call", "stretch", "game"];
  // Same stagger as the web's GSAP `.reveal` (0.07s apart).
  let n = 0;
  const d = () => n++ * 70;

  return (
    <Screen>
      <View style={{ gap: 20, paddingBottom: 24 }}>
        <Reveal delay={d()} style={{ paddingTop: 8 }}>
          {onBack ? (
            <Press onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to Today" style={styles.back}>
              <ChevronLeft size={18} color={C.inkSoft} />
              <T size={14} weight={700} soft>
                Today
              </T>
            </Press>
          ) : null}
          <T size={14} weight={600} soft>
            Open 24/7 · Staffed by one (1) devoted Engineer
          </T>
          <T v="display" size={28} style={{ lineHeight: 34 }}>
            Comfort Corner
          </T>
          {info?.onPeriod && (
            <View style={styles.seasonPill}>
              <T size={12} weight={700} color={C.berry}>
                🌙 Cozy Season, day {info.periodDay}: everything here is on the house
              </T>
            </View>
          )}
        </Reveal>

        <Reveal delay={d()}>
          <HelpCard partnerName={state.settings.partnerName} />
        </Reveal>
        <Reveal delay={d()}>
          <LiveShareCard partnerName={state.settings.partnerName} />
        </Reveal>
        <Reveal delay={d()}>
          <ShortcutCard />
        </Reveal>

        {/* Two hero tiles */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Reveal delay={d()} style={{ flex: 1 }}>
            <Press onPress={() => openTool("chocolate")} accessibilityRole="button" accessibilityLabel="Chocolate box">
              <Card pad={16} style={styles.hero}>
                <LinearGradient colors={["#ffffff", "#f6e2d6"]} start={{ x: 0.33, y: 0 }} end={{ x: 0.67, y: 1 }} style={StyleSheet.absoluteFill} />
                <View>
                  <T v="display" size={18} style={{ lineHeight: 22 }}>
                    Chocolate box
                  </T>
                  <T size={12} soft>
                    {state.treatsOpened} treats unwrapped
                  </T>
                </View>
                <Float style={{ alignSelf: "center", marginBottom: -8 }}>
                  <GiftBox size={130} />
                </Float>
              </Card>
            </Press>
          </Reveal>
          <Reveal delay={d()} style={{ flex: 1 }}>
            <Press onPress={() => openTool("hotbag")} accessibilityRole="button" accessibilityLabel="Hot water bag">
              <Card pad={16} style={styles.hero}>
                <LinearGradient colors={["#ffffff", "#ffe2d8"]} start={{ x: 0.33, y: 0 }} end={{ x: 0.67, y: 1 }} style={StyleSheet.absoluteFill} />
                <View>
                  <T v="display" size={18} style={{ lineHeight: 22 }}>
                    Hot water bag
                  </T>
                  <T size={12} soft>
                    Hold to warm up
                  </T>
                </View>
                <Float style={{ alignSelf: "center", marginBottom: -24 }}>
                  <HotWaterBag warmth={0.75} size={96} />
                </Float>
              </Card>
            </Press>
          </Reveal>
        </View>

        <View style={{ gap: 12 }}>
          {small.map((t) => (
            <Reveal key={t} delay={d()}>
              <Press onPress={() => openTool(t)} scaleTo={0.98} accessibilityRole="button">
                <Card pad={16} style={styles.row}>
                  <View style={[styles.emojiBox, { backgroundColor: TOOLS[t].tint }]}>
                    <T size={30}>{TOOLS[t].emoji}</T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="display" size={18}>
                      {t === "call" ? `Call ${state.settings.partnerName}` : TOOLS[t].title}
                    </T>
                    <T size={14} soft>
                      {t === "game" && state.bestCrushScore > 0 ? `Best: ${state.bestCrushScore} cramps crushed` : TOOLS[t].sub}
                    </T>
                  </View>
                  <T size={24} soft>
                    ›
                  </T>
                </Card>
              </Press>
            </Reveal>
          ))}
        </View>

        <Reveal delay={d()} style={{ paddingHorizontal: 16 }}>
          <T v="hand" size={20} soft center>
            “Whatever hurts, I'm one tap away.” — {state.settings.partnerName}
          </T>
        </Reveal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", paddingVertical: 6, marginBottom: 4, marginLeft: -4 },
  seasonPill: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: C.berrySoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  hero: { height: 224, overflow: "hidden", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  emojiBox: { width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
