import React from 'react'
import { useAuth } from './context/AuthContext'
import { LogOut } from 'lucide-react'
import DashboardApp from './DashboardApp'

export function DashboardLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="relative">
      {/* Header con información del usuario */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-4 bg-gray-800 rounded-lg px-4 py-2">
        <span className="text-gray-300 text-sm">
          {user?.email}
        </span>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Salir</span>
        </button>
      </div>
      
      {/* Contenido del dashboard original */}
      <DashboardApp />
    </div>
  )
} 