import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/Login'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardLayout } from './DashboardLayout'
import { useAuth } from './context/AuthContext'

export function AppRouter() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" replace /> : <Login />} 
      />
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
} 