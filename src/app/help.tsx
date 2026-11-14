import { router } from "expo-router";
import { useEffect } from "react";
import { HelpPanel } from "@/components/HelpPanel";
import { useHelp } from "@/lib/help";

export default function HelpScreen() {
  const phase = useHelp().phase;
  // Once it's over, leave.
  useEffect(() => {
    if (phase !== "idle") return;
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [phase]);
  return <HelpPanel />;
}
