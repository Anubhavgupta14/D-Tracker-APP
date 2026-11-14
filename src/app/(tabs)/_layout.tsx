import { router, usePathname } from "expo-router";
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { useContext, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarIcon, HomeIcon, SparkleIcon, WandIcon, type IconProps } from "@/components/icons";
import { HoldButton } from "@/components/HoldButton";
import { PermissionPrompt } from "@/components/PermissionPrompt";
import { Sheet } from "@/components/Sheet";
import { CallHim } from "@/components/tools/CallHim";
import { ChocolateBox } from "@/components/tools/ChocolateBox";
import { ToolsContext } from "@/components/tools/context";
import { CrampCrusher } from "@/components/tools/CrampCrusher";
import { HotBag } from "@/components/tools/HotBag";
import { Stretches } from "@/components/tools/Stretches";
import { T, TOOLS, type ToolId } from "@/components/ui";
import { buzz } from "@/lib/fx";
import { startHelp, useHelp } from "@/lib/help";
import { useAppState } from "@/lib/store";
import { C, DarkContext, useTheme } from "@/lib/theme";

const TABS: { name: string; label: string; Icon: (p: IconProps) => React.ReactNode }[] = [
  { name: "index", label: "Today", Icon: HomeIcon },
  { name: "calendar", label: "Calendar", Icon: CalendarIcon },
  { name: "glow", label: "Glow", Icon: WandIcon },
  { name: "jarvis", label: "Jarvis", Icon: SparkleIcon },
];
// Care isn't in the bar (it opens from Today), but it's still a tab screen so the tools sheet works there.
/** The SOS button sits dead centre, between Calendar and Glow. */
const SOS_SLOT = 2;
const SLOTS = TABS.length + 1;
const slotOf = (i: number) => (i >= SOS_SLOT ? i + 1 : i);

export default function TabsLayout() {
  const state = useAppState();
  const [tool, setTool] = useState<ToolId | null>(null);
  const [lastTool, setLastTool] = useState<ToolId>("chocolate");

  const openTool = (t: ToolId) => {
    buzz(10);
    setLastTool(t);
    setTool(t);
  };

  const shownTool = tool ?? lastTool;
  const toolTitle = shownTool === "call" ? `Call ${state.settings.partnerName}` : TOOLS[shownTool].title;
  const fullTool = shownTool === "stretch" || shownTool === "game" || shownTool === "chocolate";

  // Help mode can start from anywhere (a button, Jarvis); its screen always comes up on top.
  const helpPhase = useHelp().phase;
  const pathname = usePathname();
  useEffect(() => {
    if (helpPhase === "idle" || pathname === "/help") return;
    router.push("/help");
  }, [helpPhase, pathname]);

  return (
    <ToolsContext.Provider value={{ openTool }}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" }, animation: "fade" }}
      >
        {TABS.map((t) => (
          <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
        ))}
        <Tabs.Screen name="care" options={{ title: "Care" }} />
      </Tabs>

      <Sheet
        open={tool !== null && helpPhase === "idle"}
        onClose={() => setTool(null)}
        eyebrow="Comfort Corner"
        title={`${TOOLS[shownTool].emoji} ${toolTitle}`}
        full={fullTool}
        scroll={shownTool !== "game"}
      >
        {shownTool === "chocolate" && <ChocolateBox settings={state.settings} />}
        {shownTool === "hotbag" && <HotBag />}
        {shownTool === "call" && <CallHim settings={state.settings} />}
        {shownTool === "stretch" && <Stretches settings={state.settings} />}
        {shownTool === "game" && <CrampCrusher best={state.bestCrushScore} />}
      </Sheet>

      <PermissionPrompt partnerName={state.settings.partnerName} />
    </ToolsContext.Provider>
  );
}

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const setDark = useContext(DarkContext);
  const active = state.routes[state.index]?.name;
  const dark = active === "jarvis";

  // The Jarvis tab is a dark HUD; derived from the tab so nothing can get out of sync.
  useEffect(() => {
    setDark(dark);
  }, [dark, setDark]);

  const [w, setW] = useState(0);
  const index = TABS.findIndex((t) => t.name === active);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: slotOf(index) * (w / SLOTS), useNativeDriver: true, speed: 14, bounciness: 9 }).start();
  }, [index, w, x]);

  return (
    <View style={[styles.navWrap, { paddingBottom: 12 + insets.bottom }]} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: dark ? C.hudNav : "rgba(255,255,255,0.95)" }]}>
        <View style={styles.row} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          {w > 0 && index >= 0 && (
            <Animated.View
              style={[styles.pill, { width: w / SLOTS, backgroundColor: theme.accentSoft, transform: [{ translateX: x }] }]}
            />
          )}
          {TABS.map(({ name, label, Icon }, i) => {
            const on = active === name;
            const route = state.routes.find((r) => r.name === name);
            const color = on ? theme.accent : dark ? C.hudInkSoft : C.inkSoft;
            const tab = (
              <Pressable
                key={name}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={label}
                onPress={() => {
                  if (on) return;
                  buzz(6);
                  if (route) navigateToTab(route.key);
                }}
              >
                <Icon size={22} color={color} strokeWidth={on ? 2.4 : 2} />
                <T weight={700} size={11} color={color}>
                  {label}
                </T>
              </Pressable>
            );
            return i === SOS_SLOT ? [<SosButton key="sos" dark={dark} />, tab] : tab;
          })}
        </View>
      </View>
    </View>
  );
}

/** Hold for 1.5 s to start Help mode (a tap does nothing, so it can't go off by accident). */
function SosButton({ dark }: { dark: boolean }) {
  return (
    <View style={styles.sosSlot}>
      <HoldButton
        duration={1500}
        onDone={() => startHelp("button")}
        color="#d7263d"
        fill="#7a0b1e"
        style={[styles.sos, { borderColor: dark ? C.hudNav : "#fff" }]}
        accessibilityLabel="SOS. Hold to start Help mode: siren, lights, and your location to him"
      >
        {({ holding, hint }) => (
          <T weight={700} size={hint ? 11 : 14} color="#fff">
            {holding ? "…" : hint ? "HOLD" : "SOS"}
          </T>
        )}
      </HoldButton>
    </View>
  );
}

const styles = StyleSheet.create({
  sosSlot: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  sos: {
    width: 56,
    height: 56,
    marginTop: -10, // a small lift; Android ignores touches outside the bar, so don't float it far above
    borderWidth: 4,
    justifyContent: "center",
    shadowColor: "#d7263d",
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  navWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  bar: {
    borderRadius: 28,
    padding: 6,
    shadowColor: "#5a1e3c",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  row: { flexDirection: "row" },
  pill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: 22 },
  tab: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 8 },
});
