import { LinearGradient } from "expo-linear-gradient";
import { Linking, StyleSheet, View } from "react-native";
import type { SongSet } from "@/lib/jarvis/protocol";
import { Press, T } from "../ui";

/**
 * A little card of uplifting songs Jarvis suggests when she's low. Each opens in
 * Spotify or YouTube — we build a SEARCH link from the title + artist (not a track
 * id), so a link never 404s on a song that was named slightly differently.
 */

const q = (song: { title: string; artist: string }) => encodeURIComponent(`${song.title} ${song.artist}`);
const spotify = (s: { title: string; artist: string }) => `https://open.spotify.com/search/${q(s)}`;
const youtube = (s: { title: string; artist: string }) => `https://www.youtube.com/results?search_query=${q(s)}`;

const open = (url: string) => void Linking.openURL(url).catch(() => {});

export function SongsCard({ set }: { set: SongSet }) {
  const songs = Array.isArray(set.songs) ? set.songs.filter((s) => s && s.title) : [];
  if (!songs.length) return null;

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={["rgba(127,240,192,0.28)", "rgba(143,110,230,0.22)", "rgba(255,111,165,0.18)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 20 }}
      >
        <T size={11} weight={700} color="rgba(255,255,255,0.6)" style={{ letterSpacing: 1.76, textTransform: "uppercase" }}>
          🎧 A little lift
        </T>
        {!!set.intro && (
          <T v="hand" size={20} color="rgba(255,255,255,0.85)" style={{ marginTop: 6, lineHeight: 26 }}>
            {set.intro}
          </T>
        )}
      </LinearGradient>

      <View style={{ padding: 16, gap: 14 }}>
        {songs.map((s, i) => (
          <View key={i} style={styles.song}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T weight={600} style={{ lineHeight: 20 }}>
                {s.title}
              </T>
              <T size={13} color="rgba(255,255,255,0.6)">
                {s.artist}
              </T>
              {!!s.why && (
                <T size={12} color="rgba(255,255,255,0.55)" style={{ marginTop: 2, fontStyle: "italic" }}>
                  {s.why}
                </T>
              )}
            </View>
            <View style={styles.actions}>
              <Press
                scaleTo={0.94}
                accessibilityRole="link"
                accessibilityLabel={`Play ${s.title} on Spotify`}
                onPress={() => open(spotify(s))}
                style={[styles.btn, { backgroundColor: "#1DB954" }]}
              >
                <T size={12} weight={700} color="#06240f">
                  Spotify
                </T>
              </Press>
              <Press
                scaleTo={0.94}
                accessibilityRole="link"
                accessibilityLabel={`Play ${s.title} on YouTube`}
                onPress={() => open(youtube(s))}
                style={[styles.btn, { backgroundColor: "#ff3d55" }]}
              >
                <T size={12} weight={700} color="#2a0007">
                  YouTube
                </T>
              </Press>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(20,16,36,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  song: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 12,
  },
  actions: { gap: 6, alignItems: "stretch" },
  btn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, alignItems: "center" },
});
