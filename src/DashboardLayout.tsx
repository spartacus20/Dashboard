import React from 'react'
import { useAuth } from './context/AuthContext'
import { LogOut } from 'lucide-react'
import DashboardApp from './DashboardApp'

export function DashboardLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="relative">
      {/* Header con información del usuario */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-4 bg-white border border-[#05163b] rounded-lg px-4 py-2 shadow-sm">
        <span className="text-[#05163b] text-sm font-medium">
          {user?.email}
        </span>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-[#05163b] hover:text-[#0a2a5a] transition-colors"
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