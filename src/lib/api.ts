import * as SecureStore from "expo-secure-store";

/**
 * Jarvis talks to the same D-Tracker server (the Next.js app) as the website,
 * so it shares the same Supabase database and the same secret keys stay on the
 * server. Set the server's address in `.env` as EXPO_PUBLIC_API_URL.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

const TOKEN_KEY = "dt_session";
let token: string | null = null;

/** Load the saved session token (once, at startup). */
export async function loadToken(): Promise<string | null> {
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    token = null;
  }
  return token;
}

export async function saveToken(t: string | null) {
  token = t;
  try {
    if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* keep the in-memory copy */
  }
}

export const hasToken = () => Boolean(token);

/** fetch() against the D-Tracker server, with the session token attached. */
export function api(path: string, init: RequestInit = {}): Promise<Response> {
  if (!API_URL) {
    return Promise.reject(new Error("Server address missing: set EXPO_PUBLIC_API_URL in Jarvis/.env"));
  }
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

/** POST JSON and parse a JSON reply; throws the server's error message on failure. */
export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await api(path, { method: "POST", body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Something went wrong (${res.status}).`);
  return json as T;
}
