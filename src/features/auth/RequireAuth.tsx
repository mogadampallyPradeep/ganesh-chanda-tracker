import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './useAuth'

export function RequireAuth() {
  const { member, loading } = useAuth()
  if (loading) return null
  return member ? <Outlet /> : <Navigate to="/login" replace />
}
