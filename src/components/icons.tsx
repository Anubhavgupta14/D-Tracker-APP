import Svg, { Circle, Path, Rect } from "react-native-svg";

/** The web app's inline SVG icons, for react-native-svg. */
export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const base = ({ size = 24, color = "#2e1a2b", strokeWidth = 2 }: IconProps, filled = false) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: filled ? color : "none",
  stroke: filled ? "none" : color,
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const HomeIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M3 10.5 12 3l9 7.5" />
    <Path d="M5.5 9v10.5a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9" />
  </Svg>
);

export const CalendarIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Rect x="3.5" y="5" width="17" height="15.5" rx="3.5" />
    <Path d="M3.5 10h17M8 3v4M16 3v4" />
    <Circle cx="12" cy="15" r="1.4" fill={p.color ?? "#2e1a2b"} stroke="none" />
  </Svg>
);

export const HeartIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.4 3.6 4 7 4c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8C19.5 15.4 12 20 12 20Z" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Circle cx="12" cy="8.5" r="4" />
    <Path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" />
  </Svg>
);

export const PhoneIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M5 3.5h3.2l1.6 4.2-2.1 1.4a11 11 0 0 0 5.2 5.2l1.4-2.1 4.2 1.6V17a2.5 2.5 0 0 1-2.7 2.5C9.6 19 5 14.4 4.5 6.2A2.5 2.5 0 0 1 5 3.5Z" />
  </Svg>
);

export const ChatIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M20.5 11.5a8.5 8 0 0 1-12.3 7.2L3.5 20l1.4-4.1A7.6 7.6 0 0 1 3.5 11.5 8.5 8 0 0 1 20.5 11.5Z" />
  </Svg>
);

export const ChevronLeft = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="m15 5-7 7 7 7" />
  </Svg>
);

export const ChevronRight = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="m9 5 7 7-7 7" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <Path d="M20 4v7h-7" />
  </Svg>
);

export const SparkleIcon = (p: IconProps) => (
  <Svg {...base(p, true)}>
    <Path d="M12 2c.6 5.3 3.7 8.4 9 9-5.3.6-8.4 3.7-9 9-.6-5.3-3.7-8.4-9-9 5.3-.6 8.4-3.7 9-9Z" />
  </Svg>
);

export const PlayIcon = (p: IconProps) => (
  <Svg {...base(p, true)}>
    <Path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l10.6-6.8a1 1 0 0 0 0-1.7L9.5 4.3A1 1 0 0 0 8 5.2Z" />
  </Svg>
);

export const WandIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M5 19 16 8" />
    <Path d="M16 8l3-3-1-1-3 3" />
    <Path d="M18.5 2.5 19 4l1.5.5L19 5l-.5 1.5L18 5l-1.5-.5L18 4z" fill={p.color ?? "#2e1a2b"} stroke="none" />
    <Path d="M6 4l.4 1.2L7.5 5.6 6.4 6 6 7.2 5.6 6 4.5 5.6 5.6 5.2z" fill={p.color ?? "#2e1a2b"} stroke="none" />
  </Svg>
);

export const MinusIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M5 12h14" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...base(p)}>
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);
