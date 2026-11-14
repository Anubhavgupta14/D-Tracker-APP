package expo.modules.sosshortcut

import android.Manifest
import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.view.WindowManager

/** Small persisted settings shared by the service, the boot receiver and the JS module. */
object SosPrefs {
  private fun prefs(c: Context) = c.getSharedPreferences("sos_shortcut", Context.MODE_PRIVATE)

  fun enabled(c: Context) = prefs(c).getBoolean("enabled", false)

  fun presses(c: Context) = prefs(c).getInt("presses", 4)

  fun save(c: Context, enabled: Boolean, presses: Int) {
    prefs(c).edit().putBoolean("enabled", enabled).putInt("presses", presses).apply()
  }

  /** The volume-keys shortcut can be paused in the app without leaving Accessibility settings. */
  fun volumeOn(c: Context) = prefs(c).getBoolean("volume", true)

  fun setVolumeOn(c: Context, on: Boolean) {
    prefs(c).edit().putBoolean("volume", on).apply()
  }

  fun markPending(c: Context) {
    prefs(c).edit().putLong("pending", System.currentTimeMillis()).apply()
  }

  /** True once if a shortcut fired in the last 3 minutes and the app hasn't picked it up yet. */
  fun consumePending(c: Context): Boolean {
    val at = prefs(c).getLong("pending", 0L)
    prefs(c).edit().remove("pending").apply()
    return at > 0L && System.currentTimeMillis() - at < 180_000L
  }
}

/**
 * Always-on listener (a foreground service with a quiet notification). Android doesn't
 * let apps see the power button itself, but every press turns the screen on or off,
 * so N screen on/off changes in quick succession = the SOS shortcut.
 */
class SosGuardService : Service() {
  companion object {
    const val GUARD_CHANNEL = "sos_guard"
    const val ALERT_CHANNEL = "sos_alert"
    const val GUARD_ID = 7101
    const val ALERT_ID = 7102
    const val EXTRA_TRIGGER = "expo.modules.sosshortcut.TRIGGER"
    private const val EXTRA_FROM_BOOT = "expo.modules.sosshortcut.FROM_BOOT"

    @Volatile
    var running = false

    fun start(context: Context, fromBoot: Boolean = false) {
      val intent = Intent(context, SosGuardService::class.java).putExtra(EXTRA_FROM_BOOT, fromBoot)
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, SosGuardService::class.java))
    }

    fun ensureChannels(c: Context) {
      if (Build.VERSION.SDK_INT < 26) return
      val nm = c.getSystemService(NotificationManager::class.java) ?: return
      val guard = NotificationChannel(GUARD_CHANNEL, "SOS shortcut", NotificationManager.IMPORTANCE_LOW)
      guard.description = "Keeps the power-button SOS shortcut ready."
      guard.setShowBadge(false)
      nm.createNotificationChannel(guard)
      val alert = NotificationChannel(ALERT_CHANNEL, "SOS alerts", NotificationManager.IMPORTANCE_HIGH)
      alert.description = "Opens Help mode when the SOS shortcut is pressed."
      alert.enableVibration(true)
      nm.createNotificationChannel(alert)
    }

    /** Show the app over the lock screen (and wake the screen) only while Help mode needs it. */
    fun showOverLockScreen(activity: Activity, on: Boolean) {
      activity.runOnUiThread {
        if (Build.VERSION.SDK_INT >= 27) {
          activity.setShowWhenLocked(on)
          activity.setTurnScreenOn(on)
        } else {
          setLegacyLockFlags(activity, on)
        }
      }
    }

    @Suppress("DEPRECATION")
    private fun setLegacyLockFlags(activity: Activity, on: Boolean) {
      val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      if (on) activity.window.addFlags(flags) else activity.window.clearFlags(flags)
    }
  }

  private val presses = ArrayDeque<Long>()
  private var lastTrigger = 0L
  private var receiver: BroadcastReceiver? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // A restart by the system (null intent) is treated like boot: no location type.
    val fromBoot = intent?.getBooleanExtra(EXTRA_FROM_BOOT, true) ?: true
    // Must go foreground promptly after startForegroundService, even if we then stop.
    goForeground(fromBoot)
    if (!SosPrefs.enabled(this)) {
      stopSelf()
      return START_NOT_STICKY
    }
    listen()
    running = true
    return START_STICKY
  }

  override fun onDestroy() {
    receiver?.let {
      try {
        unregisterReceiver(it)
      } catch (e: Exception) {
      }
    }
    receiver = null
    running = false
    super.onDestroy()
  }

  private fun hasLocation(): Boolean =
    checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

  private fun goForeground(fromBoot: Boolean) {
    ensureChannels(this)
    val notification = guardNotification()
    if (Build.VERSION.SDK_INT >= 34) {
      val base = ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
      // The location type lets Help mode get a fix even when it starts from the lock screen.
      // Android only allows it when started from the app (not at boot) with location granted.
      if (!fromBoot && hasLocation()) {
        try {
          startForeground(GUARD_ID, notification, base or ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
          return
        } catch (e: Exception) {
        }
      }
      startForeground(GUARD_ID, notification, base)
    } else {
      startForeground(GUARD_ID, notification)
    }
  }

  private fun guardNotification(): Notification {
    val n = SosPrefs.presses(this)
    val b = SosTrigger.builder(this, GUARD_CHANNEL)
      .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
      .setContentTitle("SOS shortcut is on")
      .setContentText("Press the power button $n times quickly to start Help mode.")
      .setOngoing(true)
      .setShowWhen(false)
    SosTrigger.openAppIntent(this, false)?.let {
      b.setContentIntent(PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    }
    return b.build()
  }

  private fun listen() {
    if (receiver != null) return
    val r = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_SCREEN_ON || intent.action == Intent.ACTION_SCREEN_OFF) onPress()
      }
    }
    val filter = IntentFilter()
    filter.addAction(Intent.ACTION_SCREEN_ON)
    filter.addAction(Intent.ACTION_SCREEN_OFF)
    if (Build.VERSION.SDK_INT >= 33) registerReceiver(r, filter, Context.RECEIVER_NOT_EXPORTED) else registerReceiver(r, filter)
    receiver = r
  }

  private fun onPress() {
    val now = SystemClock.elapsedRealtime()
    val need = SosPrefs.presses(this).coerceIn(4, 6)
    presses.addLast(now)
    while (presses.size > need) presses.removeFirst()
    // N presses within about 0.8 s each, and not again right after a trigger.
    if (presses.size == need && now - presses.first() <= need * 800L && now - lastTrigger > 20_000L) {
      lastTrigger = now
      presses.clear()
      SosTrigger.fire(this, canStartActivity = false)
    }
  }
}

/** Brings the listener back after a reboot or an app update. */
class SosBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    if (!SosPrefs.enabled(context)) return
    try {
      SosGuardService.start(context, fromBoot = true)
    } catch (e: Exception) {
    }
  }
}
