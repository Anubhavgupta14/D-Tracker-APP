import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Alert, Animated, Easing, Linking, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { buzz, reducedMotion } from "@/lib/fx";
import {
  OCCASIONS,
  PROFILE_FIELDS,
  compressImage,
  glow,
  type Analysis,
  type Difficulty,
  type GlowProfile,
  type Look,
  type Trend,
  type Tutorial,
} from "@/lib/glow";
import { C, useTheme } from "@/lib/theme";
import { Markdown } from "../Markdown";
import { Screen } from "../Screen";
import { Sheet } from "../Sheet";
import { SparkleIcon } from "../icons";
import { Btn, Card, Chip, Eyebrow, Field, Press, Reveal, SectionTitle, T } from "../ui";

/* ---------------------------------------------------------------
   Module store: keeps results across tab switches so we don't
   re-spend Gemini quota every time she reopens the tab.
   --------------------------------------------------------------- */
interface GlowCache {
  profile: GlowProfile;
  saved: Look[];
  trend?: Trend;
  looks: Record<string, Look[]>;
  loaded: boolean;
}
let gstate: GlowCache = { profile: {}, saved: [], looks: {}, loaded: false };
const glisteners = new Set<() => void>();
const gget = () => gstate;
function gset(patch: Partial<GlowCache>) {
  gstate = { ...gstate, ...patch };
  glisteners.forEach((l) => l());
}
function useGlow(): GlowCache {
  return useSyncExternalStore(
    (cb) => {
      glisteners.add(cb);
      return () => glisteners.delete(cb);
    },
    gget,
    gget,
  );
}

const DIFF: Record<Difficulty, { label: string; bg: string; fg: string }> = {
  easy: { label: "Easy", bg: C.mintSoft, fg: C.mint },
  medium: { label: "Medium", bg: C.sunSoft, fg: "#a86a00" },
  glam: { label: "Glam", bg: C.lilacSoft, fg: C.lilac },
};

type PhotoKind = "recreate" | "analyze";

/** Stagger step for the section entrance (GSAP stagger 0.07s). */
const STEP = 70;

export function GlowView() {
  const theme = useTheme();
  const data = useGlow();

  const [occasion, setOccasion] = useState("everyday");
  const [loadingLooks, setLoadingLooks] = useState(false);
  const [trendBusy, setTrendBusy] = useState(false);
  const [error, setError] = useState("");

  const [profileOpen, setProfileOpen] = useState(false);
  const [activeLook, setActiveLook] = useState<Look | null>(null);
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [tutorialBusy, setTutorialBusy] = useState(false);
  const [tutorialIntro, setTutorialIntro] = useState("");

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [photoBusy, setPhotoBusy] = useState<PhotoKind | null>(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [askBusy, setAskBusy] = useState(false);

  // First load: profile + saved looks, then today's trend.
  useEffect(() => {
    if (data.loaded) return;
    let alive = true;
    (async () => {
      try {
        const s = await glow.state();
        if (!alive) return;
        gset({ profile: s.profile, saved: s.saved, loaded: true });
        const { trend } = await glow.trends();
        if (alive) gset({ trend });
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [data.loaded]);

  const refreshTrend = async () => {
    setTrendBusy(true);
    setError("");
    try {
      const { trend } = await glow.trends();
      gset({ trend });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTrendBusy(false);
    }
  };

  const loadLooks = async (id: string, force = false) => {
    if (!force && gget().looks[id]?.length) return;
    setLoadingLooks(true);
    setError("");
    try {
      const { looks } = await glow.looks(id);
      gset({ looks: { ...gget().looks, [id]: looks } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingLooks(false);
    }
  };

  const chooseOccasion = (id: string) => {
    buzz(8);
    setOccasion(id);
    void loadLooks(id);
  };

  const openTutorial = async (look: Look) => {
    buzz(10);
    setActiveLook(look);
    setTutorial(null);
    setTutorialIntro("");
    setTutorialBusy(true);
    try {
      const { tutorial } = await glow.tutorial(look);
      setTutorial(tutorial);
    } catch (e) {
      setError((e as Error).message);
      setActiveLook(null);
    } finally {
      setTutorialBusy(false);
    }
  };

  const toggleSave = async (look: Look) => {
    buzz(8);
    const has = gget().saved.some((l) => l.id === look.id);
    gset({ saved: has ? gget().saved.filter((l) => l.id !== look.id) : [look, ...gget().saved] });
    try {
      if (has) await glow.removeLook(look.id);
      else await glow.saveLook(look);
    } catch {
      /* best effort; UI already updated */
    }
  };

  const onPhoto = async (asset: ImagePicker.ImagePickerAsset | undefined, kind: PhotoKind) => {
    if (!asset) return;
    setError("");
    setPhotoBusy(kind);
    try {
      const image = await compressImage(asset.uri, { width: asset.width, height: asset.height });
      if (kind === "recreate") {
        const { intro, tutorial } = await glow.recreate(image);
        setActiveLook({ id: "photo", name: "Your inspo look" } as Look);
        setTutorialIntro(intro);
        setTutorial(tutorial);
      } else {
        const { analysis } = await glow.analyze(image);
        setAnalysis(analysis);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhotoBusy(null);
    }
  };

  /** The web's <input type=file accept=image/*> — the system photo picker (no permission needed). */
  const fromLibrary = async (kind: PhotoKind) => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (!res.canceled) void onPhoto(res.assets[0], kind);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  /** The web's capture="user" — front camera. */
  const fromCamera = async (kind: PhotoKind) => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError("Camera access is off — allow it in Settings, or pick a photo instead.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        cameraType: ImagePicker.CameraType.front,
        quality: 1,
      });
      if (!res.canceled) void onPhoto(res.assets[0], kind);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const pickInspo = () => void fromLibrary("recreate");
  // "Take or pick a selfie": on the web the browser offers camera or gallery; here we ask.
  const pickSelfie = () =>
    Alert.alert("What suits me?", undefined, [
      { text: "Take a selfie", onPress: () => void fromCamera("analyze") },
      { text: "Pick a photo", onPress: () => void fromLibrary("analyze") },
      { text: "Cancel", style: "cancel" },
    ]);

  const ask = async () => {
    const q = question.trim();
    if (!q || askBusy) return;
    setAskBusy(true);
    setAnswer("");
    setError("");
    try {
      await glow.ask(q, (full) => setAnswer(full));
      setQuestion("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAskBusy(false);
    }
  };

  const hasProfile = Object.values(data.profile).some(Boolean);
  const savedIds = new Set(data.saved.map((l) => l.id));
  const looks = data.looks[occasion] ?? [];

  let n = 0;
  const next = () => n++ * STEP;

  return (
    <Screen>
      <View style={{ gap: 24, paddingBottom: 24 }}>
        <Reveal delay={next()} style={s.header}>
          <View>
            <T size={14} weight={600} soft>
              Your beauty studio
            </T>
            <T v="display" size={28} style={{ lineHeight: 35 }}>
              Glow ✨
            </T>
          </View>
          <Press onPress={() => setProfileOpen(true)} style={[s.pill, { backgroundColor: theme.accentSoft, paddingHorizontal: 16, paddingVertical: 8 }]}>
            <T size={14} weight={700} color={theme.accent}>
              {hasProfile ? "Your profile" : "Set profile"}
            </T>
          </Press>
        </Reveal>

        {!hasProfile && (
          <Reveal delay={next()}>
            <Press onPress={() => setProfileOpen(true)}>
              <Card pad={16}>
                <T weight={600}>✨ Tell me about your skin</T>
                <T size={14} soft style={{ marginTop: 2 }}>
                  Tone, undertone and type — so every look is made for you.
                </T>
              </Card>
            </Press>
          </Reveal>
        )}

        {!!error && (
          <Reveal delay={next()}>
            <View style={s.error}>
              <T size={14} weight={500} color={C.berry} center>
                {error}
              </T>
            </View>
          </Reveal>
        )}

        {/* Trending now */}
        <Reveal delay={next()}>
          <Card>
            <View style={s.rowBetween}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <SparkleIcon size={14} color={theme.accent} />
                <Eyebrow>Trending now</Eyebrow>
              </View>
              <Pressable onPress={refreshTrend} disabled={trendBusy} hitSlop={10} style={trendBusy && { opacity: 0.5 }}>
                <T size={12} weight={700} color={theme.accent}>
                  {trendBusy ? "…" : "Refresh"}
                </T>
              </Pressable>
            </View>
            {data.trend ? (
              <>
                <Markdown text={data.trend.summary} style={{ marginTop: 8 }} />
                <View style={{ marginTop: 12, gap: 6 }}>
                  {data.trend.highlights.map((h, i) => (
                    <Sparkled key={i} text={h} />
                  ))}
                </View>
                {data.trend.sources.length > 0 && (
                  <View style={[s.wrap, { marginTop: 12, gap: 8 }]}>
                    {data.trend.sources.slice(0, 3).map((src) => (
                      <Press
                        key={src.url}
                        accessibilityRole="link"
                        onPress={() => void Linking.openURL(src.url).catch(() => {})}
                        style={[s.pill, { backgroundColor: C.bg, paddingHorizontal: 10, paddingVertical: 4 }]}
                      >
                        <T size={11} weight={600} soft>
                          {hostOf(src.url)} ↗
                        </T>
                      </Press>
                    ))}
                  </View>
                )}
                {!data.trend.live && (
                  <T size={11} soft style={{ marginTop: 8, fontStyle: "italic" }}>
                    Live web is off — from Glow's own knowledge.
                  </T>
                )}
              </>
            ) : (
              <T size={14} soft style={{ marginTop: 8 }}>
                {trendBusy || !data.loaded ? "Reading the room…" : "Tap refresh for what's trending."}
              </T>
            )}
          </Card>
        </Reveal>

        {/* Looks by occasion */}
        <Reveal delay={next()}>
          <SectionTitle
            action={
              looks.length ? (
                <Pressable onPress={() => loadLooks(occasion, true)} disabled={loadingLooks} hitSlop={10} style={loadingLooks && { opacity: 0.5 }}>
                  <T size={12} weight={700} color={theme.accent}>
                    Shuffle
                  </T>
                </Pressable>
              ) : undefined
            }
          >
            Looks for you
          </SectionTitle>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -16 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4, gap: 8 }}
          >
            {OCCASIONS.map((o) => {
              const on = occasion === o.id;
              return (
                <Press
                  key={o.id}
                  onPress={() => chooseOccasion(o.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[
                    s.pill,
                    { paddingHorizontal: 14, paddingVertical: 8 },
                    on ? { backgroundColor: theme.accent } : { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line },
                  ]}
                >
                  <T size={14} weight={600} color={on ? "#fff" : C.ink}>
                    {o.emoji} {o.label}
                  </T>
                </Press>
              );
            })}
          </ScrollView>

          <View style={{ marginTop: 12, gap: 12 }}>
            {loadingLooks && <LookSkeleton />}
            {!loadingLooks && !looks.length && (
              <Press onPress={() => loadLooks(occasion)}>
                <Card>
                  <T size={14} soft center>
                    Tap an occasion to see looks made for you 💄
                  </T>
                </Card>
              </Press>
            )}
            {looks.map((look) => (
              <LookCard key={look.id} look={look} saved={savedIds.has(look.id)} onOpen={() => openTutorial(look)} onSave={() => toggleSave(look)} />
            ))}
          </View>
        </Reveal>

        {/* Photo tools */}
        <Reveal delay={next()}>
          <SectionTitle>From a photo</SectionTitle>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <PhotoCard
              emoji="📸"
              title="Recreate a look"
              sub={photoBusy === "recreate" ? "Studying it…" : "Upload an inspo photo"}
              disabled={photoBusy !== null}
              onPress={pickInspo}
            />
            <PhotoCard
              emoji="🪞"
              title="What suits me?"
              sub={photoBusy === "analyze" ? "Looking…" : "Take or pick a selfie"}
              disabled={photoBusy !== null}
              onPress={pickSelfie}
            />
          </View>
          <T size={11} soft style={{ marginTop: 8, paddingHorizontal: 4 }}>
            Photos are read by the AI for advice and never stored. 💗
          </T>
        </Reveal>

        {/* Ask Glow */}
        <Reveal delay={next()}>
          <Card>
            <SectionTitle>Ask Glow</SectionTitle>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Field
                value={question}
                onChangeText={setQuestion}
                onSubmitEditing={() => void ask()}
                returnKeyType="send"
                submitBehavior="blurAndSubmit"
                placeholder="e.g. how do I stop foundation creasing?"
                style={{ flex: 1, width: undefined }}
              />
              <Btn onPress={() => void ask()} disabled={askBusy || !question.trim()} style={{ paddingHorizontal: 20 }}>
                {askBusy ? "…" : "Ask"}
              </Btn>
            </View>
            {(!!answer || askBusy) && (
              <View style={[s.soft, { marginTop: 12, backgroundColor: theme.accentSoft }]}>
                {answer ? (
                  <Markdown text={answer} />
                ) : (
                  <T size={15} soft>
                    Glow is thinking…
                  </T>
                )}
                {askBusy && !!answer && (
                  <Pulse>
                    <T size={15}>▍</T>
                  </Pulse>
                )}
              </View>
            )}
          </Card>
        </Reveal>

        {/* Saved looks */}
        {data.saved.length > 0 && (
          <Reveal delay={next()}>
            <SectionTitle>Saved looks 💗</SectionTitle>
            <View style={{ gap: 12 }}>
              {data.saved.map((look) => (
                <LookCard key={look.id} look={look} saved onOpen={() => openTutorial(look)} onSave={() => toggleSave(look)} />
              ))}
            </View>
          </Reveal>
        )}
      </View>

      {/* ---- Sheets ---- */}
      <ProfileSheet
        open={profileOpen}
        profile={data.profile}
        onClose={() => setProfileOpen(false)}
        onSave={async (p) => {
          gset({ profile: p });
          setProfileOpen(false);
          try {
            await glow.saveProfile(p);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />

      <Sheet open={activeLook !== null} onClose={() => setActiveLook(null)} eyebrow="Tutorial" title={activeLook?.name ?? ""} full>
        {tutorialBusy && (
          <T soft center style={{ paddingVertical: 40 }}>
            Writing your step-by-step… 💄
          </T>
        )}
        {!!tutorialIntro && <Markdown text={tutorialIntro} style={[s.soft, { marginBottom: 16, backgroundColor: theme.accentSoft }]} />}
        {tutorial && <TutorialBody t={tutorial} />}
      </Sheet>

      <Sheet open={analysis !== null} onClose={() => setAnalysis(null)} eyebrow="Your colours" title="What suits you">
        {analysis && <AnalysisBody a={analysis} />}
      </Sheet>
    </Screen>
  );
}

/* ---------- Pieces ---------- */

/** A "✦ text" list row. */
function Sparkled({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <T size={14} color={theme.accent}>
        ✦
      </T>
      <T size={14} soft style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}

function PhotoCard({ emoji, title, sub, disabled, onPress }: { emoji: string; title: string; sub: string; disabled: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" style={{ flex: 1 }}>
      <Card pad={16} style={{ flex: 1, alignItems: "flex-start", gap: 4 }}>
        <T size={30}>{emoji}</T>
        <T v="display" size={16}>
          {title}
        </T>
        <T size={12} soft>
          {sub}
        </T>
      </Card>
    </Press>
  );
}

function LookCard({ look, saved, onOpen, onSave }: { look: Look; saved: boolean; onOpen: () => void; onSave: () => void }) {
  const theme = useTheme();
  const d = DIFF[look.difficulty] ?? DIFF.medium;
  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <Pressable onPress={onOpen} accessibilityRole="button" style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="display" size={18} style={{ lineHeight: 23 }}>
              {look.name}
            </T>
            <T size={14} soft style={{ marginTop: 2 }}>
              {look.vibe}
            </T>
          </View>
          <View style={[s.pill, { flexShrink: 0, backgroundColor: d.bg, paddingHorizontal: 10, paddingVertical: 4 }]}>
            <T size={11} weight={700} color={d.fg}>
              {d.label}
            </T>
          </View>
        </View>
        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
          {(look.palette ?? []).slice(0, 6).map((c, i) => (
            <View key={i} style={[s.swatch, { backgroundColor: safeColor(c) }]} />
          ))}
        </View>
      </Pressable>
      <View style={s.lookFooter}>
        <Pressable onPress={onOpen} hitSlop={8}>
          <T size={14} weight={700} color={theme.accent}>
            How to do it →
          </T>
        </Pressable>
        <Press
          onPress={onSave}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          accessibilityLabel={saved ? "Remove from saved" : "Save look"}
        >
          <T size={20}>{saved ? "💗" : "🤍"}</T>
        </Press>
      </View>
    </Card>
  );
}

function TutorialBody({ t }: { t: Tutorial }) {
  const theme = useTheme();
  const shopping = t.shopping ?? [];
  return (
    <View style={{ paddingBottom: 16 }}>
      <View style={[s.pill, { alignSelf: "flex-start", marginBottom: 16, backgroundColor: theme.accentSoft, paddingHorizontal: 12, paddingVertical: 4 }]}>
        <T size={12} weight={700} color={theme.accent}>
          ⏱️ about {Math.round(t.minutes)} min
        </T>
      </View>
      <View style={{ paddingLeft: 32, gap: 16 }}>
        <View style={s.stepLine} />
        {t.steps.map((st, i) => (
          <View key={i}>
            <View style={[s.stepNum, { backgroundColor: theme.accent }]}>
              <T size={14} weight={700} color="#fff">
                {i + 1}
              </T>
            </View>
            <T weight={600}>{st.title}</T>
            <T size={14} soft style={{ marginTop: 2 }}>
              {st.detail}
            </T>
            {!!st.tip && (
              <T size={12} color={theme.accent} style={{ marginTop: 4 }}>
                💡 {st.tip}
              </T>
            )}
          </View>
        ))}
      </View>
      {shopping.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Eyebrow style={{ marginBottom: 8 }}>Shopping list</Eyebrow>
          <View style={{ gap: 8 }}>
            {shopping.map((p, i) => (
              <Card key={i} pad={12} style={[s.rowBetween, { gap: 12 }]}>
                <T size={14} weight={600} style={{ flexShrink: 1 }}>
                  {p.type}
                </T>
                <T size={12} soft style={{ flexShrink: 1, textAlign: "right" }}>
                  {p.suggestion}
                </T>
              </Card>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function AnalysisBody({ a }: { a: Analysis }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 16, paddingBottom: 16 }}>
      <Markdown text={a.summary} />
      <Card pad={16}>
        <Eyebrow>Your undertone</Eyebrow>
        <T v="display" size={20} color={theme.accent} style={{ marginTop: 4 }}>
          {a.undertone}
        </T>
      </Card>
      <View>
        <Eyebrow style={{ marginBottom: 8 }}>Colours that flatter you</Eyebrow>
        <View style={[s.wrap, { gap: 8 }]}>
          {a.flatters.map((f, i) => (
            <View key={i} style={[s.pill, { backgroundColor: theme.accentSoft, paddingHorizontal: 12, paddingVertical: 6 }]}>
              <T size={14} weight={600} color={theme.accent}>
                {f}
              </T>
            </View>
          ))}
        </View>
      </View>
      <View>
        <Eyebrow style={{ marginBottom: 8 }}>Tips</Eyebrow>
        <View style={{ gap: 6 }}>
          {a.tips.map((tip, i) => (
            <Sparkled key={i} text={tip} />
          ))}
        </View>
      </View>
    </View>
  );
}

function ProfileSheet({
  open,
  profile,
  onClose,
  onSave,
}: {
  open: boolean;
  profile: GlowProfile;
  onClose: () => void;
  onSave: (p: GlowProfile) => void;
}) {
  const [draft, setDraft] = useState<GlowProfile>(profile);
  const [seen, setSeen] = useState(open);
  if (open !== seen) {
    setSeen(open);
    if (open) setDraft(profile);
  }

  const pick = (key: keyof GlowProfile, value: string) =>
    setDraft((d) => ({ ...d, [key]: d[key] === value ? undefined : value }));

  return (
    <Sheet open={open} onClose={onClose} eyebrow="About you" title="Your beauty profile">
      <View style={{ gap: 20, paddingBottom: 16 }}>
        {(Object.keys(PROFILE_FIELDS) as (keyof typeof PROFILE_FIELDS)[]).map((key) => (
          <View key={key}>
            <T size={14} weight={600} style={{ marginBottom: 8 }}>
              {PROFILE_FIELDS[key].label}
            </T>
            <View style={[s.wrap, { gap: 8 }]}>
              {PROFILE_FIELDS[key].options.map((opt) => (
                <Chip key={opt} pressed={draft[key] === opt} onPress={() => pick(key, opt)}>
                  {opt}
                </Chip>
              ))}
            </View>
          </View>
        ))}
        <View>
          <T size={14} weight={600} style={{ marginBottom: 8 }}>
            Anything else?
          </T>
          <Field
            placeholder="Allergies, favourites, things to avoid…"
            value={draft.notes ?? ""}
            maxLength={200}
            onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))}
          />
        </View>
        <Btn onPress={() => onSave(draft)} style={{ width: "100%" }}>
          Save profile
        </Btn>
      </View>
    </Sheet>
  );
}

/** Tailwind's animate-pulse: a soft opacity breathe. */
function Pulse({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.5, duration: 1000, easing: Easing.bezier(0.4, 0, 0.6, 1), useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 1000, easing: Easing.bezier(0.4, 0, 0.6, 1), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[style, { opacity: v }]}>{children}</Animated.View>;
}

function LookSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      {[0, 1].map((i) => (
        <Pulse key={i}>
          <Card pad={16}>
            <View style={[s.bar, { height: 20, width: "50%" }]} />
            <View style={[s.bar, { marginTop: 8, height: 16, width: "75%" }]} />
            <View style={{ marginTop: 12, flexDirection: "row", gap: 6 }}>
              {[0, 1, 2, 3].map((j) => (
                <View key={j} style={[s.swatch, { backgroundColor: C.line, borderWidth: 0 }]} />
              ))}
            </View>
          </Card>
        </Pulse>
      ))}
    </View>
  );
}

function hostOf(url: string): string {
  // RN's URL polyfill doesn't reliably implement `.host`, so parse it directly.
  const m = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?([^/?#]+)/i.exec(url);
  return m ? m[1].replace(/^www\./, "") : "source";
}

/** Only allow safe hex colours into inline style. */
function safeColor(c: string): string {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : C.line;
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 8 },
  pill: { borderRadius: 999, alignItems: "center", justifyContent: "center" },
  error: { borderRadius: 16, backgroundColor: C.berrySoft, padding: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wrap: { flexDirection: "row", flexWrap: "wrap" },
  soft: { borderRadius: 16, padding: 14 },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(0,0,0,0.08)" },
  lookFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stepLine: { position: "absolute", top: 8, bottom: 8, left: 14.4, width: 1, backgroundColor: C.line },
  stepNum: { position: "absolute", left: -32, top: 0, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bar: { borderRadius: 4, backgroundColor: C.line },
});
