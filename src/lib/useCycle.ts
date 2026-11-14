import { getCycleInfo } from "./cycle";
import { useAppState, useToday } from "./store";

/** Her state, today's key and the current cycle info — what every tab needs. */
export function useCycle() {
  const state = useAppState();
  const today = useToday();
  return { state, today, info: getCycleInfo(state, today) };
}
