# Jarvis — D-Tracker for Android

The D-Tracker web app as a native Android app (Expo + React Native). Every tab and feature from the website
is here: Today, Calendar, Glow, Jarvis and Care, plus the comfort tools (chocolate box, hot water bag,
Physio Rx stretches, Cramp Crusher, and Call him).

## How it shares the same database

Jarvis doesn't connect to Supabase directly. It calls the **same D-Tracker server** (the Next.js API routes)
that the website uses:

| Endpoint | Used for |
| --- | --- |
| `/api/auth` | passcode unlock (returns a session token that the app keeps in SecureStore) |
| `/api/data` | load everything + background sync (same `SyncOp` protocol as the web) |
| `/api/jarvis`, `/api/jarvis-voice` | the Jarvis agent (streamed NDJSON) and Gemini TTS |
| `/api/glow` | the Glow makeup assistant (Ask Glow streams over SSE) |
| `/api/claim` | Chocolate Box "order the real one" email |
| `/api/holidays` | Indian public holidays for long weekends |

Because of this, the website and the app always show the same data, and the Supabase secret key, Gemini key,
Tavily key and Gmail password stay on the server and never ship inside the APK.

The app sends the session as `Authorization: Bearer <token>`. That needs the small change in the D-Tracker
repo (`src/server/session.ts` and `src/pages/api/auth.ts`), so **deploy D-Tracker with that change first**.

## Setup

```bash
cp .env.example .env        # then set EXPO_PUBLIC_API_URL to your deployed D-Tracker URL
npm install
```

## Run it while developing

Voice input needs a native build, but everything else runs in Expo Go:

```bash
npx expo start              # scan the QR code with Expo Go on the phone
```

To use your local D-Tracker server instead, run `npm run dev -- -H 0.0.0.0` in d-tracker and set
`EXPO_PUBLIC_API_URL=http://<your-computer-ip>:3000`.

## Build the APK

No Android Studio is needed. Expo builds it in the cloud:

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview    # gives a link to download/install the .apk
```

`EXPO_PUBLIC_API_URL` is baked in at build time: keep it in `.env`, or add it as an EAS environment variable.
For the Play Store, use `--profile production` (an .aab).

## Where things are

```
src/app/                 routes (Expo Router): _layout.tsx = fonts + passcode gate, (tabs)/ = the 5 tabs
src/components/views/    Today, Calendar, Glow, Jarvis, Care
src/components/tools/    comfort tools (opened in a bottom sheet from any tab)
src/components/ui.tsx    shared UI kit (text, cards, buttons, chips, slider…)
src/lib/                 cycle maths, sync, store, Jarvis agent + voice, Glow client (mostly shared with the web)
```

Names, birthdays and his phone number live in `src/lib/config.ts`, the same file as the web app's.
# D-Tracker-APP
