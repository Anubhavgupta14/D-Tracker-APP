import * as Location from "expo-location";
import { useSyncExternalStore } from "react";
import { Linking } from "react-native";
import { api } from "../api";
import { telLink } from "../cheer";
import type { AppState, CycleInfo, MoodId } from "../cycle";
import { fmtShort, todayKey, type DayKey } from "../dates";
import { armHelp, helpState } from "../help";
import { actions } from "../store";
import { enqueue } from "../sync";
import type { DataSnapshot } from "../sync-protocol";
import type { DatePlan, JarvisContext, JarvisEvent, JarvisRequest, ToolCall } from "./protocol";

/* ============================================================
   Chat state (module-level, so a reply keeps streaming even if
   she switches tabs mid-answer). Saved to Supabase via sync.
   ============================================================ */

export type Msg =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "jarvis"; text: string }
  | { id: string; kind: "tool"; label: string; status: "run" | "ok" | "err"; summary?: string }
  | { id: string; kind: "plan"; plan: DatePlan }
  | { id: string; kind: "call"; reason?: string }
  | { id: string; kind: "error"; text: string };

export interface ChatState {
  msgs: Msg[];
  busy: boolean;
  status: string;
}

const MAX_MSGS = 120;
let chat: ChatState = { msgs: [], busy: false, status: "" };
const listeners = new Set<() => void>();

const get = () => chat;

function set(patch: Partial<ChatState>) {
  const prev = chat.msgs;
  chat = { ...chat, ...patch };
  if (chat.msgs.length > MAX_MSGS) chat.msgs = chat.msgs.slice(-MAX_MSGS);
  // Save new or changed messages (objects are replaced on change, so identity tells us).
  if (patch.msgs) {
    const old = new Set(prev);
    const changed = chat.msgs.filter((m) => !old.has(m));
    if (changed.length) {
      enqueue({
        op: "jarvis.upsert",
        rows: changed.map(({ id, kind, ...payload }) => ({ id, kind, payload })),
      });
    }
  }
  listeners.forEach((l) => l());
}

/** Load saved messages from the server snapshot. */
export function hydrateChat(rows: DataSnapshot["messages"]) {
  const msgs = rows.map((r) => {
    const m = { id: r.id, kind: r.kind, ...r.payload } as Msg;
    // A tool that was mid-run when the app closed is no longer running.
    return m.kind === "tool" && m.status === "run" ? { ...m, status: "err" as const } : m;
  });
  chat = { msgs, busy: false, status: "" };
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useChat(): ChatState {
  return useSyncExternalStore(subscribe, get, get);
}

let n = 0;
const uid = () => `${Date.now().toString(36)}-${(n++).toString(36)}`;

const push = (m: Msg) => set({ msgs: [...get().msgs, m] });
const patchMsg = (id: string, patch: Partial<Msg>) =>
  set({ msgs: get().msgs.map((m) => (m.id === id ? ({ ...m, ...patch } as Msg) : m)) });

/** Wipes the conversation everywhere (Jarvis still remembers he has met her). */
export function clearChat() {
  chat = { ...chat, msgs: [], status: "" };
  listeners.forEach((l) => l());
  enqueue({ op: "jarvis.clear" });
}

/* ============================================================
   Context sent with each message
   ============================================================ */

export function buildContext(state: AppState, info: CycleInfo | null, today: DayKey): JarvisContext {
  const log = state.logs[today] ?? {};
  const now = new Date();
  const off = -now.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const pad = (x: number) => String(Math.floor(Math.abs(x))).padStart(2, "0");
  return {
    now: `${now.toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })} (UTC${sign}${pad(off / 60)}:${pad(off % 60)})`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cycle: info && {
      phase: `${info.phase.name} / ${info.phase.clinical}`,
      day: info.day,
      cycleLength: info.cycleLength,
      onPeriod: info.onPeriod,
      periodDay: info.onPeriod ? info.periodDay : undefined,
      nextPeriod: fmtShort(info.nextStart),
      daysUntilNext: info.daysUntilNext,
      ovulation: fmtShort(info.ovulation),
      fertileWindow: `${fmtShort(info.fertileStart)}–${fmtShort(info.fertileEnd)}`,
    },
    today: { pain: log.pain, moods: log.moods },
    canCall: state.settings.partnerPhone.replace(/\D/g, "").length >= 8,
    helpMode: true,
  };
}

/* ============================================================
   Running a turn
   ============================================================ */

export interface Effects {
  phone: string;
  openTool: (tool: "chocolate" | "hotbag" | "stretch" | "game") => void;
  /** Called with Jarvis's final reply (to speak it). */
  onReply: (text: string) => void;
}

export async function sendMessage(text: string, context: JarvisContext, fx: Effects) {
  const clean = text.trim();
  if (!clean || get().busy) return;
  push({ id: uid(), kind: "user", text: clean });
  set({ busy: true, status: "Thinking…" });
  const toolMsgs = new Map<number, string>();
  try {
    await stream({ message: clean, context }, fx, toolMsgs);
  } finally {
    set({ busy: false, status: "" });
  }
}

async function stream(req: JarvisRequest, fx: Effects, toolMsgs: Map<number, string>): Promise<void> {
  let res: Response;
  try {
    res = await api("/api/jarvis", { method: "POST", body: JSON.stringify(req) });
  } catch {
    return fail("I can't reach my servers. Is the internet on, Miss Dhruvi?");
  }
  if (res.status === 401) return fail("I've been locked, Miss Dhruvi. Reopen the app and enter the passcode.");
  if (!res.ok || !res.body) return fail(`Server error (${res.status}).`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let resume: JarvisRequest | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line) as JarvisEvent;
      const next = await handle(ev, req, fx, toolMsgs);
      if (next) resume = next;
    }
    if (done) break;
  }
  if (resume) return stream(resume, fx, toolMsgs);
}

async function handle(
  ev: JarvisEvent,
  req: JarvisRequest,
  fx: Effects,
  toolMsgs: Map<number, string>,
): Promise<JarvisRequest | null> {
  switch (ev.type) {
    case "status":
      set({ status: ev.text });
      return null;
    case "tool": {
      const id = uid();
      toolMsgs.set(ev.call.index, id);
      push({ id, kind: "tool", label: ev.label, status: "run" });
      set({ status: ev.label + "…" });
      return null;
    }
    case "tool_done": {
      const id = toolMsgs.get(ev.index);
      if (id) patchMsg(id, { status: ev.ok ? "ok" : "err", summary: ev.summary });
      return null;
    }
    case "action":
      runAction(ev.call, fx);
      return null;
    case "ask": {
      const answers: Record<number, Record<string, unknown>> = {};
      for (const call of ev.calls) answers[call.index] = await answer(call);
      return { context: req.context, resume: { answers } };
    }
    case "final":
      if (ev.text) {
        push({ id: uid(), kind: "jarvis", text: ev.text });
        // Don't talk over the siren.
        if (helpState().phase !== "active") fx.onReply(ev.text);
      }
      return null;
    case "error":
      fail(friendlyError(ev.message));
      return null;
  }
}

function fail(text: string) {
  push({ id: uid(), kind: "error", text });
}

function friendlyError(msg: string) {
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg))
    return "I've used up today's Gemini allowance, Miss Dhruvi. The Engineer needs to top up my quota (or try again later).";
  if (/timed out|503|overloaded|UNAVAILABLE/i.test(msg)) return "My servers are a touch overloaded. Give it a moment and try again.";
  if (/key missing|API key/i.test(msg)) return "My Gemini key isn't configured on the server.";
  return `Something went wrong: ${msg.slice(0, 160)}`;
}

/* ---------- Things only the phone can do ---------- */

function runAction(call: ToolCall, fx: Effects) {
  const a = call.args;
  switch (call.name) {
    case "call_engineer":
      push({ id: uid(), kind: "call", reason: a.reason as string | undefined });
      // Open the dialler straight away; the card's button is the fallback.
      setTimeout(() => {
        void Linking.openURL(telLink(fx.phone)).catch(() => {});
      }, 600);
      break;
    case "show_date_plan":
      push({ id: uid(), kind: "plan", plan: a as unknown as DatePlan });
      break;
    case "open_comfort_tool":
      fx.openTool(a.tool as "chocolate" | "hotbag" | "stretch" | "game");
      break;
    case "start_help_mode":
      armHelp(typeof a.reason === "string" ? a.reason.slice(0, 200) : undefined);
      break;
    case "log_cycle": {
      const day = typeof a.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : todayKey();
      if (a.action === "period_started") actions.startPeriod(day);
      if (a.action === "period_ended") actions.endPeriod(day);
      // Pain and moods can ride along with any action.
      if (typeof a.pain === "number") actions.logDay(day, { pain: Math.max(0, Math.min(10, Math.round(a.pain))) });
      if (Array.isArray(a.moods)) actions.logDay(day, { moods: a.moods as MoodId[] });
      break;
    }
  }
}

async function answer(call: ToolCall): Promise<Record<string, unknown>> {
  if (call.name !== "get_location") return { error: "Unsupported" };
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return { error: "She declined location access." };
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 300_000 })) ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((r) => setTimeout(() => r(null), 20_000)),
      ]));
    if (!pos) return { error: "Couldn't get a location fix." };
    return {
      lat: Number(pos.coords.latitude.toFixed(5)),
      lng: Number(pos.coords.longitude.toFixed(5)),
      accuracy_m: Math.round(pos.coords.accuracy ?? 0),
    };
  } catch {
    return { error: "Couldn't get a location fix." };
  }
}
