import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/useAuth'

const inertMenuItems = ['Share public link', 'Export to Excel', 'Categories', 'Committee', 'Fund settings']

export function TopBar() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const onSignOut = () => {
    setMenuOpen(false)
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="shrink-0 relative bg-surface border-b border-line px-4 py-3 flex items-center justify-between">
      <span className="font-display text-lg font-bold text-ink">Atharva Nidhi</span>

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
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-4 top-full mt-1 z-20 w-56 bg-surface border border-line rounded-xl shadow-md overflow-hidden">
            {inertMenuItems.map((label) => (
              <button
                key={label}
                type="button"
                disabled
                className="w-full text-left px-4 py-2.5 text-sm text-ink-soft opacity-50 cursor-not-allowed"
              >
                {label}
              </button>
            ))}
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
