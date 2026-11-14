package expo.modules.sosshortcut

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent

/**
 * Volume up + volume down held together for a moment = SOS. Android only lets an
 * Accessibility service see the volume keys outside the app, so she turns this on
 * once in Settings → Accessibility. The keys are never consumed: volume still works.
 */
class SosVolumeService : AccessibilityService() {
  companion object {
    private const val HOLD_MS = 1500L

    fun isEnabled(c: Context): Boolean {
      val enabled = Settings.Secure.getString(c.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
      val me = ComponentName(c, SosVolumeService::class.java)
      return enabled.split(':').any { ComponentName.unflattenFromString(it) == me }
    }
  }

  private val handler = Handler(Looper.getMainLooper())
  private var upDown = false
  private var downDown = false
  private var armed = false

  private val fire = Runnable {
    armed = false
    if (upDown && downDown && SosPrefs.volumeOn(this)) {
      // An accessibility service may open the app from the background.
      SosTrigger.fire(this, canStartActivity = true)
    }
  }

  override fun onKeyEvent(event: KeyEvent): Boolean {
    val pressed = event.action == KeyEvent.ACTION_DOWN
    when (event.keyCode) {
      KeyEvent.KEYCODE_VOLUME_UP -> upDown = pressed
      KeyEvent.KEYCODE_VOLUME_DOWN -> downDown = pressed
      else -> return false
    }
    if (upDown && downDown) {
      if (!armed) {
        armed = true
        handler.postDelayed(fire, HOLD_MS)
      }
    } else if (armed) {
      armed = false
      handler.removeCallbacks(fire)
    }
    return false
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {}

  override fun onInterrupt() {}

  override fun onDestroy() {
    handler.removeCallbacks(fire)
    super.onDestroy()
  }
}
