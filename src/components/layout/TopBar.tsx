import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/useAuth'
import { useFundSettings } from '../../features/settings/useFundSettings'
import { useExportStatement } from '../../features/export/useExportStatement'

export function TopBar() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const fundSettings = useFundSettings()
  const { exportNow, ready: exportReady } = useExportStatement()
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const close = () => setMenuOpen(false)
  const go = (path: string) => {
    close()
    navigate(path)
  }

  const publicUrl = fundSettings.data
    ? `${window.location.origin}/s/${fundSettings.data.public_token}`
    : null

  const onShare = async () => {
    if (!publicUrl) return
    const message = `${fundSettings.data?.mandal_name ?? 'Our mandal'} — live chanda statement:\n${publicUrl}`
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be unavailable (insecure context) — the WhatsApp link still works
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
  }

  const onExport = () => {
    close()
    exportNow()
  }

  const onSignOut = () => {
    close()
    signOut()
    navigate('/login', { replace: true })
  }

  const mandalName = fundSettings.data?.mandal_name ?? 'AtharvNidhi'

  return (
    <header className="shrink-0 relative bg-surface border-b border-line px-4 py-3 flex items-center justify-between">
      <span className="font-display text-lg font-bold text-ink">{mandalName}</span>

      <button
        type="button"
        aria-label="Menu"
        onClick={() => setMenuOpen((v) => !v)}
        className="p-1.5 -mr-1.5 text-ink-soft"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5.5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="18.5" r="1.8" />
        </svg>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-4 top-full mt-1 z-20 w-56 bg-surface border border-line rounded-xl shadow-md overflow-hidden">
            <MenuItem label={copied ? 'Link copied!' : 'Share public link'} onClick={onShare} disabled={!publicUrl} />
            <MenuItem label="Export to Excel" onClick={onExport} disabled={!exportReady} />
            <MenuItem label="Categories" onClick={() => go('/categories')} />
            <MenuItem label="Committee" onClick={() => go('/committee')} />
            <MenuItem label="Fund settings" onClick={() => go('/settings')} />
            <button
              type="button"
              onClick={onSignOut}
              className="w-full text-left px-4 py-2.5 text-sm text-neg border-t border-line font-medium"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </header>
  )
}

function MenuItem({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-surface-2 disabled:text-ink-soft disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      {label}
    </button>
  )
}
