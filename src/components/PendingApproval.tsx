import React, { useState } from 'react'
import { Hourglass, Loader2, AlertCircle, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchAccountStatus } from '../services/api/accountStatus'

// Pantalla para una cuenta autenticada que todavía no tiene cliente asignado.
//
// Reemplaza al cartel "No se encontró client_id. Por favor, inicia sesión nuevamente" que
// mostraba el dashboard vacío: ese mensaje mandaba al usuario a reintentar el login en
// loop, cuando lo que falta es que un admin lo habilite.
//
// Usa la misma paleta que Login (fondo gris claro, tarjeta blanca, azul #05163b) porque
// es la pantalla inmediatamente anterior en el flujo: el usuario acaba de venir de ahí.
export const PendingApproval: React.FC = () => {
  const { user, signOut } = useAuth()
  const [verificando, setVerificando] = useState(false)
  const [siguePendiente, setSiguePendiente] = useState(false)

  // El admin habilita la cuenta del otro lado, sin avisarle al navegador. En vez de
  // obligar a cerrar sesión, se revalida contra el backend: si ya está habilitada,
  // recargamos para que AuthContext vuelva a pedir client_id y permissions desde cero.
  const reintentar = async () => {
    setVerificando(true)
    setSiguePendiente(false)
    const status = await fetchAccountStatus()
    if (status === 'active') {
      window.location.reload()
      return
    }
    setVerificando(false)
    setSiguePendiente(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900">uMindsAI Dashboard</h2>
          <p className="mt-2 text-gray-600">Tu cuenta está casi lista</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8 border border-gray-200">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-amber-50 border border-amber-100 p-4">
              <Hourglass className="w-8 h-8 text-amber-500" />
            </div>
          </div>

          <div className="text-center space-y-2 mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              Pendiente de aprobación
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Tu cuenta se creó correctamente, pero todavía no tiene acceso asignado. Un
              administrador debe habilitarla antes de que puedas usar el dashboard.
            </p>
          </div>

          {user?.email && (
            <div className="mb-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center">
              <span className="text-gray-500">Cuenta:</span>{' '}
              <span className="text-gray-900 font-medium break-all">{user.email}</span>
            </div>
          )}

          {siguePendiente && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">
                La cuenta sigue sin acceso asignado. Probá de nuevo más tarde.
              </span>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={reintentar}
              disabled={verificando}
              className="w-full py-3 px-4 bg-[#05163b] hover:bg-[#0a2a5a] text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verificando ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Ya me habilitaron — reintentar'
              )}
            </button>

            <button
              onClick={() => signOut()}
              className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 border border-gray-300"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">
              ¿Necesitás ayuda?{' '}
              <a
                href="mailto:jorge@umindsai.com"
                className="text-[#05163b] hover:text-[#0a2a5a] font-medium"
              >
                jorge@umindsai.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
