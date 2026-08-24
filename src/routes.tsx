import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { useAuth } from './features/auth/useAuth'

// Temporary home until the app shell (tabs) is built.
function HomePlaceholder() {
  const { member, isAdmin, signOut } = useAuth()
  return (
    <div className="min-h-full grid place-items-center p-6 text-center">
      <div className="max-w-sm">
        <p className="text-gold" style={{ fontFamily: 'Noto Sans Devanagari, Nirmala UI, system-ui' }}>
          ॥ श्री गणेशाय नमः ॥
        </p>
        <h1 className="font-display text-3xl font-bold text-ink mt-1">Ganesh Chanda</h1>
        <p className="text-ink-soft mt-2">
          Signed in as <b className="text-ink">{member?.name}</b>
          {isAdmin && <span className="ml-1 text-primary-deep">(admin)</span>}. Screens are being built.
        </p>
        <button
          onClick={signOut}
          className="mt-5 rounded-xl px-4 py-2 border border-line text-ink-soft"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [{ path: '/', element: <HomePlaceholder /> }],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
