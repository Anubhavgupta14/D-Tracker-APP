import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, RADIUS, useTheme, ThemeContext } from "@/lib/theme";
import { CloseIcon } from "./icons";
import { Eyebrow, T } from "./ui";

/**
 * A mobile bottom sheet. Slides up; drag the handle down, tap the backdrop or
 * press the Android back button to close.
 */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  full = false,
  scroll = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  full?: boolean;
  /** Set false when the content manages its own scrolling or gestures (games). */
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  // Sheets always use the light theme, even over the dark Jarvis tab (as on the web).
  const theme = useTheme();
  const light = { ...theme, dark: false };
  const H = Dimensions.get("window").height;

  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const y = useRef(new Animated.Value(H)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!mounted) return;
    if (open) {
      y.setValue(H);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 550, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(y, { toValue: H, duration: 350, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [open, mounted, H, y, fade]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
      onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 1.2) onCloseRef.current();
        else Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
      },
    }),
  ).current;

  if (!mounted) return null;

  const body = (
    <View style={{ paddingHorizontal: 20, paddingBottom: 24 + insets.bottom }}>{children}</View>
  );

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <ThemeContext.Provider value={light}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <KeyboardAvoidingView behavior="padding" style={styles.wrap} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.panel,
              full ? { height: H * 0.94 } : { maxHeight: H * 0.9 },
              { transform: [{ translateY: y }] },
            ]}
          >
            <View {...pan.panHandlers} style={styles.handleZone}>
              <View style={styles.handle} />
            </View>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
                {title ? (
                  <T v="display" size={24} style={{ lineHeight: 30 }}>
                    {title}
                  </T>
                ) : null}
              </View>
              <Pressable onPress={onClose} accessibilityLabel="Close" style={styles.close}>
                <CloseIcon size={20} color={C.inkSoft} />
              </Pressable>
            </View>
            {scroll ? (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} style={{ flexGrow: full ? 1 : 0 }}>
                {body}
              </ScrollView>
            ) : (
              <View style={{ flex: full ? 1 : undefined }}>{body}</View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </ThemeContext.Provider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(46,26,43,0.45)" },
  wrap: { flex: 1, justifyContent: "flex-end" },
  panel: {
    width: "100%",
    backgroundColor: C.bg,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    shadowColor: "#3c1428",
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 24,
  },
  handleZone: { alignItems: "center", paddingTop: 12, paddingBottom: 6 },
  handle: { height: 6, width: 48, borderRadius: 3, backgroundColor: "rgba(46,26,43,0.15)" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
});
