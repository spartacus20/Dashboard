import React from 'react'
import { useAuth } from '../context/AuthContext'
import { Login } from './Login'
import { SuspendedAccount } from './SuspendedAccount'
import { isAdmin, isClientActive, getSubscriptionExpiry } from '../lib/supabase'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3">
        <span className="text-[#05163b] text-xl font-bold tracking-wide">uMindsAI Dashboard</span>
        <img src="/favicon.ico" alt="logo" className="w-10 h-10" />
        <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-[#1e4a8a] animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  // Admin siempre pasa — verá un banner en el dashboard si el cliente está suspendido
  if (!isAdmin() && !isClientActive()) {
    return <SuspendedAccount expiresAt={getSubscriptionExpiry()} />
  }

  return <>{children}</>
}
