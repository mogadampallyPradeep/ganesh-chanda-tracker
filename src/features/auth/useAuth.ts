import { createContext, useContext } from 'react'

export interface SessionMember {
  mobile: string
  name: string
  is_admin: boolean
}

export interface AuthValue {
  member: SessionMember | null
  isAdmin: boolean
  loading: boolean
  signIn: (mobile: string, password: string) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
