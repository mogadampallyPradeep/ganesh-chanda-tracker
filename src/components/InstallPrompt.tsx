import { useEffect, useState } from 'react'

// The beforeinstallprompt event isn't in the standard TS lib.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'install-hint-dismissed'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes standalone on navigator, not via display-mode
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

/**
 * Unobtrusive, dismissible install helper.
 * - Android/Chromium: captures `beforeinstallprompt` and offers a real Install button.
 * - iOS Safari: shows a short "Add to Home Screen" hint (iOS has no programmatic prompt).
 * Renders nothing once the app is already installed (standalone) or after dismissal.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1' || isStandalone(),
  )

  useEffect(() => {
    if (dismissed) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    const onInstalled = () => {
      setDeferred(null)
      setShowIosHint(false)
      setDismissed(true)
    }
    window.addEventListener('appinstalled', onInstalled)

    // iOS never fires beforeinstallprompt — offer the manual hint instead.
    if (isIos() && !isStandalone()) setShowIosHint(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [dismissed])

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    dismiss()
  }

  if (dismissed || (!deferred && !showIosHint)) return null

  return (
    <div className="shrink-0 bg-surface-2 border-t border-line px-4 py-2.5 flex items-center gap-3">
      <div className="flex-1 text-sm text-ink">
        {deferred ? (
          <span>Install AtharvNidhi for quick access.</span>
        ) : (
          <span>
            Install this app: tap <span className="font-semibold">Share</span> then{' '}
            <span className="font-semibold">Add to Home Screen</span>.
          </span>
        )}
      </div>
      {deferred && (
        <button
          type="button"
          onClick={() => void install()}
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-white bg-primary-deep"
        >
          Install
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-ink-soft p-1 -mr-1"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
