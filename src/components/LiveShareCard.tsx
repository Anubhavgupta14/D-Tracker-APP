import { useEffect, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { buzz } from "@/lib/fx";
import { startLiveShare, stopLiveShare, useLiveShare } from "@/lib/liveShare";
import { C } from "@/lib/theme";
import { Btn, Card, Chip, T } from "./ui";

const DURATIONS = [
  { label: "15 min", minutes: 15 },
  { label: "1 hour", minutes: 60 },
  { label: "4 hours", minutes: 240 },
  { label: "8 hours", minutes: 480 },
];

const time = (ms: number) => new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/** Share live location with him for a while (Comfort Corner). */
export function LiveShareCard({ partnerName }: { partnerName: string }) {
  const live = useLiveShare();
  const [minutes, setMinutes] = useState(60);
  const [error, setError] = useState("");
  // For "sent 2 min ago"; ticks while sharing.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (live.status !== "sharing") return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [live.status]);

  const start = async () => {
    setError("");
    buzz(12);
    try {
      await startLiveShare({ minutes, reason: "share" });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (live.status === "sharing" && live.share) {
    const sos = live.share.reason === "sos";
    const sent = live.lastSentAt ? Math.max(0, Math.round((now - live.lastSentAt) / 60_000)) : null;
    return (
      <Card pad={18} style={styles.on}>
        <View style={styles.row}>
          <View style={styles.dot} />
          <View style={{ flex: 1 }}>
            <T weight={700} size={15}>
              {sos ? "Help mode is sharing your location" : `Sharing your location with ${partnerName}`}
            </T>
            <T size={13} soft>
              {sos ? "Until you say you're safe" : `Until ${time(live.share.endsAt)}`}
              {sent === null ? " · sending the first update…" : ` · last sent ${sent === 0 ? "just now" : `${sent} min ago`}`}
            </T>
          </View>
        </View>
        {!sos && (
          <Btn kind="soft" style={{ marginTop: 14 }} onPress={() => void stopLiveShare()}>
            Stop sharing
          </Btn>
        )}
      </Card>
    );
  }

  const blocked = /Settings/.test(error);
  return (
    <Card pad={18}>
      <View style={styles.row}>
        <T size={26}>📍</T>
        <View style={{ flex: 1 }}>
          <T weight={700} size={15}>
            Share live location
          </T>
          <T size={13} soft>
            {`${partnerName} can see where you are until it ends, even with your screen off. Stop anytime.`}
          </T>
        </View>
      </View>
      <View style={styles.chips}>
        {DURATIONS.map((d) => (
          <Chip key={d.minutes} pressed={minutes === d.minutes} onPress={() => setMinutes(d.minutes)}>
            {d.label}
          </Chip>
        ))}
      </View>
      {error ? (
        <T size={13} weight={600} color={C.berry} style={{ marginTop: 10 }}>
          {error}
        </T>
      ) : null}
      {blocked ? (
        <Btn kind="soft" style={{ marginTop: 12 }} onPress={() => void Linking.openSettings()}>
          Open settings
        </Btn>
      ) : (
        <Btn style={{ marginTop: 14 }} disabled={live.status === "starting"} onPress={() => void start()}>
          {live.status === "starting" ? "Starting…" : `Share for ${DURATIONS.find((d) => d.minutes === minutes)?.label}`}
        </Btn>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  on: { borderColor: "rgba(47,158,110,0.35)" },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#2f9e6e" },
});
