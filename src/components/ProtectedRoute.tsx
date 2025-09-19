import React from 'react'
import { useAuth } from '../context/AuthContext'
import { Login } from './Login'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="text-gray-600">Cargando...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return <>{children}</>
}
