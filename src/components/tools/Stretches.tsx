import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, type ViewInstance } from "react-native";
import type { Settings } from "@/lib/cycle";
import { buzz, burst, reducedMotion } from "@/lib/fx";
import { STRETCHES } from "@/lib/stretches";
import { C, alpha, useTheme } from "@/lib/theme";
import { ChevronLeft, ChevronRight, PlayIcon } from "../icons";
import { Pose } from "../illustrations";
import { Btn, Card, Press, Reveal, T } from "../ui";

/** A prescription pad she wrote for herself, plus a guided session with a breathing guide. */
export function Stretches({ settings }: { settings: Settings }) {
  const [active, setActive] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 32 }}>
        <T size={60}>🏅</T>
        <T v="display" size={24} center style={{ marginTop: 16 }}>
          Session complete!
        </T>
        <T soft center style={{ marginTop: 8, maxWidth: 300 }}>
          Patient compliance: excellent (for once). Recommended follow-up: blanket, snacks, and a call with{" "}
          {settings.partnerName}.
        </T>
        <Btn style={{ marginTop: 24 }} onPress={() => setDone(false)}>
          Back to the Rx
        </Btn>
      </View>
    );
  }

  if (active !== null) {
    return (
      <Session
        index={active}
        onIndex={setActive}
        onExit={() => setActive(null)}
        onFinish={() => {
          setActive(null);
          setDone(true);
        }}
      />
    );
  }

  const rx: [string, string][] = [
    ["Patient", settings.herName],
    ["Physio", `${settings.herName} (yes, you)`],
    ["Referred by", `${settings.partnerName}, worried boyfriend`],
    ["Dosage", `${STRETCHES.length} stretches · slow breaths · no heroics`],
  ];

  return (
    <View style={{ paddingBottom: 16 }}>
      {/* Prescription pad */}
      <Card pad={20} style={{ overflow: "hidden" }}>
        <View pointerEvents="none" style={styles.stripe}>
          {Array.from({ length: 60 }, (_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <T v="display" weight={700} size={48} color={C.mint} style={{ lineHeight: 50, fontStyle: "italic" }}>
            Rx
          </T>
          <View style={styles.protocol}>
            <T size={12} weight={700} color={C.mint}>
              Cramp Protocol
            </T>
          </View>
        </View>
        <View style={{ marginTop: 16, gap: 6 }}>
          {rx.map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", gap: 12 }}>
              <T size={14} soft style={{ width: 84 }}>
                {k}
              </T>
              <T size={14} weight={600} style={{ flex: 1 }}>
                {v}
              </T>
            </View>
          ))}
        </View>
        <T v="hand" size={20} soft style={{ marginTop: 16 }}>
          “Do as you tell your patients, not as you do.” — {settings.partnerName}
        </T>
      </Card>

      <Btn style={{ marginTop: 16 }} icon={<PlayIcon size={18} color="#fff" />} onPress={() => setActive(0)}>
        Start guided session
      </Btn>

      <View style={{ marginTop: 20, gap: 12 }}>
        {STRETCHES.map((s, i) => (
          <Press key={s.id} onPress={() => setActive(i)} accessibilityRole="button" accessibilityLabel={s.name}>
            <Card pad={14} style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View style={styles.poseBox}>
                <Pose pose={s.pose} width={64} height={48} color={C.mint} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <T v="display" size={18} style={{ flexShrink: 1 }}>
                    {s.name}
                  </T>
                  <T size={12} weight={700} soft>
                    {s.hold}s
                  </T>
                </View>
                <T size={12} soft style={{ marginTop: 2, lineHeight: 16 }}>
                  {s.note}
                </T>
              </View>
            </Card>
          </Press>
        ))}
      </View>
    </View>
  );
}

function Session({
  index,
  onIndex,
  onExit,
  onFinish,
}: {
  index: number;
  onIndex: (i: number) => void;
  onExit: () => void;
  onFinish: () => void;
}) {
  const theme = useTheme();
  const s = STRETCHES[index];
  const nextBtn = useRef<ViewInstance>(null);
  const [left, setLeft] = useState(s.hold);
  const [paused, setPaused] = useState(false);
  const [breath, setBreath] = useState<"in" | "out">("in");
  const scale = useRef(new Animated.Value(0.62)).current;

  // Reset the timer whenever the stretch changes.
  const [shown, setShown] = useState(index);
  if (shown !== index) {
    setShown(index);
    setLeft(s.hold);
    setPaused(false);
  }

  useEffect(() => {
    if (paused || left <= 0) return;
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left, paused]);

  useEffect(() => {
    if (left === 0) buzz([30, 80, 30]);
  }, [left]);

  // Breathing guide: in for 4s, out for 6s. Restarts on a new stretch; holds still while paused.
  useEffect(() => {
    if (paused) return;
    let alive = true;
    let anim: Animated.CompositeAnimation | null = null;
    const ease = Easing.inOut(Easing.sin);
    const inhale = () => {
      if (!alive) return;
      setBreath("in");
      anim = Animated.timing(scale, { toValue: 1, duration: 4000, easing: ease, useNativeDriver: true });
      anim.start(({ finished }) => finished && exhale());
    };
    const exhale = () => {
      if (!alive) return;
      setBreath("out");
      anim = Animated.timing(scale, { toValue: 0.62, duration: 6000, easing: ease, useNativeDriver: true });
      anim.start(({ finished }) => finished && inhale());
    };
    if (reducedMotion()) setBreath("in");
    else inhale();
    return () => {
      alive = false;
      anim?.stop();
    };
  }, [index, paused, scale]);

  const next = () => {
    if (index === STRETCHES.length - 1) {
      burst(nextBtn, ["🏅", "💗", "✨", "🌸"], 18);
      onFinish();
    } else onIndex(index + 1);
  };

  return (
    <View style={{ paddingBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Press onPress={onExit} accessibilityRole="button">
          <T size={14} weight={600} soft>
            ← All stretches
          </T>
        </Press>
        <T size={12} weight={700} soft>
          {index + 1} / {STRETCHES.length}
        </T>
      </View>
      <View style={{ marginTop: 8, flexDirection: "row", gap: 4 }}>
        {STRETCHES.map((x, i) => (
          <View key={x.id} style={[styles.seg, { backgroundColor: i <= index ? C.mint : C.line }]} />
        ))}
      </View>

      <Reveal key={index} from={30} style={{ marginTop: 20 }}>
        <Card pad={24} style={{ alignItems: "center" }}>
          <View style={styles.breathWrap}>
            <Animated.View style={[styles.breath, { transform: [{ scale }] }]} />
            <View style={styles.dashedRing} />
            <Pose pose={s.pose} width={144} height={96} color={C.mint} />
          </View>
          <T v="hand" size={24} color={C.mint} center>
            {paused ? "paused" : breath === "in" ? "breathe in…" : "and out…"}
          </T>
          <T v="display" size={24} center style={{ marginTop: 4 }}>
            {s.name}
          </T>
          <T size={14} soft center style={{ marginTop: 8, lineHeight: 22 }}>
            {s.how}
          </T>
          <T v="display" size={48} color={theme.accent} style={{ marginTop: 16, fontVariant: ["tabular-nums"] }}>
            {left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "✓"}
          </T>
          <T size={12} soft center style={{ marginTop: 8, fontStyle: "italic" }}>
            Physio note: {s.note}
          </T>
        </Card>
      </Reveal>

      <View style={{ marginTop: 16, flexDirection: "row", gap: 12 }}>
        <Btn
          kind="ghost"
          style={styles.square}
          onPress={() => onIndex(Math.max(0, index - 1))}
          disabled={index === 0}
          accessibilityLabel="Previous stretch"
        >
          <ChevronLeft />
        </Btn>
        <Btn kind="soft" style={{ flex: 1 }} onPress={() => setPaused((p) => !p)} disabled={left === 0}>
          {paused ? "Resume" : "Pause"}
        </Btn>
        <View ref={nextBtn} collapsable={false}>
          <Btn style={styles.square} onPress={next} accessibilityLabel="Next stretch">
            <ChevronRight color="#fff" />
          </Btn>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stripe: { position: "absolute", top: 0, right: 0, bottom: 0, width: 8, opacity: 0.6, overflow: "hidden", gap: 8 },
  dash: { height: 10, backgroundColor: C.mint },
  protocol: { borderRadius: 999, backgroundColor: C.mintSoft, paddingHorizontal: 12, paddingVertical: 4 },
  poseBox: { width: 80, height: 64, borderRadius: 16, backgroundColor: C.mintSoft, alignItems: "center", justifyContent: "center" },
  seg: { flex: 1, height: 6, borderRadius: 999 },
  breathWrap: { width: 208, height: 208, alignItems: "center", justifyContent: "center" },
  breath: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 104, backgroundColor: C.mintSoft },
  dashedRing: {
    position: "absolute",
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    borderRadius: 80,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: alpha(C.mint, 0.4),
  },
  square: { width: 56, height: 56, paddingHorizontal: 0, paddingVertical: 0 },
});
