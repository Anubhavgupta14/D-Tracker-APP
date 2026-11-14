import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Animated, Easing, PanResponder, StyleSheet, View, type ViewInstance } from "react-native";
import Svg, { Defs, Pattern, Rect } from "react-native-svg";
import { MOODS, averageCycleLength, lastPeriodOnOrBefore, markDays, periodEndOf, type AppState, type CycleInfo, type DayMark } from "@/lib/cycle";
import { diffDays, fmt, fmtLong, fmtShort, fromKey, monthGrid, type DayKey } from "@/lib/dates";
import { buzz, burst, reducedMotion } from "@/lib/fx";
import { actions } from "@/lib/store";
import { LIMITS } from "@/lib/config";
import { C, alpha, useTheme } from "@/lib/theme";
import { ChevronLeft, ChevronRight } from "../icons";
import { Screen } from "../Screen";
import { Sheet } from "../Sheet";
import { Btn, Card, Eyebrow, Press, Reveal, SectionTitle, Stepper, T } from "../ui";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const COL = "14.2857%";

type CellKind = "logged" | "predicted" | "fertile" | "ovulation" | "";

function kindOf(mk: DayMark | undefined): CellKind {
  return mk?.period === "logged"
    ? "logged"
    : mk?.period === "predicted"
      ? "predicted"
      : mk?.ovulation
        ? "ovulation"
        : mk?.fertile
          ? "fertile"
          : "";
}

/** Text colour per cell kind (globals.css .cal-*). */
const INK: Record<CellKind, string> = {
  logged: "#fff",
  predicted: C.berry,
  fertile: "#a86a00",
  ovulation: "#fff",
  "": C.ink,
};

/** The coloured fill behind a day (or a legend swatch). */
function CellFill({ kind, id, radius }: { kind: CellKind; id: string; radius: number }) {
  if (!kind) return null;
  if (kind === "predicted") {
    // .cal-period-predicted: diagonal berry-soft stripes + a 1.5px soft berry inset ring.
    const pid = `stripes-${id}`;
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}>
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id={pid} patternUnits="userSpaceOnUse" width={12} height={12} patternTransform="rotate(45)">
              <Rect x={0} y={0} width={6} height={12} fill={C.berrySoft} />
              <Rect x={6} y={0} width={6} height={12} fill="#ffeef3" />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${pid})`} />
        </Svg>
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1.5, borderColor: alpha(C.berry, 0.45) }]} />
      </View>
    );
  }
  const bg = kind === "logged" ? C.berry : kind === "ovulation" ? C.sun : C.sunSoft;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: bg }]} />;
}

export function CalendarView({ state, info, today }: { state: AppState; info: CycleInfo | null; today: DayKey }) {
  const theme = useTheme();
  const t = fromKey(today);
  const [cursor, setCursor] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const [dir, setDir] = useState(0);
  const [selected, setSelected] = useState<DayKey | null>(null);

  const cells = monthGrid(cursor.y, cursor.m);
  const marks = markDays(state, cells[0].key, cells[cells.length - 1].key, today);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // One animated value per grid cell: they slide in from the swipe direction, staggered
  // (the GSAP `from(".cal-cell", { x: dir * 40, opacity: 0, stagger })`).
  const anims = useRef<Animated.Value[]>([]);
  while (anims.current.length < cells.length) anims.current.push(new Animated.Value(1));

  useLayoutEffect(() => {
    if (reducedMotion()) return;
    const vals = anims.current.slice(0, cells.length);
    vals.forEach((v) => v.setValue(0));
    const ordered = dir < 0 ? [...vals].reverse() : vals;
    const anim = Animated.stagger(
      8,
      ordered.map((v) => Animated.timing(v, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true })),
    );
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.y, cursor.m]);

  const shift = (d: number) => {
    buzz(6);
    setDir(d);
    setCursor(({ y, m }) => {
      const n = new Date(y, m + d, 1);
      return { y: n.getFullYear(), m: n.getMonth() };
    });
  };
  const shiftRef = useRef(shift);
  shiftRef.current = shift;

  // Horizontal swipe on the calendar card changes month (the web's pointerdown/up dx > 60).
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 60) shiftRef.current(g.dx < 0 ? 1 : -1);
      },
    }),
  ).current;

  useEffect(() => () => anims.current.forEach((v) => v.stopAnimation()), []);

  const avg = averageCycleLength(state.periods);
  const recent = [...state.periods].reverse().slice(0, 6);

  return (
    <Screen contentContainerStyle={{ gap: 24 }}>
      <Reveal delay={0} style={{ paddingTop: 8 }}>
        <T size={14} weight={600} soft>
          Your cycle calendar
        </T>
        <T v="display" size={28} style={{ lineHeight: 34 }}>
          Calendar
        </T>
      </Reveal>

      <Reveal delay={80}>
        <View {...swipe.panHandlers}>
          <Card pad={16}>
            <View style={styles.navRow}>
              <Press onPress={() => shift(-1)} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Previous month">
                <ChevronLeft size={20} />
              </Press>
              <Press
                accessibilityRole="button"
                onPress={() => {
                  setDir(0);
                  setCursor({ y: t.getFullYear(), m: t.getMonth() });
                }}
              >
                <T v="display" size={20}>
                  {monthLabel}
                </T>
              </Press>
              <Press onPress={() => shift(1)} style={styles.navBtn} accessibilityRole="button" accessibilityLabel="Next month">
                <ChevronRight size={20} />
              </Press>
            </View>

            <View style={styles.grid}>
              {WEEKDAYS.map((d, i) => (
                <View key={i} style={{ width: COL, paddingBottom: 4 }}>
                  <T size={11} weight={700} soft center>
                    {d}
                  </T>
                </View>
              ))}
              {cells.map(({ key, inMonth }, i) => {
                const kind = kindOf(marks.get(key));
                const ink = INK[kind];
                const v = anims.current[i];
                return (
                  <Animated.View
                    key={key}
                    style={{
                      width: COL,
                      padding: 3,
                      opacity: v,
                      transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dir * 40, 0] }) }],
                    }}
                  >
                    <Press
                      onPress={() => setSelected(key)}
                      scaleTo={0.92}
                      accessibilityRole="button"
                      accessibilityLabel={fmtLong(key)}
                      style={[styles.cell, !inMonth && { opacity: 0.3 }]}
                    >
                      <CellFill kind={kind} id={key} radius={14} />
                      <T weight={600} size={15} color={ink}>
                        {fromKey(key).getDate()}
                      </T>
                      {state.logs[key]?.pain !== undefined && (
                        <View style={[styles.painDot, { backgroundColor: ink }]} />
                      )}
                      {key === today && <View pointerEvents="none" style={styles.todayRing} />}
                    </Press>
                  </Animated.View>
                );
              })}
            </View>

            <View style={styles.legend}>
              <Legend kind="logged" label="Period" />
              <Legend kind="predicted" label="Predicted" />
              <Legend kind="fertile" label="Fertile" />
              <Legend kind="ovulation" label="Ovulation" />
            </View>
          </Card>
        </View>
      </Reveal>

      <Reveal delay={160} style={{ flexDirection: "row", gap: 12 }}>
        <Card pad={16} style={{ flex: 1 }}>
          <Eyebrow>Next period</Eyebrow>
          <T v="display" size={24} color={C.berry} style={{ marginTop: 4 }}>
            {info ? fmtShort(info.nextStart) : "—"}
          </T>
          <T size={12} soft>
            {info ? (info.daysUntilNext >= 0 ? `in ${info.daysUntilNext} days` : `${-info.daysUntilNext} days late`) : "log a period first"}
          </T>
        </Card>
        <Card pad={16} style={{ flex: 1 }}>
          <Eyebrow>Avg. cycle</Eyebrow>
          <T v="display" size={24} color={C.lilac} style={{ marginTop: 4 }}>
            {avg ?? state.settings.cycleLength} days
          </T>
          <T size={12} soft>
            {avg ? `from ${state.periods.length} periods` : "using your setting"}
          </T>
        </Card>
      </Reveal>

      <Reveal delay={240}>
        <Card pad={20}>
          <SectionTitle>Your rhythm</SectionTitle>
          <View style={{ gap: 16 }}>
            <View style={{ alignItems: "center", gap: 4 }}>
              <T size={14} weight={600} soft>
                Cycle length
              </T>
              <Stepper
                value={state.settings.cycleLength}
                {...LIMITS.cycleLength}
                unit="days"
                onChange={(v) => actions.updateSettings({ cycleLength: v })}
              />
            </View>
            <View style={{ alignItems: "center", gap: 4 }}>
              <T size={14} weight={600} soft>
                Period length
              </T>
              <Stepper
                value={state.settings.periodLength}
                {...LIMITS.periodLength}
                unit="days"
                onChange={(v) => actions.updateSettings({ periodLength: v })}
              />
            </View>
          </View>
          {avg && avg !== state.settings.cycleLength ? (
            <Press
              accessibilityRole="button"
              style={{ marginTop: 12, width: "100%" }}
              onPress={() => actions.updateSettings({ cycleLength: avg })}
            >
              <T size={12} weight={600} center color={theme.accent} style={{ textDecorationLine: "underline" }}>
                Your logged average is {avg} days. Use that?
              </T>
            </Press>
          ) : null}
        </Card>
      </Reveal>

      {recent.length > 0 && (
        <Reveal delay={320}>
          <SectionTitle>Recent periods</SectionTitle>
          <Card pad={0} style={{ paddingHorizontal: 16 }}>
            {recent.map((p, i) => {
              const idx = state.periods.indexOf(p);
              const next = state.periods[idx + 1];
              const len = diffDays(periodEndOf(p, state.settings.periodLength), p.start) + 1;
              return (
                <View key={p.start} style={[styles.recentRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                  <View>
                    <T weight={600}>{fmt(p.start, { day: "numeric", month: "short", year: "numeric" })}</T>
                    <T size={12} soft>
                      {len} day{len === 1 ? "" : "s"}
                      {!p.end && " (estimated)"}
                    </T>
                  </View>
                  <View style={styles.pill}>
                    <T size={12} weight={700} color={C.lilac}>
                      {next ? `${diffDays(next.start, p.start)}-day cycle` : "current"}
                    </T>
                  </View>
                </View>
              );
            })}
          </Card>
        </Reveal>
      )}

      <DaySheet day={selected} state={state} today={today} onClose={() => setSelected(null)} />
    </Screen>
  );
}

function Legend({ kind, label }: { kind: CellKind; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 14, height: 14 }}>
        <CellFill kind={kind} id={`legend-${kind}`} radius={5} />
      </View>
      <T size={11} weight={600} soft>
        {label}
      </T>
    </View>
  );
}

function DaySheet({ day, state, today, onClose }: { day: DayKey | null; state: AppState; today: DayKey; onClose: () => void }) {
  // Keep showing the last day while the sheet animates out.
  const [shown, setShown] = useState<DayKey | null>(day);
  if (day && day !== shown) setShown(day);
  const d = day ?? shown;
  const startRef = useRef<ViewInstance>(null);
  const endRef = useRef<ViewInstance>(null);

  let body = null;
  if (d) {
    const marks = markDays(state, d, d, today).get(d);
    const period = state.periods.find((p) => d >= p.start && d <= periodEndOf(p, state.settings.periodLength));
    const isStart = period?.start === d;
    // Allow extending a period by up to a week past its current end, no further.
    const prev = lastPeriodOnOrBefore(state.periods, d);
    const canEnd =
      !isStart &&
      (Boolean(period) ||
        (prev !== undefined &&
          diffDays(d, periodEndOf(prev, state.settings.periodLength)) <= 7 &&
          diffDays(d, prev.start) <= 14));
    const log = state.logs[d];
    const future = d > today;

    const status = period
      ? `Period day ${diffDays(d, period.start) + 1}${period.end ? "" : " (estimated)"}`
      : marks?.period === "predicted"
        ? "Predicted period 🌙"
        : marks?.ovulation
          ? "Predicted ovulation 🌟"
          : marks?.fertile
            ? "Fertile window ✨"
            : "A regular, lovely day";

    const act = (ref: RefObject<ViewInstance | null>, fn: () => void) => () => {
      buzz([15, 30, 15]);
      burst(ref, ["💗", "✨", "🌙"], 10);
      fn();
      onClose();
    };

    body = (
      <View style={{ gap: 16 }}>
        <Card pad={16}>
          <Eyebrow>Status</Eyebrow>
          <T v="display" size={20} style={{ marginTop: 4 }}>
            {status}
          </T>
          {log && (log.pain !== undefined || log.moods?.length) ? (
            <T size={14} soft style={{ marginTop: 8 }}>
              {log.pain !== undefined && `Pain ${log.pain}/10`}
              {log.pain !== undefined && log.moods?.length ? " · " : ""}
              {log.moods?.map((m) => (MOODS[m] ? `${MOODS[m].emoji} ${MOODS[m].label}` : m)).join(", ")}
            </T>
          ) : null}
        </Card>

        {future ? (
          <View style={styles.futureNote}>
            <T size={14} soft center>
              Can't log the future. Yet. {state.settings.partnerName} is working on it. 🛠️
            </T>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {!period && (
              <View ref={startRef} collapsable={false}>
                <Btn onPress={act(startRef, () => actions.startPeriod(d))}>🌙 Period started this day</Btn>
              </View>
            )}
            {canEnd && (
              <View ref={endRef} collapsable={false}>
                <Btn kind="soft" onPress={act(endRef, () => actions.endPeriod(d))}>
                  ✅ This was the last period day
                </Btn>
              </View>
            )}
            {isStart && (
              <Btn
                kind="ghost"
                textStyle={{ color: C.berry }}
                onPress={() => {
                  actions.removePeriod(d);
                  onClose();
                }}
              >
                Remove this period
              </Btn>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <Sheet open={Boolean(day)} onClose={onClose} eyebrow="Day details" title={d ? fmtLong(d) : ""}>
      {body}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  navRow: { marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  cell: { aspectRatio: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  painDot: { position: "absolute", bottom: 4, width: 4, height: 4, borderRadius: 2, opacity: 0.7 },
  todayRing: {
    position: "absolute",
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: C.ink,
  },
  legend: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 8 },
  recentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  pill: { borderRadius: 999, backgroundColor: C.lilacSoft, paddingHorizontal: 12, paddingVertical: 4 },
  futureNote: { borderRadius: 24, backgroundColor: C.card, padding: 16 },
});
