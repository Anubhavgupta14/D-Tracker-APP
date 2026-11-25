import * as Updates from "expo-updates";

/**
 * Over-the-air updates. After this build is installed once, you can ship JS/asset
 * changes with `eas update` and they arrive on next launch — no new APK needed
 * for anything that isn't native. (Native changes — new permissions, new native
 * modules — still need a fresh build she installs.)
 *
 * Call once at startup. No-ops in Expo Go and dev builds, where the Updates API
 * is unavailable.
 */
export async function applyUpdateOnLaunch(): Promise<void> {
  if (!Updates.isEnabled) return;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    /* offline, or already up to date: keep running the current bundle */
  }
}
