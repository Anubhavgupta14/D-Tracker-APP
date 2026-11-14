package expo.modules.sosshortcut

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

/** JS side of the power-button SOS shortcut. */
class SosShortcutModule : Module() {
  companion object {
    private val observers = mutableSetOf<() -> Unit>()

    /** Called by the service when the pattern is pressed; starts Help mode if JS is running. */
    fun dispatchTrigger() {
      Handler(Looper.getMainLooper()).post {
        observers.toList().forEach { it() }
      }
    }
  }

  private var observer: (() -> Unit)? = null

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("SosShortcut")

    Events("onTrigger")

    OnStartObserving("onTrigger") {
      val weak = WeakReference(this@SosShortcutModule)
      val o: () -> Unit = { weak.get()?.sendEvent("onTrigger", Bundle()) }
      observers.add(o)
      observer = o
    }

    OnStopObserving("onTrigger") {
      observer?.let { observers.remove(it) }
      observer = null
    }

    Function("isEnabled") {
      SosPrefs.enabled(context)
    }

    Function("isRunning") {
      SosGuardService.running
    }

    Function("getPresses") {
      SosPrefs.presses(context)
    }

    Function("enable") { presses: Int ->
      SosPrefs.save(context, true, presses.coerceIn(4, 6))
      // Restart so the notification text and the location type are up to date.
      SosGuardService.start(context)
    }

    Function("disable") {
      SosPrefs.save(context, false, SosPrefs.presses(context))
      SosGuardService.stop(context)
    }

    /** Volume up + down shortcut: whether Android has the service on, and whether it's on in the app. */
    Function("volumeStatus") {
      mapOf("accessibility" to SosVolumeService.isEnabled(context), "on" to SosPrefs.volumeOn(context))
    }

    Function("setVolumeOn") { on: Boolean ->
      SosPrefs.setVolumeOn(context, on)
    }

    /** True once if the app was opened by the shortcut (picked up at startup). */
    Function("consumePending") {
      SosPrefs.consumePending(context)
    }

    Function("status") {
      val c = context
      val nm = c.getSystemService(NotificationManager::class.java)
      val pm = c.getSystemService(PowerManager::class.java)
      mapOf(
        "notifications" to (nm?.areNotificationsEnabled() ?: true),
        "overlay" to Settings.canDrawOverlays(c),
        "fullScreen" to (if (Build.VERSION.SDK_INT >= 34) nm?.canUseFullScreenIntent() ?: true else true),
        "battery" to (pm?.isIgnoringBatteryOptimizations(c.packageName) ?: true)
      )
    }

    /** Opens the Android settings page that grants one of the permissions above. */
    Function("openSettings") { which: String ->
      val c = context
      val pkg = Uri.parse("package:${c.packageName}")
      val intent = when (which) {
        "overlay" -> Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, pkg)
        "fullScreen" ->
          if (Build.VERSION.SDK_INT >= 34) Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg)
          else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
        "battery" -> Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkg)
        "accessibility" -> Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        "appInfo" -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
        "notifications" ->
          if (Build.VERSION.SDK_INT >= 26) Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, c.packageName)
          else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
        else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        c.startActivity(intent)
      } catch (e: Exception) {
        c.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    /** While Help mode is on, the app shows over the lock screen; off again afterwards (privacy). */
    Function("setShowOnLockScreen") { on: Boolean ->
      val activity = appContext.currentActivity
      if (activity != null) SosGuardService.showOverLockScreen(activity, on)
    }
  }
}
