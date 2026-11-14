import { forwardRef, type ReactNode } from "react";
import { ScrollView, View, type ScrollViewInstance, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Space the floating tab bar takes at the bottom (the web's pb-[6.5rem]). */
export const TAB_BAR_SPACE = 104;

/**
 * A tab's page: scrolls, respects the status bar, and leaves room for the
 * floating tab bar. Pass `scroll={false}` for screens that manage their own
 * scrolling (Jarvis chat).
 */
export const Screen = forwardRef<ScrollViewInstance, ScrollViewProps & { children: ReactNode; scroll?: boolean }>(function Screen(
  { children, scroll = true, contentContainerStyle, ...rest },
  ref,
) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: Math.max(16, insets.top + 8), paddingHorizontal: 16, paddingBottom: TAB_BAR_SPACE + insets.bottom };
  if (!scroll) return <View style={[{ flex: 1 }, pad]}>{children}</View>;
  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...rest}
      contentContainerStyle={[pad, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  );
});
