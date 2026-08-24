import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { AuthContext, type SessionMember } from './useAuth'

const STORAGE_KEY = 'gct.session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<SessionMember | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        setMember(JSON.parse(raw) as SessionMember)
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setLoading(false)
  }, [])

  const signIn = async (mobile: string, password: string) => {
    const p_mobile = mobile.replace(/\D/g, '')
    const { data, error } = await supabase.rpc('member_login', { p_mobile, p_password: password })
    if (error) throw new Error(error.message)
    const row = (Array.isArray(data) ? data[0] : data) as SessionMember | undefined
    if (!row) throw new Error('Wrong mobile number or password')
    const session: SessionMember = { mobile: row.mobile, name: row.name, is_admin: row.is_admin }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    setMember(session)
  }

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY)
    setMember(null)
  }

  return (
    <AuthContext.Provider value={{ member, isAdmin: !!member?.is_admin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
