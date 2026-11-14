import { StyleSheet, View } from "react-native";
import { startHelp } from "@/lib/help";
import { HoldButton } from "./HoldButton";
import { Card, T } from "./ui";

const RED = "#d7263d";
const RED_DARK = "#9e1028";
const HOLD_MS = 1500;

/** The bigger card (Comfort Corner). */
export function HelpCard({ partnerName }: { partnerName: string }) {
  return (
    <Card pad={20} style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <T size={34}>🆘</T>
        <View style={{ flex: 1 }}>
          <T v="display" size={19}>
            Feeling unsafe?
          </T>
          <T size={13} soft style={{ marginTop: 2 }}>
            Siren, flashing lights, and your live location goes to {partnerName}. You can also just tell Jarvis.
          </T>
        </View>
      </View>
      <HoldButton
        duration={HOLD_MS}
        onDone={() => startHelp("button")}
        color={RED}
        fill={RED_DARK}
        style={styles.big}
        accessibilityLabel={`Help me. Starts the siren and sends your location to ${partnerName}`}
      >
        {({ holding }) => (
          <T size={16} weight={700} color="#fff">
            {holding ? "Keep holding…" : "Hold for help"}
          </T>
        )}
      </HoldButton>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: "rgba(215,38,61,0.25)" },
  big: { marginTop: 16, paddingVertical: 15 },
});
