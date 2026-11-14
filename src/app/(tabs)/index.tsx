import { router } from "expo-router";
import { useTools } from "@/components/tools/context";
import { TodayView } from "@/components/views/TodayView";
import { useCycle } from "@/lib/useCycle";

export default function TodayScreen() {
  const { state, info, today } = useCycle();
  const { openTool } = useTools();
  return (
    <TodayView
      state={state}
      info={info}
      today={today}
      openTool={openTool}
      openJarvis={() => router.navigate("/jarvis")}
      openCare={() => router.navigate("/care")}
    />
  );
}
