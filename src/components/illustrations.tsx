import type { ReactNode } from "react";
import { Animated, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Pattern, Rect, Stop } from "react-native-svg";
import type { Stretch } from "@/lib/stretches";
import { C } from "@/lib/theme";

/* All illustrations are hand-written SVG: nothing to download, nothing awkward. */

/** A knitted hot water bag that warms up (0 → 1) and gets happier as it does. */
export function HotWaterBag({ warmth, size = 200 }: { warmth: number; size?: number }) {
  const w = Math.max(0, Math.min(1, warmth));
  const fillTop = 192 - w * 138;
  const happy = w > 0.55;
  return (
    <Svg viewBox="0 0 160 200" width={size} height={size * 1.25}>
      <Defs>
        <ClipPath id="hwb-body">
          <Rect x="18" y="52" width="124" height="138" rx="40" />
        </ClipPath>
        <LinearGradient id="hwb-heat" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0%" stopColor="#ff5e3a" />
          <Stop offset="60%" stopColor="#ff9a4d" />
          <Stop offset="100%" stopColor="#ffc773" />
        </LinearGradient>
        <Pattern id="hwb-knit" width="12" height="10" patternUnits="userSpaceOnUse">
          <Path d="M0 5 Q3 0 6 5 T12 5" fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1.6} />
        </Pattern>
      </Defs>
      {/* cap + neck */}
      <Rect x="56" y="8" width="48" height="18" rx="6" fill="#7a4fd6" />
      <Rect x="62" y="22" width="36" height="36" rx="8" fill="#f2b8c9" />
      {/* body */}
      <Rect x="18" y="52" width="124" height="138" rx="40" fill="#ffc9d6" />
      <G clipPath="url(#hwb-body)">
        <Rect x="0" y={fillTop} width="160" height="200" fill="url(#hwb-heat)" opacity={0.55 + w * 0.4} />
        <Rect x="0" y="0" width="160" height="200" fill="url(#hwb-knit)" />
      </G>
      <Rect x="18" y="52" width="124" height="138" rx="40" fill="none" stroke="#2e1a2b" strokeOpacity={0.12} strokeWidth={3} />
      {/* face */}
      {happy ? (
        <>
          <Path d="M55 112 q7 -8 14 0" stroke="#2e1a2b" strokeWidth={4} fill="none" strokeLinecap="round" />
          <Path d="M91 112 q7 -8 14 0" stroke="#2e1a2b" strokeWidth={4} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx="62" cy="110" r="5" fill="#2e1a2b" />
          <Circle cx="98" cy="110" r="5" fill="#2e1a2b" />
        </>
      )}
      <Ellipse cx="48" cy="126" rx="9" ry="5" fill="#ff6f91" opacity={0.25 + w * 0.6} />
      <Ellipse cx="112" cy="126" rx="9" ry="5" fill="#ff6f91" opacity={0.25 + w * 0.6} />
      <Path
        d={happy ? "M70 126 q10 12 20 0" : "M72 128 q8 4 16 0"}
        stroke="#2e1a2b"
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
      {/* little heart patch */}
      <Path
        d="M80 168s-10-6-12-12c-1.6-4.4 1.4-8 5-8 2.6 0 4.6 1.4 7 4 2.4-2.6 4.4-4 7-4 3.6 0 6.6 3.6 5 8-2 6-12 12-12 12Z"
        fill="#e5487a"
        opacity={0.85}
      />
    </Svg>
  );
}

/**
 * A gift box. The lid is drawn in its own layer so it can be flung off: pass an
 * Animated style as `lidStyle` (the web animated the `.gift-lid` group with GSAP).
 * The layer's transform origin matches the web's (90px 66px in the 180×170 box).
 */
export function GiftBox({
  size = 180,
  lidStyle,
}: {
  size?: number;
  lidStyle?: StyleProp<Animated.WithAnimatedValue<ViewStyle>>;
}) {
  const h = size * 0.94;
  return (
    <View style={{ width: size, height: h, overflow: "visible" }} pointerEvents="none">
      <Svg viewBox="0 0 180 170" width={size} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
        <Rect x="22" y="70" width="136" height="92" rx="14" fill="#6e3f2a" />
        <Rect x="22" y="70" width="136" height="20" fill="#5a3121" />
        <Rect x="80" y="70" width="20" height="92" fill="#e5487a" />
        <Circle cx="50" cy="120" r="5" fill="#ffd6a5" opacity={0.5} />
        <Circle cx="130" cy="135" r="4" fill="#ffd6a5" opacity={0.5} />
        <Circle cx="122" cy="105" r="3" fill="#ffd6a5" opacity={0.5} />
      </Svg>
      <Animated.View
        style={[
          { position: "absolute", left: 0, top: 0, width: size, height: h, transformOrigin: `${(90 / 180) * 100}% ${(66 / 170) * 100}%` },
          lidStyle,
        ]}
      >
        <Svg viewBox="0 0 180 170" width={size} height={h}>
          <Rect x="14" y="48" width="152" height="30" rx="10" fill="#8a5238" />
          <Rect x="80" y="48" width="20" height="30" fill="#ff6f91" />
          <Path d="M90 48c-14-26-44-22-36-6 5 9 24 8 36 6Z" fill="#ff6f91" />
          <Path d="M90 48c14-26 44-22 36-6-5 9-24 8-36 6Z" fill="#e5487a" />
          <Circle cx="90" cy="46" r="8" fill="#c9356a" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Her favourite. A rasgulla in a little bowl of syrup. */
export function Rasgulla({ size = 44 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 48 48" width={size} height={size}>
      <Ellipse cx="24" cy="34" rx="19" ry="8" fill="#f6d79b" />
      <Path d="M5 33c1 9 9 12 19 12s18-3 19-12" fill="#e9c27a" />
      <Circle cx="18" cy="26" r="9" fill="#fffaf0" stroke="#f0dfc0" strokeWidth={1.5} />
      <Circle cx="30" cy="27" r="8" fill="#fffdf6" stroke="#f0dfc0" strokeWidth={1.5} />
      <Circle cx="15" cy="23" r="2" fill="white" />
      <Circle cx="27.5" cy="24" r="1.6" fill="white" />
    </Svg>
  );
}

/** The villain of the mini game: a small, grumpy, entirely squishable cramp. Fills its parent. */
export function CrampBlob({ squished = false, golden = false }: { squished?: boolean; golden?: boolean }) {
  const fill = golden ? "#ffc23d" : "#9b7bea";
  const shade = golden ? "#f29d00" : "#7a58d6";
  return (
    <Svg viewBox="0 0 80 70" width="100%" height="100%">
      {squished ? (
        <>
          <Ellipse cx="40" cy="56" rx="32" ry="10" fill={fill} />
          <Path d="M26 54l6 4M32 54l-6 4M48 54l6 4M54 54l-6 4" stroke="#2e1a2b" strokeWidth={3} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Path d="M10 60c-4-20 4-44 30-44s34 24 30 44c-2 6-56 6-60 0Z" fill={fill} />
          <Path d="M10 60c4 4 56 4 60 0-1 5-59 5-60 0Z" fill={shade} />
          {/* angry brows */}
          <Path d="M22 30l12 5M58 30l-12 5" stroke="#2e1a2b" strokeWidth={3.5} strokeLinecap="round" />
          <Circle cx="30" cy="40" r="4" fill="#2e1a2b" />
          <Circle cx="50" cy="40" r="4" fill="#2e1a2b" />
          <Path d="M33 52q7-6 14 0" stroke="#2e1a2b" strokeWidth={3} fill="none" strokeLinecap="round" />
          {golden && <Path d="M30 14l4-8 6 6 6-6 4 8Z" fill="#ff8a00" />}
        </>
      )}
    </Svg>
  );
}

/** Tiny line-drawing of each stretch. `color` replaces the web's `currentColor`. */
export function Pose({
  pose,
  width = 112,
  height = 72,
  color = C.ink,
}: {
  pose: Stretch["pose"];
  width?: number;
  height?: number;
  color?: string;
}) {
  const s = {
    fill: "none",
    stroke: color,
    strokeWidth: 5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const head = (cx: number, cy: number) => <Circle cx={cx} cy={cy} r="7" fill={color} />;
  const shapes: Record<Stretch["pose"], ReactNode> = {
    child: (
      <>
        <Path {...s} d="M84 44 Q62 34 40 50" />
        <Path {...s} d="M42 50 L14 60" />
        <Path {...s} d="M84 44 L66 62 L96 62" />
        {head(32, 56)}
      </>
    ),
    catcow: (
      <>
        <Path {...s} d="M38 38 Q62 18 86 38" />
        <Path {...s} d="M38 38 L38 62 M86 38 L86 62 L102 62" />
        {head(26, 44)}
      </>
    ),
    knees: (
      <>
        <Path {...s} d="M24 60 L64 60" />
        <Path {...s} d="M64 60 L56 34 L74 30" />
        <Path {...s} d="M34 58 L54 38" />
        {head(16, 56)}
      </>
    ),
    twist: (
      <>
        <Path {...s} d="M24 60 L66 60" />
        <Path {...s} d="M66 60 L90 50 L92 64" />
        <Path {...s} d="M34 60 L34 40 M34 60 L34 66" />
        {head(16, 56)}
      </>
    ),
    butterfly: (
      <>
        <Path {...s} d="M24 60 L64 60" />
        <Path {...s} d="M64 60 L80 40 L96 60" />
        <Path {...s} d="M64 60 L84 48 L96 60" opacity={0.5} />
        {head(16, 56)}
      </>
    ),
    tilt: (
      <>
        <Path {...s} d="M24 60 Q44 54 64 60" />
        <Path {...s} d="M64 60 L82 38 L98 62" />
        <Path d="M44 44 l-4 -6 m4 6 l5 -5" stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
        {head(16, 56)}
      </>
    ),
  };
  return (
    <Svg viewBox="0 0 112 72" width={width} height={height}>
      <Path d="M6 68 H106" stroke={color} strokeOpacity={0.2} strokeWidth={3} strokeLinecap="round" />
      {shapes[pose]}
    </Svg>
  );
}
