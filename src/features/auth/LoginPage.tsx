import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(mobile, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="text-gold text-base" style={{ fontFamily: 'Noto Sans Devanagari, Nirmala UI, system-ui' }}>
            ॥ श्री गणेशाय नमः ॥
          </p>
          <h1 className="font-display text-3xl font-bold text-ink mt-1">Atharva Nidhi</h1>
          <p className="text-ink-soft text-sm mt-1">Committee login</p>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-soft tracking-wide">Mobile number</span>
            <input
              inputMode="numeric"
              autoComplete="username"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="98765 43210"
              className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-soft tracking-wide">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="border border-line bg-bg rounded-xl px-3.5 py-3 text-ink text-base outline-none focus:border-primary"
            />
          </label>

          {error && <p className="text-neg text-sm">{error}</p>}

          <button
            type="submit"
            disabled={busy || !mobile || !password}
            className="mt-1 rounded-xl py-3 font-bold text-white bg-gradient-to-b from-primary to-primary-deep disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>

        <p className="text-center text-ink-soft text-xs mt-4">Only committee members can sign in.</p>
      </form>
    </div>
  )
}
