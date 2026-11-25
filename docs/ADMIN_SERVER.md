# Admin + server: push, location-on-request, OTA — BUILT

The server side is now implemented in the **d-tracker** repo
(`/Users/anubhav/Developer/d-tracker`, deployed at `dhruvi18.vercel.app`). This is
a **single-user** app (one her, one admin = Anubhav), so there is no `user_id` —
tokens and requests are global, exactly like the existing location shares.

Ground rule kept throughout: **a location request always shows on her phone.**
The server sends a data push; the app starts the normal foreground-service share,
which puts a persistent "requested your location" notification on her screen.
There is no server path that reads her location without that notice.

Nothing reaches a phone until she installs a **new app build** containing the
Jarvis-side changes — the APK already on a phone has none of this.

## What was added in d-tracker

- `supabase/schema.sql` — `location_shares.reason` now allows `request`; new tables
  `push_tokens` and `location_requests` (RLS on, no policies, like the rest).
- `src/server/push.ts` — `sendPush` / `getReceipts` against the Expo Push API.
- `src/server/db.ts` — helpers: `savePushToken`, `listPushTokens`, `updatePushToken`,
  `deletePushToken`, `createLocationRequest`, `getPendingRequest`, `markRequestDone`.
- `src/pages/api/push/register.ts` — **her phone** POSTs `{ token, platform }`
  (session-protected). The Jarvis app calls this as `/api/push/register`.
- `src/pages/api/location.ts` — now also:
  - `GET /api/location?pending=1` → `{ request }` (phone's fallback poll)
  - `POST { action: "ack-request", requestId }` → marks the request done
  - `start` accepts `reason: "request"` (short share, 1–30 min, default 3)
- `src/pages/api/admin/request-location.ts` — **admin** POST → creates a request and
  sends a high-priority data push `{ type: "locate", requestId }` to every device.
- `src/pages/api/admin/app-status.ts` — **admin** POST pings each device (silent
  `{ type: "ping" }`) and stores the ticket; GET reads receipts after ~15 min and
  reports installed / looks-uninstalled per device.
- `src/components/admin/AdminApp.tsx` — a "Request & status" card on `/admin` with a
  **Request her location** button and an **Is the app installed?** panel.

## Manual steps that remain (you must do these)

1. **Run the schema.** Supabase dashboard → SQL Editor → paste `supabase/schema.sql`
   → Run. It's safe to re-run; it adds the two new tables and widens the reason check.
2. **FCM credentials** (required for Android push to actually deliver):
   - Firebase console → your project → Settings → Service accounts → **Generate new
     private key** (JSON).
   - In the **Jarvis** repo: `bunx eas-cli credentials` → Android → production →
     Google Service Account → upload that key for *Push Notifications (FCM V1)*.
   - Download `google-services.json`, put it at the Jarvis repo root, and add to
     `app.json`: `"android": { "googleServicesFile": "./google-services.json" }`.
3. **(Optional) `EXPO_ACCESS_TOKEN`** in d-tracker `.env` if you turn on Expo's
   "Enhanced Security for Push Notifications". Not needed otherwise.
4. **Rebuild & install the Jarvis app** on her phone (`bun run build:apk`), then open
   it once while signed in so it registers its push token. Only after that do Request,
   app-status, and OTA work.

## How a request flows

1. You tap **Request her location** on `/admin` → `POST /api/admin/request-location`.
2. Server stores a pending `location_requests` row and sends the data push.
3. Her phone (push, or next app open via the `?pending=1` poll) starts a visible
   `reason: "request"` share and POSTs `ack-request`.
4. Points stream into the same `/admin` map as any other share, tagged
   "📍 Requested location".

**Honest limits.** `priority: high` only *may* wake a dozing phone; a powered-off,
offline, or force-stopped phone won't respond until it's next used — there is no
way (by design, none) to pull a location she can't see. And `DeviceNotRegistered`
lags a real uninstall and never fires for a phone that's merely off, so read
"uninstalled" as *probably*, never as proof she's unreachable. If you're worried
about her safety, people near her and the police are still the right call.

## OTA updates

Already wired in the Jarvis app (`src/lib/updates.ts`, `app.json` runtimeVersion +
updates.url). To ship JS/asset changes after the first build:
`bunx eas-cli update:configure`, set a `channel` on the build profile in `eas.json`,
rebuild once, then `bunx eas-cli update --channel preview --message "..."`. Native
changes (new permissions/modules, the FCM setup above) still need a new build.
