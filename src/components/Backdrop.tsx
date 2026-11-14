import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { C, useTheme } from "@/lib/theme";

interface Glow {
  id: string;
  cx: string;
  cy: string;
  rx: string;
  ry: string;
  color: string;
  opacity: number;
}

/** The soft blobs behind everything (the web's .app-backdrop), tinted by the current phase. */
export function Backdrop() {
  const theme = useTheme();
  const blobs: Glow[] = theme.dark
    ? [
        { id: "a", cx: "50%", cy: "0%", rx: "70%", ry: "40%", color: "#6e5ae6", opacity: 0.35 },
        { id: "b", cx: "100%", cy: "60%", rx: "60%", ry: "40%", color: "#ff6fa5", opacity: 0.18 },
        { id: "c", cx: "0%", cy: "100%", rx: "60%", ry: "40%", color: "#4f9dff", opacity: 0.2 },
      ]
    : [
        { id: "a", cx: "100%", cy: "0%", rx: "60%", ry: "40%", color: theme.accent, opacity: 0.22 },
        { id: "b", cx: "0%", cy: "30%", rx: "50%", ry: "35%", color: "#ffc8aa", opacity: 0.45 },
        { id: "c", cx: "50%", cy: "110%", rx: "60%", ry: "40%", color: "#ebd2ff", opacity: 0.55 },
      ];

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? C.hudBg : C.bg }]}>
      <Svg width="100%" height="100%">
        <Defs>
          {blobs.map((b) => (
            <RadialGradient key={b.id} id={b.id} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fx={b.cx} fy={b.cy} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={b.color} stopOpacity={b.opacity} />
              <Stop offset="0.7" stopColor={b.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {blobs.map((b) => (
          <Rect key={b.id} x="0" y="0" width="100%" height="100%" fill={`url(#${b.id})`} />
        ))}
      </Svg>
    </View>
  );
}
