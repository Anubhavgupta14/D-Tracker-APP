import { useTools } from "@/components/tools/context";
import { JarvisView } from "@/components/views/JarvisView";
import { useCycle } from "@/lib/useCycle";

export default function JarvisScreen() {
  const { state, info, today } = useCycle();
  const { openTool } = useTools();
  return <JarvisView state={state} info={info} today={today} openTool={openTool} />;
}
