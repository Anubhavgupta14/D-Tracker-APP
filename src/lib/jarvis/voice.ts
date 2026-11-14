/**
 * Voice in (Android speech recognition through expo-speech-recognition's
 * Web Speech–compatible wrapper) and voice out (Gemini TTS, with the
 * phone's own British voice as a fallback). Module-level so playback
 * continues across tab switches.
 */
import { requireOptionalNativeModule } from "expo";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import * as Speech from "expo-speech";
import { api } from "../api";

/* ---------- Speech recognition ---------- */

type SR = typeof import("expo-speech-recognition");
let srMod: SR | null | undefined;

/**
 * The native module is missing in Expo Go (and requiring it throws there), so
 * it's loaded lazily and every use is guarded: no module = no voice input.
 */
function sr(): SR | null {
  if (srMod === undefined) {
    // Check first: in Expo Go the module isn't there, and loading the package anyway logs a red error.
    if (!requireOptionalNativeModule("ExpoSpeechRecognition")) return (srMod = null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      srMod = require("expo-speech-recognition") as SR;
    } catch {
      srMod = null;
    }
  }
  return srMod;
}

export const canListen = () => {
  const m = sr();
  if (!m) return false;
  try {
    return m.ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
};

type Rec = InstanceType<SR["ExpoWebSpeechRecognition"]>;
let active: Rec | null = null;
/** Bumped by stopListening() so a listen() still waiting on the permission prompt gives up. */
let listenToken = 0;

/** How long to wait for her to start talking before the mic closes itself. */
const SILENCE_MS = 7000;

/** Listen once. `onInterim` gets live text; resolves with the final transcript ("" if nothing). */
export async function listen(onInterim: (t: string) => void): Promise<string> {
  const m = sr();
  if (!m) throw new Error("Speech recognition isn't supported on this phone.");
  stopListening();
  const token = listenToken;
  try {
    const perm = await m.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) throw new Error("Microphone permission was denied.");
  } catch (e) {
    throw e instanceof Error ? e : new Error("Microphone permission was denied.");
  }
  if (token !== listenToken) return "";

  return new Promise((resolve, reject) => {
    let rec: Rec;
    try {
      rec = new m.ExpoWebSpeechRecognition();
    } catch {
      return reject(new Error("Couldn't start the microphone."));
    }
    active = rec;
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    let settled = false;
    let backup: ReturnType<typeof setTimeout> | undefined;

    // Listeners on this wrapper subscribe to the shared native module, so they
    // must be detached when this session ends or they'd hear the next one too.
    const onResult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      const live = (finalText + " " + interim).trim();
      if (live) clearTimeout(silenceTimer);
      onInterim(live);
    };
    const onError = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      fail(new Error(e.error === "not-allowed" ? "Microphone permission was denied." : `Mic error: ${e.error}`));
    };
    const onEnd = () => finish(finalText);
    const detach = () => {
      try {
        rec.removeEventListener("result", onResult);
        rec.removeEventListener("error", onError);
        rec.removeEventListener("end", onEnd);
      } catch {
        /* already gone */
      }
    };

    const finish = (text: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(silenceTimer);
      clearTimeout(backup);
      detach();
      if (active === rec) active = null;
      resolve(text.trim());
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(silenceTimer);
      clearTimeout(backup);
      detach();
      if (active === rec) active = null;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
      reject(err);
    };
    // No words yet: close the mic. Once she starts, let the utterance finish on its own.
    const silenceTimer = setTimeout(() => {
      try {
        rec.stop();
      } catch {
        /* already ended */
      }
      backup = setTimeout(() => finish(finalText), 500);
    }, SILENCE_MS);

    try {
      rec.addEventListener("result", onResult);
      rec.addEventListener("error", onError);
      rec.addEventListener("end", onEnd);
      rec.start();
    } catch (e) {
      fail(e instanceof Error ? e : new Error("Couldn't start the microphone."));
    }
  });
}

export function stopListening() {
  listenToken++;
  try {
    active?.stop();
  } catch {
    /* already stopped */
  }
  active = null;
}

/* ---------- Speaking ---------- */

let speaking = false;
let cancelToken = 0;
let fileN = 0;
let modeReady: Promise<void> | null = null;
/** The clip playing right now; stop() ends it early (rejects its promise). */
let playing: { stop: () => void } | null = null;
const speakListeners = new Set<(s: boolean) => void>();

function setSpeaking(s: boolean) {
  speaking = s;
  speakListeners.forEach((l) => l(s));
}

export function onSpeakingChange(cb: (s: boolean) => void) {
  speakListeners.add(cb);
  return () => speakListeners.delete(cb);
}

export const isSpeaking = () => speaking;

/** Play even when the phone is on silent (set once). */
function audioMode() {
  modeReady ??= setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  return modeReady;
}

/**
 * The web needs this inside a tap to unlock iOS audio. Android has no such
 * rule, so it just gets the audio mode ready and silences the device voice.
 */
export function unlockAudio() {
  void audioMode();
  try {
    void Speech.stop().catch(() => {});
  } catch {
    /* not available */
  }
}

/** 0..1 loudness of whatever Jarvis is saying right now (for the orb). No analyser on Android, so it shimmers. */
export function level(): number {
  if (!speaking) return 0;
  return 0.35 + Math.random() * 0.25;
}

export function stopSpeaking() {
  cancelToken++;
  playing?.stop();
  playing = null;
  try {
    void Speech.stop().catch(() => {});
  } catch {
    /* not available */
  }
  setSpeaking(false);
}

function removeFile(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    /* cache; the OS cleans it eventually */
  }
}

/** Fetch Gemini TTS for one chunk. Never throws — returns a cached WAV file, or null on failure. */
async function fetchTTS(text: string, token: number): Promise<File | null> {
  try {
    const res = await api("/api/jarvis-voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (token !== cancelToken || !res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (token !== cancelToken || !bytes.length) return null;
    const file = new File(Paths.cache, `jarvis-${fileN++}.wav`);
    file.create({ overwrite: true });
    await file.write(bytes);
    if (token !== cancelToken) {
      removeFile(file);
      return null;
    }
    return file;
  } catch {
    return null;
  }
}

/** Play one audio file to completion (or until cancelled). */
async function playFile(file: File, token: number): Promise<void> {
  await audioMode();
  return new Promise<void>((resolve, reject) => {
    if (token !== cancelToken) {
      removeFile(file);
      return reject(new Error("cancelled"));
    }
    let player: AudioPlayer;
    try {
      player = createAudioPlayer(file.uri);
    } catch {
      removeFile(file);
      return reject(new Error("playback failed"));
    }
    let done = false;
    let armed = false;
    let guard: ReturnType<typeof setTimeout> | undefined;
    const end = (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      sub.remove();
      try {
        player.pause();
      } catch {
        /* already stopped */
      }
      try {
        player.release();
      } catch {
        /* already released */
      }
      if (playing === handle) playing = null;
      removeFile(file);
      if (err) reject(err);
      else resolve();
    };
    const handle = { stop: () => end(new Error("cancelled")) };
    playing = handle;
    const sub = player.addListener("playbackStatusUpdate", (s) => {
      if (s.didJustFinish) return end();
      // Safety net in case the finish event never arrives.
      if (!armed && s.isLoaded && s.duration > 0) {
        armed = true;
        clearTimeout(guard);
        guard = setTimeout(() => end(), (s.duration + 2) * 1000);
      }
    });
    // Never loaded at all: treat as a failure so the device voice takes over.
    guard = setTimeout(() => end(new Error("playback failed")), 15000);
    try {
      player.play();
    } catch {
      end(new Error("playback failed"));
    }
  });
}

/**
 * Split a reply so the first sentence can start playing fast while the rest is still
 * generating. Capped at two parts, so a reply costs at most two TTS calls.
 */
function splitForSpeech(text: string): string[] {
  const t = text.trim();
  if (t.length < 90) return [t]; // short enough to speak in one go
  const first = /^([\s\S]*?[.!?])(\s+)([\s\S]+)$/.exec(t);
  if (!first) return [t];
  let head = first[1];
  let rest = first[3];
  // Don't lead with a trivially short clip ("Yes.") — pull the next sentence in too.
  if (head.length < 25) {
    const second = /^([\s\S]*?[.!?])(\s+)([\s\S]+)$/.exec(rest);
    if (second) {
      head = `${head} ${second[1]}`;
      rest = second[3];
    } else {
      return [t];
    }
  }
  return [head, rest];
}

/**
 * Speak with Gemini's voice; fall back to the device voice if that fails.
 * The first sentence is fetched and played as soon as it's ready while the
 * remainder generates in parallel, so audio starts with much less delay.
 * Resolves when finished.
 */
export async function say(text: string): Promise<void> {
  stopSpeaking();
  const token = cancelToken;
  setSpeaking(true);
  try {
    const chunks = splitForSpeech(text);
    let pending = fetchTTS(chunks[0], token); // kick off the first chunk now
    for (let i = 0; i < chunks.length; i++) {
      const file = await pending;
      if (token !== cancelToken) {
        if (file) removeFile(file);
        return;
      }
      if (!file) {
        // TTS failed: speak whatever's left with the device voice, then stop.
        await deviceVoice(chunks.slice(i).join(" "));
        return;
      }
      // Start the next chunk generating while this one plays.
      if (i + 1 < chunks.length) pending = fetchTTS(chunks[i + 1], token);
      await playFile(file, token);
      if (token !== cancelToken) return;
    }
  } catch {
    if (token === cancelToken) await deviceVoice(text);
  } finally {
    if (token === cancelToken) setSpeaking(false);
  }
}

/** undefined = not looked up yet; null = none found (use the engine's en-GB default). */
let britishVoice: string | null | undefined;

async function pickVoice(): Promise<string | null> {
  if (britishVoice !== undefined) return britishVoice;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const gb = voices.filter((v) => /^en[-_]GB/i.test(v.language));
    britishVoice =
      (
        gb.find((v) => /Daniel|Arthur|\bmale/i.test(v.name) && !/female/i.test(v.name)) ??
        // Google's Android en-GB male voices are named like "en-gb-x-rjs-local" / "-gbd-" / "-gbb-".
        gb.find((v) => /-(rjs|gbd|gbb)-/i.test(v.identifier)) ??
        gb[0]
      )?.identifier ?? null;
  } catch {
    britishVoice = null;
  }
  return britishVoice;
}

async function deviceVoice(text: string): Promise<void> {
  const voice = await pickVoice();
  return new Promise((resolve) => {
    try {
      Speech.speak(text, {
        language: "en-GB",
        voice: voice ?? undefined,
        rate: 1.02,
        pitch: 0.95,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    } catch {
      resolve();
    }
  });
}
