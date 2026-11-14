import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import Svg, { Ellipse } from "react-native-svg";
import { buzz, burst } from "@/lib/fx";
import { actions } from "@/lib/store";
import { C } from "@/lib/theme";
import { CrampBlob } from "../illustrations";
import { Btn, Card, Eyebrow, T } from "../ui";

const ROUND_MS = 25_000;
const HOLES = 9;
const TICK = 80;

interface Hole {
  kind: "cramp" | "golden" | null;
  up: boolean;
  squished: boolean;
  expiresAt: number;
}

interface Game {
  phase: "idle" | "playing" | "done";
  startedAt: number;
  now: number;
  nextSpawn: number;
  score: number;
  holes: Hole[];
}

const emptyHoles = (): Hole[] =>
  Array.from({ length: HOLES }, () => ({ kind: null, up: false, squished: false, expiresAt: 0 }));

const idle = (): Game => ({ phase: "idle", startedAt: 0, now: 0, nextSpawn: 0, score: 0, holes: emptyHoles() });

const RANKS = [
  { min: 0, title: "Cramp Intern", line: "Everyone starts somewhere. Even the cramps feel a bit sorry for you." },
  { min: 8, title: "Junior Cramp Physio", line: "Solid technique. Cramps have been referred elsewhere." },
  { min: 18, title: "Senior Cramp Specialist", line: "Cramps are filing complaints about you. Excellent." },
  { min: 28, title: "HOD, Dept. of Cramp Destruction", line: "Legendary. The cramps have unionised and gone on strike." },
];

/** Advance the game by one tick: expire, spawn, and finish when time runs out. */
function step(g: Game, now: number): Game {
  if (g.phase !== "playing") return g;
  const elapsed = now - g.startedAt;
  if (elapsed >= ROUND_MS) return { ...g, now, phase: "done", holes: emptyHoles() };

  const progress = elapsed / ROUND_MS;
  const holes = g.holes.map((h) => {
    if (h.kind && h.up && now >= h.expiresAt) return { ...h, up: false, expiresAt: now + 180 };
    if (h.kind && !h.up && now >= h.expiresAt) return { ...h, kind: null, squished: false };
    return h;
  });

  let nextSpawn = g.nextSpawn;
  if (now >= nextSpawn) {
    const free = holes.map((h, i) => (h.kind ? -1 : i)).filter((i) => i >= 0);
    const count = progress > 0.55 && Math.random() < 0.45 ? 2 : 1;
    for (let c = 0; c < count && free.length; c++) {
      const pick = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      holes[pick] = {
        kind: Math.random() < 0.12 ? "golden" : "cramp",
        up: true,
        squished: false,
        expiresAt: now + 1050 - progress * 450,
      };
    }
    nextSpawn = now + 760 - progress * 360;
  }
  return { ...g, now, holes, nextSpawn };
}

const BOARD_PAD = 16;
const GAP = 12;

/** One hole: the blob slides up/down (the web's 150ms translateY transition). */
function HoleView({ hole, size, onPressIn }: { hole: Hole; size: number; onPressIn: (e: GestureResponderEvent) => void }) {
  const visible = !!hole.kind && hole.up;
  const v = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: visible ? 1 : 0, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [visible, v]);
  const blobH = size - 12 - 4;
  return (
    <Pressable
      onPressIn={onPressIn}
      accessibilityRole="button"
      accessibilityLabel={visible ? "Squish the cramp!" : "Empty hole"}
      style={{ width: size, height: size, borderRadius: 22, overflow: "hidden" }}
    >
      <Svg pointerEvents="none" width={size - 8} height={size / 3} style={{ position: "absolute", left: 4, bottom: 4 }}>
        <Ellipse cx={(size - 8) / 2} cy={size / 6} rx={(size - 8) / 2} ry={size / 6} fill="#6a4fb8" fillOpacity={0.25} />
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          bottom: 4,
          top: 12,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [blobH * 1.1, 0] }) }],
        }}
      >
        {hole.kind && <CrampBlob squished={hole.squished} golden={hole.kind === "golden"} />}
      </Animated.View>
    </Pressable>
  );
}

export function CrampCrusher({ best }: { best: number }) {
  const [game, setGame] = useState<Game>(idle);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const bump = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (game.phase !== "playing") return;
    const id = setInterval(() => setGame((g) => step(g, Date.now())), TICK);
    return () => clearInterval(id);
  }, [game.phase]);

  useEffect(() => {
    if (game.phase === "done") {
      actions.recordCrushScore(game.score);
      buzz([30, 60, 30, 60, 60]);
    }
  }, [game.phase, game.score]);

  const bumpScore = () => {
    bump.setValue(1.35);
    Animated.spring(bump, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 14 }).start();
  };

  const start = () => {
    const now = Date.now();
    setGame({ ...idle(), phase: "playing", startedAt: now, now, nextSpawn: now + 400 });
  };

  const whack = (i: number, e: GestureResponderEvent) => {
    const h = game.holes[i];
    if (!h.kind || !h.up || h.squished || game.phase !== "playing") return;
    const golden = h.kind === "golden";
    buzz(golden ? [15, 30, 15] : 12);
    burst({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }, golden ? ["⭐", "✨", "💛"] : ["💥", "✨"], golden ? 10 : 6);
    bumpScore();
    setGame((g) => {
      const holes = g.holes.slice();
      holes[i] = { ...holes[i], squished: true, up: true, expiresAt: Date.now() + 260 };
      return { ...g, holes, score: g.score + (golden ? 3 : 1) };
    });
  };

  const timeLeft = game.phase === "playing" ? Math.max(0, ROUND_MS - (game.now - game.startedAt)) : ROUND_MS;
  const rank = [...RANKS].reverse().find((r) => game.score >= r.min)!;

  // Square holes that fit the space the sheet gives the playfield.
  const cell = Math.max(0, Math.floor(Math.min(area.w - BOARD_PAD * 2 - GAP * 2, area.h - BOARD_PAD * 2 - GAP * 2) / 3));
  const board = cell * 3 + GAP * 2 + BOARD_PAD * 2;

  return (
    <View style={{ flex: 1, paddingBottom: 16 }}>
      <View style={{ marginBottom: 16, flexDirection: "row", gap: 8 }}>
        <Card pad={10} style={styles.stat}>
          <Eyebrow>Score</Eyebrow>
          <Animated.View style={{ transform: [{ scale: bump }] }}>
            <T v="display" size={30} color={C.lilac}>
              {game.score}
            </T>
          </Animated.View>
        </Card>
        <Card pad={10} style={styles.stat}>
          <Eyebrow>Time</Eyebrow>
          <T v="display" size={30} style={{ fontVariant: ["tabular-nums"] }}>
            {Math.ceil(timeLeft / 1000)}
          </T>
        </Card>
        <Card pad={10} style={styles.stat}>
          <Eyebrow>Best</Eyebrow>
          <T v="display" size={30}>
            {Math.max(best, game.phase === "done" ? game.score : 0)}
          </T>
        </Card>
      </View>

      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {cell > 0 && (
          <View style={{ width: board, height: board }}>
            <View style={styles.board}>
              <LinearGradient colors={[C.lilacSoft, "#ffffff"]} style={StyleSheet.absoluteFill} />
              {game.holes.map((h, i) => (
                <HoleView key={i} hole={h} size={cell} onPressIn={(e) => whack(i, e)} />
              ))}
            </View>

            {game.phase !== "playing" && (
              <View style={styles.overlay}>
                {game.phase === "idle" ? (
                  <View style={{ alignItems: "center" }}>
                    <T v="display" size={24} center>
                      Cramp Crusher
                    </T>
                    <T size={14} soft center style={{ marginTop: 8 }}>
                      Squish the grumpy cramps before they hide. Golden ones are worth 3. You have 25 seconds.
                    </T>
                    <Btn style={{ marginTop: 20 }} onPress={start}>
                      Let's squish 👊
                    </Btn>
                  </View>
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <Eyebrow>You crushed {game.score} cramps</Eyebrow>
                    <T v="display" size={24} center style={{ marginTop: 4 }}>
                      {rank.title}
                    </T>
                    <T size={14} soft center style={{ marginTop: 8 }}>
                      {rank.line}
                    </T>
                    <Btn style={{ marginTop: 20 }} onPress={start}>
                      Again!
                    </Btn>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
      <T size={12} soft center style={{ marginTop: 16 }}>
        No real cramps were harmed. Unfortunately.
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, alignItems: "center", paddingVertical: 10 },
  board: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    padding: BOARD_PAD,
    borderRadius: 28,
    overflow: "hidden",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.8)",
    padding: 24,
  },
});
