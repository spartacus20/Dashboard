import React from 'react'
import { LockKeyhole } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface SuspendedAccountProps {
  expiresAt: string | null
}

export const SuspendedAccount: React.FC<SuspendedAccountProps> = ({ expiresAt }) => {
  const { signOut } = useAuth()

  const formattedDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-500/10 p-5">
            <LockKeyhole className="h-10 w-10 text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Acceso suspendido</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            {formattedDate
              ? `Tu suscripción venció el ${formattedDate}. Para reactivar el acceso, contacta con soporte.`
              : 'Tu cuenta ha sido suspendida. Contacta con soporte para reactivar el acceso.'}
          </p>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900 px-6 py-4 text-sm text-gray-400">
          <p>
            <span className="font-medium text-gray-300">Soporte:</span>{' '}
            <a
              href="mailto:jorge@umindsai.com"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              jorge@umindsai.com
            </a>
          </p>
        </div>

        <button
          onClick={() => signOut()}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
