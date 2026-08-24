import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { AuthContext, type SessionMember } from './useAuth'

const STORAGE_KEY = 'gct.session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<SessionMember | null>(null)
  const [loading, setLoading] = useState(true)

  // Re-read the member's current row from the server and reconcile the cached
  // session — so a rename, admin promote/demote, or removal self-corrects on the
  // next app open instead of persisting a stale localStorage blob.
  const refreshMember = useCallback(async (mobile: string) => {
    const { data, error } = await supabase
      .from('committee_public')
      .select('mobile, name, is_admin')
      .eq('mobile', mobile)
      .maybeSingle()
    if (error) return // transient failure: keep the cached session
    if (!data) {
      // Member no longer exists — end the session.
      localStorage.removeItem(STORAGE_KEY)
      setMember(null)
      return
    }
    const fresh: SessionMember = { mobile: data.mobile, name: data.name, is_admin: data.is_admin }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    setMember(fresh)
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      setLoading(false)
      return
    }
    let stored: SessionMember | null = null
    try {
      stored = JSON.parse(raw) as SessionMember
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    setMember(stored)
    setLoading(false)
    if (stored) void refreshMember(stored.mobile)
  }, [refreshMember])

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
    <AuthContext.Provider
      value={{
        member,
        isAdmin: !!member?.is_admin,
        loading,
        signIn,
        signOut,
        refreshMember: () => (member ? refreshMember(member.mobile) : Promise.resolve()),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
