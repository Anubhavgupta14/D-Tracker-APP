import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, View, type ViewInstance } from "react-native";
import { getCheer } from "@/lib/cheer";
import { DAY_MOODS, MOODS, PERIOD_MOODS, type AppState, type CycleInfo, type MoodId } from "@/lib/cycle";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { addDays, diffDays, fmtLong, fmtShort, fromKey, greeting, toKey, type DayKey } from "@/lib/dates";
import { buzz, burst } from "@/lib/fx";
import { actions } from "@/lib/store";
import { C, SHADOW, mix, useTheme } from "@/lib/theme";
import { countdown, upcoming, useHolidays } from "@/lib/upcoming";
import { CycleRing } from "../CycleRing";
import { ChevronLeft, ChevronRight, RefreshIcon, SparkleIcon } from "../icons";
import { Screen } from "../Screen";
import { Btn, Card, Chip, Eyebrow, Float, Press, Reveal, SectionTitle, Slider, T, TOOLS, type ToolId } from "../ui";

const PAIN_FACES = ["😌", "🙂", "🙂", "😐", "😕", "😟", "😣", "😖", "😫", "😭", "🆘"];
const painLabel = (p: number) => (p === 0 ? "No pain" : p <= 3 ? "Mild" : p <= 6 ? "Moderate" : "Severe");

/**
 * The NPRS track: linear-gradient(90deg, #6fd3a8 0%, #ffd166 45%, #ff9b6a 70%, #e5487a 100%).
 * `Slider` spaces its colours evenly, so sample the gradient every 5% (45% and 70% land exactly on a sample).
 */
const NPRS_STOPS: [number, string][] = [
  [0, "#6fd3a8"],
  [0.45, "#ffd166"],
  [0.7, "#ff9b6a"],
  [1, "#e5487a"],
];
const NPRS_GRADIENT = Array.from({ length: 21 }, (_, i) => {
  const t = i / 20;
  const k = Math.max(1, NPRS_STOPS.findIndex(([at]) => at >= t));
  const [a, ca] = NPRS_STOPS[k - 1];
  const [b, cb] = NPRS_STOPS[k];
  return mix(ca, cb, (t - a) / (b - a));
});

type Rec = ToolId | "jarvis";

function recommend(pain: number | undefined, moods: MoodId[], onPeriod: boolean): Rec[] {
  const out = new Set<Rec>();
  if (!onPeriod) {
    // Everyday suggestions: nothing cycle-related.
    if (moods.includes("missing_him") || moods.includes("stressed")) out.add("call");
    if (moods.some((m) => m === "happy" || m === "loved" || m === "energetic")) out.add("jarvis");
    // No hot water bag, stretches or Cramp Crusher here: those are period tools.
    if (moods.some((m) => m === "cravings" || m === "moody" || m === "stressed" || m === "tired")) out.add("chocolate");
    return [...out].slice(0, 3);
  }
  if (pain !== undefined) {
    if (pain >= 7) ["call", "hotbag", "stretch"].forEach((t) => out.add(t as ToolId));
    else if (pain >= 4) ["hotbag", "stretch", "chocolate"].forEach((t) => out.add(t as ToolId));
    else if (pain >= 1) ["chocolate", "stretch"].forEach((t) => out.add(t as ToolId));
    else ["chocolate", "game"].forEach((t) => out.add(t as ToolId));
  }
  if (moods.includes("cravings")) out.add("chocolate");
  if (moods.includes("moody")) out.add("game");
  if (moods.includes("cramps")) out.add("hotbag");
  if (moods.includes("tired")) out.add("call");
  return [...out].slice(0, 3);
}

export function TodayView({
  state,
  info,
  today,
  openTool,
  openJarvis,
  openCare,
}: {
  state: AppState;
  info: CycleInfo | null;
  today: DayKey;
  openTool: (t: ToolId) => void;
  openJarvis: () => void;
  openCare: () => void;
}) {
  const theme = useTheme();
  const actionRef = useRef<ViewInstance>(null);
  const { settings } = state;
  const log = state.logs[today] ?? {};
  const moods = log.moods ?? [];
  const phaseId = info?.phase.id ?? "follicular";
  const onPeriod = Boolean(info?.onPeriod);
  // Off-period the check-in is about her day, so pain doesn't feed the advice.
  const painForRx = onPeriod ? log.pain : undefined;
  const holidays = useHolidays();
  const events = upcoming(info, holidays, today);

  const [dose, setDose] = useState(() =>
    getCheer({ phase: phaseId, herName: settings.herName, partnerName: settings.partnerName }),
  );
  const [rx, setRx] = useState<string | null>(() =>
    painForRx !== undefined || moods.length
      ? getCheer({ phase: phaseId, pain: painForRx, moods, ...settings })
      : null,
  );

  // Daily dose: fade the line out, swap it, fade the new one in; spin the refresh icon.
  const doseFade = useRef(new Animated.Value(1)).current;
  const doseY = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const newDose = () => {
    buzz(8);
    Animated.parallel([
      Animated.timing(doseFade, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(doseY, { toValue: -8, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setDose(getCheer({ phase: phaseId, herName: settings.herName, partnerName: settings.partnerName }));
      doseY.setValue(10);
      Animated.parallel([
        Animated.timing(doseFade, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(doseY, { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    });
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  const refreshRx = (pain: number | undefined, nextMoods: MoodId[]) => {
    setRx(getCheer({ phase: phaseId, pain, moods: nextMoods, ...settings }));
  };

  const onPain = (p: number) => {
    const prevBand = log.pain === undefined ? -1 : painLabel(log.pain);
    actions.logDay(today, { pain: p });
    if (painLabel(p) !== prevBand) refreshRx(p, moods);
    if (p !== log.pain) buzz(4);
  };

  const toggleMood = (m: MoodId) => {
    buzz(8);
    const next = moods.includes(m) ? moods.filter((x) => x !== m) : [...moods, m];
    actions.logDay(today, { moods: next });
    refreshRx(painForRx, next);
  };

  const startPeriod = () => {
    buzz([20, 40, 20]);
    burst(actionRef, ["🌙", "💗", "🫶"], 12);
    actions.startPeriod(today);
  };

  const endPeriod = () => {
    buzz([20, 40, 20]);
    burst(actionRef, ["🎉", "✨", "🌈", "💃"], 18);
    // "Ended" means today is already period-free, so yesterday was the last day.
    actions.endPeriod(info && today > info.cycleStart ? addDays(today, -1) : today);
  };

  const extendPeriod = () => {
    buzz(10);
    actions.endPeriod(today);
  };

  const recs = recommend(painForRx, moods, onPeriod);
  const moodChoices = onPeriod ? PERIOD_MOODS : DAY_MOODS;
  const showStart = !info || (!info.onPeriod && info.daysUntilNext <= 5);
  // The day right after the last period day: offer "still going" (also works as an undo).
  const canExtend = info && !info.onPeriod && diffDays(today, info.periodEnd) === 1;

  // GSAP `.reveal` stagger: 0.1s delay, 0.07s apart.
  let revealIdx = 0;
  const nextDelay = () => 100 + revealIdx++ * 70;

  return (
    <Screen contentContainerStyle={{ gap: 24 }}>
      {/* Header */}
      <Reveal delay={nextDelay()} style={{ paddingTop: 8 }}>
        <T size={14} weight={600} soft>
          {fmtLong(today)}
        </T>
        <T v="display" size={28} style={{ lineHeight: 35 }}>
          {greeting()}, <T v="display" size={28} color={theme.accent}>{settings.herName}</T>
        </T>
      </Reveal>

      {/* Ring */}
      {info ? (
        <Reveal delay={nextDelay()}>
          <Card pad={16} style={{ paddingTop: 24, paddingBottom: 20 }}>
            <CycleRing info={info} />
            <View style={styles.ringActions}>
              <View ref={actionRef} collapsable={false}>
                {info.onPeriod ? (
                  <Btn kind="soft" onPress={endPeriod}>
                    🎉 My period is over
                  </Btn>
                ) : canExtend ? (
                  <Btn kind="soft" onPress={extendPeriod}>
                    🥲 Still on my period
                  </Btn>
                ) : showStart ? (
                  <Btn onPress={startPeriod}>🌙 My period started today</Btn>
                ) : (
                  <Press onPress={startPeriod} accessibilityRole="button" style={{ paddingVertical: 4 }}>
                    <T size={14} weight={600} soft style={styles.link}>
                      Period came early? Log it
                    </T>
                  </Press>
                )}
              </View>
            </View>
          </Card>
        </Reveal>
      ) : (
        <Reveal delay={nextDelay()}>
          <FirstPeriod today={today} />
        </Reveal>
      )}

      {/* Cozy mode */}
      {info?.onPeriod && (
        <Reveal delay={nextDelay()} style={styles.cozyShadow}>
          <LinearGradient colors={[C.berry, "#ff7fa2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cozy}>
            <T size={12} weight={700} color="#fff" style={styles.cozyEyebrow}>
              Cozy mode is on
            </T>
            <T v="display" size={24} color="#fff" style={{ marginTop: 4, lineHeight: 30 }}>
              Day {info.periodDay}. You're doing amazing, sweetheart. 🫶
            </T>
            <T size={14} color="#fff" style={{ marginTop: 4, opacity: 0.9 }}>
              Comfort kit, unlocked and on standby:
            </T>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -20, marginTop: 16 }}
              contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 4 }}
            >
              {(Object.keys(TOOLS) as ToolId[]).map((t) => (
                <Press key={t} onPress={() => openTool(t)} scaleTo={0.95} accessibilityRole="button" style={styles.kitTile}>
                  <T size={30}>{TOOLS[t].emoji}</T>
                  <T size={11} weight={600} color="#fff" center style={{ lineHeight: 14 }}>
                    {TOOLS[t].title}
                  </T>
                </Press>
              ))}
            </ScrollView>
          </LinearGradient>
        </Reveal>
      )}

      {/* Daily dose */}
      <Reveal delay={nextDelay()}>
        <Card style={{ overflow: "hidden" }}>
          <View pointerEvents="none" style={styles.doseSparkle}>
            <SparkleIcon size={80} color={theme.accent} />
          </View>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <SparkleIcon size={14} color={theme.accent} />
              <Eyebrow>Daily dose of love</Eyebrow>
            </View>
            <Press
              onPress={newDose}
              accessibilityRole="button"
              accessibilityLabel="Another one"
              style={[styles.doseBtn, { backgroundColor: theme.accentSoft }]}
            >
              <Animated.View
                style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}
              >
                <RefreshIcon size={18} color={theme.accent} />
              </Animated.View>
            </Press>
          </View>
          <Animated.View style={{ opacity: doseFade, transform: [{ translateY: doseY }] }}>
            <T v="hand" size={25} style={{ marginTop: 12, lineHeight: 34 }}>
              {dose}
            </T>
          </Animated.View>
        </Card>
      </Reveal>

      {/* Check-in: period-aware only while she's on her period */}
      <Reveal delay={nextDelay()}>
        <Card>
          <SectionTitle>{onPeriod ? "How are you feeling?" : "How's your day going?"}</SectionTitle>
          {onPeriod && (
            <>
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <T size={14} weight={600}>
                    Pain today
                  </T>
                  <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                    <T size={10} weight={700} color={theme.accent} style={{ letterSpacing: 0.5, textTransform: "uppercase" }}>
                      NPRS
                    </T>
                  </View>
                </View>
                {log.pain === undefined ? (
                  <T v="display" size={18} soft>
                    slide me →
                  </T>
                ) : (
                  <T v="display" size={18}>
                    {PAIN_FACES[log.pain]} {log.pain}/10 · {painLabel(log.pain)}
                  </T>
                )}
              </View>
              <View style={{ marginTop: 16, opacity: log.pain === undefined ? 0.6 : 1 }}>
                <Slider
                  value={log.pain ?? 0}
                  min={0}
                  max={10}
                  step={1}
                  onChange={onPain}
                  gradient={NPRS_GRADIENT}
                  accessibilityLabel="Pain on a scale from 0 to 10"
                />
              </View>
              <View style={[styles.rowBetween, { marginTop: 6 }]}>
                <T size={11} weight={600} soft>
                  0 · none
                </T>
                <T size={11} weight={600} soft>
                  5
                </T>
                <T size={11} weight={600} soft>
                  10 · worst
                </T>
              </View>
              <T size={11} soft style={{ marginTop: 4, fontStyle: "italic" }}>
                You use this scale on patients. Your turn now.
              </T>
            </>
          )}
          {!onPeriod && (
            <T size={14} soft style={{ marginTop: -4 }}>
              Pick whatever fits. As many as you like.
            </T>
          )}

          <View style={[styles.wrapRow, { marginTop: onPeriod ? 20 : 16 }]}>
            {moodChoices.map((id) => (
              <Chip key={id} pressed={moods.includes(id)} onPress={() => toggleMood(id)}>
                {`${MOODS[id].emoji} ${MOODS[id].label}`}
              </Chip>
            ))}
          </View>

          {rx && (
            <View style={[styles.rx, { backgroundColor: theme.accentSoft }]}>
              <Eyebrow color={theme.accent}>The Engineer's prescription</Eyebrow>
              <T size={15} weight={500} style={{ marginTop: 6, lineHeight: 21 }}>
                {rx}
              </T>
              {recs.length > 0 && (
                <View style={[styles.wrapRow, { marginTop: 12 }]}>
                  {recs.map((t) =>
                    t === "jarvis" ? (
                      <Chip key={t} onPress={openJarvis} style={styles.whiteChip}>
                        ✨ Plan a date with Jarvis
                      </Chip>
                    ) : (
                      <Chip key={t} onPress={() => openTool(t)} style={styles.whiteChip}>
                        {`${TOOLS[t].emoji} ${t === "call" ? `Call ${settings.partnerName}` : TOOLS[t].title}`}
                      </Chip>
                    ),
                  )}
                </View>
              )}
            </View>
          )}
        </Card>
      </Reveal>

      {/* Comfort Corner (its own screen, opened from here) */}
      <Reveal delay={nextDelay()}>
        <SectionTitle
          action={
            <Press onPress={openCare} accessibilityRole="button" accessibilityLabel="Open Comfort Corner">
              <T size={14} weight={700} color={theme.accent}>
                See all ›
              </T>
            </Press>
          }
        >
          Comfort Corner
        </SectionTitle>
        <Press onPress={openCare} scaleTo={0.98} accessibilityRole="button" accessibilityLabel="Open Comfort Corner">
          <Card pad={16}>
            <T size={14} soft>
              Open 24/7 · Staffed by one (1) devoted Engineer
            </T>
            <View style={styles.cornerRow}>
              {(Object.keys(TOOLS) as ToolId[]).map((t) => (
                <Press
                  key={t}
                  onPress={() => openTool(t)}
                  scaleTo={0.92}
                  accessibilityRole="button"
                  accessibilityLabel={t === "call" ? `Call ${settings.partnerName}` : TOOLS[t].title}
                  style={[styles.cornerTile, { backgroundColor: theme.accentSoft }]}
                >
                  <T size={26}>{TOOLS[t].emoji}</T>
                </Press>
              ))}
            </View>
          </Card>
        </Press>
      </Reveal>

      {/* Coming up: next period, birthdays, long weekends */}
      <Reveal delay={nextDelay()}>
        <SectionTitle>Coming up</SectionTitle>
        <Card pad={0} style={{ paddingHorizontal: 16 }}>
          {events.map((ev, i) => {
            const soon = countdown(ev.date, today, ev.end);
            return (
              <View key={ev.key} style={[styles.event, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                <View style={[styles.eventIcon, { backgroundColor: ev.tint }]}>
                  <T size={20}>{ev.emoji}</T>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T weight={600} style={{ lineHeight: 19 }}>
                    {ev.title}
                  </T>
                  <T size={12} soft numberOfLines={1}>
                    {ev.sub}
                  </T>
                </View>
                <View style={{ flexShrink: 0, alignItems: "flex-end" }}>
                  <T v="display" size={15}>
                    {fmtShort(ev.date)}
                    {ev.end && ev.end !== ev.date ? `–${fmtShort(ev.end).split(" ")[0]}` : ""}
                  </T>
                  <T size={11} weight={700} color={/Today|Tomorrow|On now/.test(soon) ? theme.accent : undefined} soft>
                    {soon}
                  </T>
                </View>
              </View>
            );
          })}
        </Card>
      </Reveal>

      {/* Phase explainer: only while she's on her period */}
      {info && onPeriod && (
        <Reveal delay={nextDelay()}>
          <Card>
            <Eyebrow>What's happening · {info.phase.clinical}</Eyebrow>
            <T v="display" size={20} style={{ marginTop: 8 }}>
              {info.phase.emoji} {info.phase.name}
            </T>
            <T size={14} soft style={{ marginTop: 4, lineHeight: 23 }}>
              {info.phase.blurb}
            </T>
          </Card>
        </Reveal>
      )}
    </Screen>
  );
}

/** Shown until the first period is logged: one question, then the ring lights up. */
function FirstPeriod({ today }: { today: DayKey }) {
  const [day, setDay] = useState<DayKey>(today);
  const saveRef = useRef<ViewInstance>(null);
  const quick = [0, 1, 2, 3, 5, 7];
  const min = addDays(today, -90);

  const save = () => {
    buzz([20, 40, 20]);
    burst(saveRef, ["🌙", "💗", "✨"], 14);
    actions.startPeriod(day);
  };

  return (
    <Card pad={24} style={{ alignItems: "center" }}>
      <Float>
        <T size={48}>🌙</T>
      </Float>
      <T v="display" size={20} center style={{ marginTop: 12 }}>
        When did your last period start?
      </T>
      <T size={14} soft center style={{ marginTop: 4 }}>
        A rough guess is fine. You can fix it from the Calendar.
      </T>
      <View style={[styles.wrapRow, { marginTop: 16, justifyContent: "center" }]}>
        {quick.map((n) => {
          const k = addDays(today, -n);
          return (
            <Chip key={n} pressed={day === k} onPress={() => setDay(k)}>
              {n === 0 ? "Today" : n === 1 ? "Yesterday" : `${n} days ago`}
            </Chip>
          );
        })}
      </View>
      {/* The web's <input type="date" min={today-90} max={today}>: tap the date for Android's
          calendar picker, or nudge it a day at a time with the arrows. */}
      <View style={styles.dateInput}>
        <Press
          onPress={() => setDay(addDays(day, -1))}
          disabled={day <= min}
          accessibilityLabel="One day earlier"
          style={styles.dateStep}
        >
          <ChevronLeft size={22} />
        </Press>
        <Press
          style={{ flex: 1 }}
          accessibilityRole="button"
          accessibilityLabel="Pick the start date"
          onPress={() =>
            DateTimePickerAndroid.open({
              value: fromKey(day),
              mode: "date",
              minimumDate: fromKey(min),
              maximumDate: fromKey(today),
              onChange: (e, d) => {
                if (e.type === "set" && d) setDay(toKey(d));
              },
            })
          }
        >
          <T v="display" size={18} center>
            {fmtLong(day)}
          </T>
        </Press>
        <Press
          onPress={() => setDay(addDays(day, 1))}
          disabled={day >= today}
          accessibilityLabel="One day later"
          style={styles.dateStep}
        >
          <ChevronRight size={22} />
        </Press>
      </View>
      <View ref={saveRef} collapsable={false} style={{ width: "100%", marginTop: 16 }}>
        <Btn onPress={save}>{`Save · ${fmtShort(day)}`}</Btn>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cornerRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 12 },
  cornerTile: { flex: 1, aspectRatio: 1, maxWidth: 60, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  ringActions: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  link: {
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
  },
  cozyShadow: {
    borderRadius: 28,
    backgroundColor: C.berry,
    ...SHADOW.pop,
  },
  cozy: {
    borderRadius: 28,
    overflow: "hidden",
    padding: 20,
  },
  cozyEyebrow: {
    letterSpacing: 1.7,
    textTransform: "uppercase",
    opacity: 0.8,
  },
  kitTile: {
    width: 84,
    alignItems: "center",
    gap: 6,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  doseSparkle: {
    position: "absolute",
    top: -12,
    right: -12,
    opacity: 0.1,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  doseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    marginLeft: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rx: {
    marginTop: 20,
    borderRadius: 24,
    padding: 16,
  },
  whiteChip: {
    backgroundColor: "#fff",
  },
  event: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  eventIcon: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dateInput: {
    width: "100%",
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: C.line,
  },
  dateStep: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
