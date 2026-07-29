import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Login } from './Login'
import { SuspendedAccount } from './SuspendedAccount'
import { PendingApproval } from './PendingApproval'
import {
  isAdmin,
  isClientActive,
  getSubscriptionExpiry,
  getClientIdFromSession,
} from '../lib/supabase'
import { fetchAccountStatus, AccountStatus } from '../services/api/accountStatus'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const Cargando: React.FC = () => (
  <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3">
    <span className="text-[#05163b] text-xl font-bold tracking-wide">uMindsAI Dashboard</span>
    <img src="/favicon.ico" alt="logo" className="w-10 h-10" />
    <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-[#1e4a8a] animate-spin" />
  </div>
)

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth()

  // Estado de aprobación de la cuenta. El registro en Supabase Auth está abierto (email y
  // Google), así que autenticarse no implica tener acceso: hace falta que un admin asigne
  // un client_id. Sin este chequeo el usuario entraba al dashboard vacío y veía
  // "No se encontró client_id. Por favor, inicia sesión nuevamente" — un loop, porque
  // volver a loguearse no cambia nada.
  //
  // Arranque optimista: si ya hay clientId en sessionStorage la cuenta está habilitada sin
  // preguntar, así el usuario normal no paga un round-trip extra en cada carga. Solo las
  // cuentas sin clientId (recién llegadas, o en el primer login antes de que getClientId
  // termine) pasan por el chequeo contra el backend.
  const [status, setStatus] = useState<AccountStatus | 'checking'>(() =>
    getClientIdFromSession() ? 'active' : 'checking',
  )

  useEffect(() => {
    if (!user || status !== 'checking') return

    let cancelado = false
    fetchAccountStatus().then((resultado) => {
      if (!cancelado) setStatus(resultado)
    })
    return () => {
      cancelado = true
    }
  }, [user, status])

  if (loading) return <Cargando />

  if (!user) return <Login />

  if (status === 'checking') return <Cargando />

  if (status === 'pending') return <PendingApproval />

  // Admin siempre pasa — verá un banner en el dashboard si el cliente está suspendido
  if (!isAdmin() && !isClientActive()) {
    return <SuspendedAccount expiresAt={getSubscriptionExpiry()} />
  }

  return <>{children}</>
}
