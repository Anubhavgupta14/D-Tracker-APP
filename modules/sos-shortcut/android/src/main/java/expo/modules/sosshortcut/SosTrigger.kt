package expo.modules.sosshortcut

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings

/** What happens when either shortcut (power button or volume keys) fires. */
object SosTrigger {
  private var lastFired = 0L

  fun builder(c: Context, channel: String): Notification.Builder =
    if (Build.VERSION.SDK_INT >= 26) Notification.Builder(c, channel) else legacyBuilder(c)

  @Suppress("DEPRECATION")
  private fun legacyBuilder(c: Context): Notification.Builder = Notification.Builder(c).setPriority(Notification.PRIORITY_MAX)

  fun openAppIntent(c: Context, trigger: Boolean): Intent? =
    c.packageManager.getLaunchIntentForPackage(c.packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      if (trigger) putExtra(SosGuardService.EXTRA_TRIGGER, true)
    }

  /**
   * @param canStartActivity true when the caller may open the app from the background
   *   (an accessibility service may; a foreground service needs "Display over other apps").
   */
  fun fire(c: Context, canStartActivity: Boolean) {
    val now = SystemClock.elapsedRealtime()
    if (now - lastFired < 20_000L) return
    lastFired = now

    SosPrefs.markPending(c)
    vibrate(c)
    // If the app is alive, Help mode starts right now (siren + alert), even before it's on screen.
    SosShortcutModule.dispatchTrigger()

    val launch = openAppIntent(c, true) ?: return
    if (canStartActivity || Build.VERSION.SDK_INT < 29 || Settings.canDrawOverlays(c)) {
      try {
        c.startActivity(launch)
      } catch (e: Exception) {
      }
    }
    // A full-screen alert opens it over the lock screen; otherwise it's a tap-to-open banner.
    SosGuardService.ensureChannels(c)
    val pi = PendingIntent.getActivity(c, 1, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val alert = builder(c, SosGuardService.ALERT_CHANNEL)
      .setSmallIcon(android.R.drawable.ic_dialog_alert)
      .setContentTitle("SOS started")
      .setContentText("Opening Help mode. Tap here if it doesn't open.")
      .setCategory(Notification.CATEGORY_ALARM)
      .setContentIntent(pi)
      .setFullScreenIntent(pi, true)
      .setAutoCancel(true)
      .build()
    try {
      c.getSystemService(NotificationManager::class.java)?.notify(SosGuardService.ALERT_ID, alert)
    } catch (e: Exception) {
    }
  }

  private fun vibrate(c: Context) {
    val pattern = longArrayOf(0, 500, 150, 500, 150, 500)
    try {
      if (Build.VERSION.SDK_INT >= 31) {
        c.getSystemService(VibratorManager::class.java)?.defaultVibrator?.vibrate(VibrationEffect.createWaveform(pattern, -1))
      } else if (Build.VERSION.SDK_INT >= 26) {
        legacyVibrator(c)?.vibrate(VibrationEffect.createWaveform(pattern, -1))
      } else {
        legacyVibrate(c, pattern)
      }
    } catch (e: Exception) {
    }
  }

  @Suppress("DEPRECATION")
  private fun legacyVibrator(c: Context): Vibrator? = c.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator

  @Suppress("DEPRECATION")
  private fun legacyVibrate(c: Context, pattern: LongArray) {
    legacyVibrator(c)?.vibrate(pattern, -1)
  }
}
