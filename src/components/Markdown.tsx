import { Fragment, type ReactNode } from "react";
import { Linking, View, type StyleProp, type ViewStyle } from "react-native";
import { T } from "./ui";

/**
 * A tiny, safe markdown renderer — no HTML injection, no dependency.
 * Handles the small set the AIs actually produce: paragraphs, bullet and
 * numbered lists, **bold**, *italic*, `code`, and [links](url).
 * Great for short, streamed replies where a full markdown engine is overkill.
 * Rendered with nested <T> so inline runs wrap like real text.
 */

interface Ctx {
  size: number;
  color?: string;
  soft?: boolean;
}

/** Inline formatting: bold, italic, inline code, and links. */
function inline(text: string, keyBase: string, ctx: Ctx): ReactNode[] {
  const out: ReactNode[] = [];
  // Order matters: links first, then code, then bold, then italic.
  const re = new RegExp(
    [
      "\\[([^\\]]+)\\]\\((https?://[^\\s)]+)\\)", // [text](url)
      "`([^`]+)`", // `code`
      "\\*\\*([^*]+)\\*\\*", // **bold**
      "\\*([^*]+)\\*", // *italic*
      "_([^_]+)_", // _italic_
    ].join("|"),
    "g",
  );
  const base = { size: ctx.size, color: ctx.color, soft: ctx.soft };
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[2]) {
      const url = m[2];
      out.push(
        <T
          key={key}
          {...base}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(url).catch(() => {})}
          style={{ textDecorationLine: "underline", textDecorationStyle: "dotted" }}
        >
          {m[1]}
        </T>,
      );
    } else if (m[3]) {
      // Nested text can't take padding/radius on Android; the tinted background is kept.
      out.push(
        <T key={key} {...base} size={ctx.size * 0.9} style={{ fontFamily: "monospace", backgroundColor: "rgba(0,0,0,0.1)" }}>
          {m[3]}
        </T>,
      );
    } else if (m[4]) {
      out.push(
        <T key={key} {...base} weight={700}>
          {m[4]}
        </T>,
      );
    } else {
      out.push(
        <T key={key} {...base} style={{ fontStyle: "italic" }}>
          {m[5] ?? m[6]}
        </T>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({
  text,
  style,
  size = 15,
  lineHeight,
  color,
  soft,
}: {
  text: string;
  /** Wrapper style (the web's `className` spacing/background). */
  style?: StyleProp<ViewStyle>;
  /** Font size (default 15 = text-[15px]). */
  size?: number;
  /** Defaults to leading-snug (1.375 × size). */
  lineHeight?: number;
  color?: string;
  soft?: boolean;
}) {
  const ctx: Ctx = { size, color, soft };
  const lh = lineHeight ?? Math.round(size * 1.375);
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  let k = 0;

  const flushPara = () => {
    if (!para.length) return;
    blocks.push(
      <T key={`p-${k++}`} size={size} color={color} soft={soft} style={{ lineHeight: lh }}>
        {inline(para.join(" "), `p${k}`, ctx)}
      </T>,
    );
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const { items, ordered } = list;
    blocks.push(
      <View key={`l-${k++}`} style={{ gap: 4 }}>
        {items.map((it, j) => (
          <View key={j} style={{ flexDirection: "row" }}>
            <T size={size} color={color} soft={soft} style={{ width: 20, lineHeight: lh, textAlign: ordered ? "right" : "center", paddingRight: ordered ? 5 : 0 }}>
              {ordered ? `${j + 1}.` : "•"}
            </T>
            <T size={size} color={color} soft={soft} style={{ flex: 1, lineHeight: lh }}>
              {inline(it, `li${k}-${j}`, ctx)}
            </T>
          </View>
        ))}
      </View>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet) {
      flushPara();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      flushPara();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(numbered[1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      // Strip stray leading "#" headings down to plain emphasis.
      para.push(line.replace(/^#{1,6}\s+/, ""));
    }
  }
  flushPara();
  flushList();

  return (
    <View style={[{ gap: 8 }, style]}>
      {blocks.map((b, i) => (
        <Fragment key={i}>{b}</Fragment>
      ))}
    </View>
  );
}
