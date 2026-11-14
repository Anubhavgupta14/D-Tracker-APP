import { File, Paths } from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewInstance,
} from "react-native";
import { PEOPLE } from "@/lib/config";
import type { AppState, CycleInfo } from "@/lib/cycle";
import { telLink } from "@/lib/cheer";
import type { DayKey } from "@/lib/dates";
import { buzz, reducedMotion } from "@/lib/fx";
import { buildContext, clearChat, sendMessage, useChat, type Msg } from "@/lib/jarvis/agent";
import {
  canListen,
  isSpeaking,
  listen,
  onSpeakingChange,
  say,
  stopListening,
  stopSpeaking,
  unlockAudio,
} from "@/lib/jarvis/voice";
import { FONT } from "@/lib/theme";
import { DatePlanCard } from "../jarvis/DatePlanCard";
import { Orb, type OrbState } from "../jarvis/Orb";
import { Screen } from "../Screen";
import { Press, Reveal, T, type ToolId } from "../ui";

const SUGGESTIONS = [
  "Plan a cozy date",
  "I want chocolates 🍫",
  "Call the Engineer",
  "I have cramps, help",
  "Tell him I miss him",
  "What's my cycle looking like?",
];

/* Prefs live in a small JSON file (the web's localStorage "d-tracker:jarvis-prefs"). */
type Prefs = { voice: boolean; handsFree: boolean };

function prefsFile(): File | null {
  try {
    return new File(Paths.document, "jarvis-prefs.json");
  } catch {
    return null;
  }
}

function readPrefs(): Prefs {
  try {
    const f = prefsFile();
    const saved = JSON.parse(f?.exists ? f.textSync() : "{}") as {
      voice?: boolean;
      handsFree?: boolean;
      v?: number;
    };
    // v2 turns follow-up listening on. Older saves had it off only because that was the default.
    if (saved.v !== 2) return { voice: saved.voice ?? true, handsFree: true };
    return { voice: saved.voice ?? true, handsFree: saved.handsFree ?? true };
  } catch {
    return { voice: true, handsFree: true };
  }
}

function writePrefs(p: Prefs) {
  try {
    const f = prefsFile();
    if (!f) return;
    if (!f.exists) f.create({ intermediates: true });
    f.write(JSON.stringify({ ...p, v: 2 })).catch(() => {});
  } catch {
    /* ignore */
  }
}

export function JarvisView({
  state,
  info,
  today,
  openTool,
}: {
  state: AppState;
  info: CycleInfo | null;
  today: DayKey;
  openTool: (t: ToolId) => void;
}) {
  const scroller = useRef<ScrollViewInstance>(null);
  const chat = useChat();
  const speaking = useSyncExternalStore(onSpeakingChange, isSpeaking, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [draft, setDraft] = useState("");
  const [micError, setMicError] = useState("");
  const [focused, setFocused] = useState(false);
  const [prefs, setPrefs] = useState(readPrefs);
  const prefsRef = useRef(prefs);
  const mounted = useRef(true);
  const listeningRef = useRef(false);
  const listenGen = useRef(0);

  useEffect(() => {
    prefsRef.current = prefs;
    writePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopListening();
    };
  }, []);

  // Follow the conversation.
  const count = chat.msgs.length;
  useEffect(() => {
    if (!count) return;
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [count, chat.status]);

  const orbState: OrbState = listening ? "listening" : chat.busy ? "thinking" : speaking ? "speaking" : "idle";

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || chat.busy) return;
    unlockAudio();
    stopSpeaking();
    setDraft("");
    buzz(8);
    void sendMessage(t, buildContext(state, info, today), {
      phone: state.settings.partnerPhone,
      openTool: (tool) => openTool(tool),
      onReply: async (reply) => {
        if (!prefsRef.current.voice) return;
        await say(reply);
        if (!prefsRef.current.handsFree || !mounted.current || isSpeaking()) return;
        // Let the speaker fade so the mic doesn't pick his own voice back up.
        await new Promise((r) => setTimeout(r, 450));
        if (!prefsRef.current.handsFree || !mounted.current || isSpeaking()) return;
        void talk();
      },
    });
  };

  async function talk() {
    unlockAudio();
    setMicError("");
    if (isSpeaking()) stopSpeaking();
    if (listeningRef.current) {
      listenGen.current++;
      stopListening();
      listeningRef.current = false;
      setListening(false);
      setInterim("");
      return;
    }
    if (!canListen()) {
      setMicError("Voice input isn't supported on this phone. Type instead, Miss Dhruvi.");
      return;
    }
    const gen = ++listenGen.current;
    buzz(15);
    listeningRef.current = true;
    setListening(true);
    setInterim("");
    try {
      const heard = await listen(setInterim);
      if (gen === listenGen.current && heard) submit(heard);
    } catch (e) {
      if (gen === listenGen.current) setMicError((e as Error).message);
    } finally {
      if (gen === listenGen.current) {
        listeningRef.current = false;
        setListening(false);
        setInterim("");
      }
    }
  }

  const statusLine = listening
    ? interim || "Listening…"
    : chat.busy
      ? chat.status || "Thinking…"
      : speaking
        ? "Speaking…"
        : chat.msgs.length
          ? "Tap the orb to talk"
          : "";

  const hasPhone = state.settings.partnerPhone.replace(/\D/g, "").length >= 8;

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          ref={scroller}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (count) scroller.current?.scrollToEnd({ animated: true });
          }}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexShrink: 1 }}>
              <T v="display" size={20} style={{ letterSpacing: 6 }}>
                J.A.R.V.I.S.
              </T>
              <T size={12} color="rgba(255,255,255,0.55)">
                Personal assistant to Miss {PEOPLE.her}
              </T>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Toggle
                on={prefs.voice}
                label={prefs.voice ? "Voice on" : "Voice off"}
                onPress={() => {
                  if (prefs.voice) stopSpeaking();
                  setPrefs((p) => ({ ...p, voice: !p.voice }));
                }}
              >
                {prefs.voice ? "🔊" : "🔇"}
              </Toggle>
              <Toggle
                on={prefs.handsFree}
                label="Conversation mode: listens after each reply, then stops if it's quiet"
                onPress={() => setPrefs((p) => ({ ...p, handsFree: !p.handsFree }))}
              >
                ∞
              </Toggle>
              {chat.msgs.length > 0 && (
                <Toggle on={false} label="Clear conversation" onPress={() => !chat.busy && clearChat()}>
                  ⟲
                </Toggle>
              )}
            </View>
          </View>

          {/* Orb */}
          <View style={[styles.orbWrap, chat.msgs.length ? { paddingTop: 12, paddingBottom: 8 } : { paddingTop: 40, paddingBottom: 16 }]}>
            <Orb state={orbState} size={chat.msgs.length ? 150 : 240} onClick={talk} />
            <T size={14} weight={500} center color="rgba(255,255,255,0.7)" style={styles.status}>
              {statusLine}
            </T>
            {!!micError && (
              <T size={12} center color="#ff8fbf" style={{ marginTop: 4 }}>
                {micError}
              </T>
            )}
          </View>

          {/* Empty state */}
          {chat.msgs.length === 0 && (
            <View style={{ alignItems: "center" }}>
              <T v="display" size={24} center style={{ lineHeight: 31 }}>
                {`At your service,\nMiss ${PEOPLE.her}.`}
              </T>
              <T size={14} center color="rgba(255,255,255,0.6)" style={{ marginTop: 8, maxWidth: 300 }}>
                Tap the orb and talk to me. Plans, cravings, feelings, or a direct line to {PEOPLE.him}.
              </T>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <Press key={s} scaleTo={0.95} onPress={() => submit(s)} accessibilityRole="button" style={styles.suggestion}>
                    <T size={14} weight={500} color="rgba(255,255,255,0.85)">
                      {s}
                    </T>
                  </Press>
                ))}
              </View>
            </View>
          )}

          {/* Conversation */}
          <View style={{ gap: 12 }}>
            {chat.msgs.map((m) => (
              <Reveal key={m.id} from={18}>
                <Message
                  m={m}
                  hasPhone={hasPhone}
                  phone={state.settings.partnerPhone}
                  onSend={submit}
                  onSpeak={(t) => {
                    unlockAudio();
                    void say(t);
                  }}
                />
              </Reveal>
            ))}
          </View>
        </ScrollView>

        {/* Composer */}
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={chat.busy ? "Jarvis is working…" : "Type to Jarvis…"}
            placeholderTextColor="rgba(255,255,255,0.4)"
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={() => submit(draft)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            selectionColor="#8fe9ff"
            style={[styles.input, focused && { borderColor: "rgba(143,233,255,0.6)" }]}
          />
          {draft.trim() ? (
            <Press
              onPress={() => submit(draft)}
              disabled={chat.busy}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={[styles.round, { backgroundColor: "#ff6fa5" }, chat.busy && { opacity: 0.5 }]}
            >
              <T size={18} weight={700}>
                ➤
              </T>
            </Press>
          ) : (
            <Press
              onPress={talk}
              accessibilityRole="button"
              accessibilityLabel={listening ? "Stop listening" : "Speak"}
              style={[styles.round, { overflow: "hidden" }, listening && { backgroundColor: "#ff5c93" }]}
            >
              {!listening && (
                <LinearGradient colors={["#8fe9ff", "#4f9dff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              )}
              <T size={20} color={listening ? "#ffffff" : "#0d0a1a"}>
                {listening ? "■" : "🎙"}
              </T>
            </Press>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Toggle({ on, label, onPress, children }: { on: boolean; label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={[
        styles.toggle,
        on
          ? { borderColor: "rgba(143,233,255,0.6)", backgroundColor: "rgba(143,233,255,0.15)" }
          : { borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.05)" },
      ]}
    >
      <T size={16} color={on ? "#8fe9ff" : "rgba(255,255,255,0.7)"}>
        {children}
      </T>
    </Press>
  );
}

/** The pulsing amber dot of a running tool step (Tailwind animate-ping). */
function Ping() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion()) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1000, easing: Easing.bezier(0, 0, 0.2, 1), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ width: 8, height: 8 }}>
      <Animated.View
        style={[
          styles.pingDot,
          {
            opacity: v.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 2, 2] }) }],
          },
        ]}
      />
    </View>
  );
}

function Message({
  m,
  hasPhone,
  phone,
  onSend,
  onSpeak,
}: {
  m: Msg;
  hasPhone: boolean;
  phone: string;
  onSend: (t: string) => void;
  onSpeak: (t: string) => void;
}) {
  switch (m.kind) {
    case "user":
      return (
        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <LinearGradient colors={["#ff6fa5", "#e5487a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.userBubble}>
            <T size={15} style={{ lineHeight: 20 }} selectable>
              {m.text}
            </T>
          </LinearGradient>
        </View>
      );
    case "jarvis":
      return (
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <View style={styles.jarvisBubble}>
            <T size={10} weight={700} color="rgba(143,233,255,0.8)" style={{ marginBottom: 4, letterSpacing: 2 }}>
              JARVIS
            </T>
            <T size={15} color="rgba(255,255,255,0.9)" style={{ lineHeight: 24 }} selectable>
              {m.text}
            </T>
          </View>
          <Press scaleTo={0.9} onPress={() => onSpeak(m.text)} accessibilityRole="button" accessibilityLabel="Say it again" style={{ marginBottom: 4, opacity: 0.4 }}>
            <T>🔈</T>
          </Press>
        </View>
      );
    case "tool":
      return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 4 }}>
          {m.status === "run" ? (
            <Ping />
          ) : (
            <T size={12} style={styles.mono} color={m.status === "ok" ? "#7ff0c0" : "#ff8fbf"}>
              {m.status === "ok" ? "✓" : "✕"}
            </T>
          )}
          <T size={12} color="rgba(255,255,255,0.55)" numberOfLines={1} style={[styles.mono, { flexShrink: 1 }]}>
            {m.label}
            {m.summary ? ` — ${m.summary}` : ""}
          </T>
        </View>
      );
    case "plan":
      return <DatePlanCard plan={m.plan} onSend={() => onSend(`Send this date plan (${m.plan.title}) to ${PEOPLE.him} as a date request.`)} />;
    case "call":
      return (
        <View style={styles.callCard}>
          <View style={styles.callIcon}>
            <T size={24}>📞</T>
          </View>
          <View style={{ flex: 1 }}>
            <T weight={600}>Calling The Engineer</T>
            <T size={12} color="rgba(255,255,255,0.6)">
              {m.reason ?? "Direct line, priority one."}
            </T>
          </View>
          {hasPhone && (
            <Press
              onPress={() => void Linking.openURL(telLink(phone)).catch(() => {})}
              accessibilityRole="button"
              style={{ borderRadius: 999, backgroundColor: "#7ff0c0", paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <T size={14} weight={700} color="#0d0a1a">
                Call
              </T>
            </Press>
          )}
        </View>
      );
    case "error":
      return (
        <View style={styles.errorBox}>
          <T size={14} color="#ffb3cf">
            {m.text}
          </T>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 8 },
  toggle: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  orbWrap: { alignItems: "center" },
  status: { marginTop: 16, minHeight: 24, maxWidth: 320 },
  suggestions: { marginTop: 24, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  suggestion: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  composer: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(27,21,48,0.9)",
    paddingHorizontal: 20,
    color: "#ffffff",
    fontFamily: FONT.body,
    fontSize: 15,
  },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  userBubble: {
    maxWidth: "82%",
    borderRadius: 22,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  jarvisBubble: {
    maxWidth: "86%",
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mono: { fontFamily: "monospace" },
  pingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ffd27a" },
  callCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(127,240,192,0.3)",
    backgroundColor: "rgba(127,240,192,0.1)",
    padding: 16,
  },
  callIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(127,240,192,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: { borderRadius: 16, backgroundColor: "rgba(255,92,147,0.15)", paddingHorizontal: 16, paddingVertical: 12 },
});
