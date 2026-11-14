package expo.modules.sosshortcut

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.lang.ref.WeakReference

class SosShortcutPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context?): List<ReactActivityLifecycleListener> {
    return listOf(SosActivityListener())
  }
}

/**
 * When the shortcut opens the app, show it over the lock screen straight away
 * (before JS has even loaded) and clear the "SOS started" banner.
 */
class SosActivityListener : ReactActivityLifecycleListener {
  private var activity: WeakReference<Activity>? = null

  override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
    if (activity == null) return
    this.activity = WeakReference(activity)
    handle(activity, activity.intent)
  }

  override fun onResume(activity: Activity?) {
    if (activity != null) this.activity = WeakReference(activity)
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    activity?.get()?.let { handle(it, intent) }
    return false
  }

  private fun handle(activity: Activity, intent: Intent?) {
    if (intent?.getBooleanExtra(SosGuardService.EXTRA_TRIGGER, false) != true) return
    SosGuardService.showOverLockScreen(activity, true)
    try {
      activity.getSystemService(NotificationManager::class.java)?.cancel(SosGuardService.ALERT_ID)
    } catch (e: Exception) {
    }
  }
}
