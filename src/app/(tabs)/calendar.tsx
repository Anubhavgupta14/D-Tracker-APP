import { CalendarView } from "@/components/views/CalendarView";
import { useCycle } from "@/lib/useCycle";

export default function CalendarScreen() {
  const { state, info, today } = useCycle();
  return <CalendarView state={state} info={info} today={today} />;
}
