import { router } from "expo-router";
import { useTools } from "@/components/tools/context";
import { CareView } from "@/components/views/CareView";
import { useCycle } from "@/lib/useCycle";

export default function CareScreen() {
  const { state, info } = useCycle();
  const { openTool } = useTools();
  return <CareView state={state} info={info} openTool={openTool} onBack={() => router.navigate("/")} />;
}
