import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { DashboardLayout } from './DashboardLayout'

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/dashboard/*"
        element={<DashboardLayout />}
      />
      <Route 
        path="/" 
        element={<Navigate to="/dashboard" replace />} 
      />
      <Route 
        path="*" 
        element={<Navigate to="/dashboard" replace />} 
      />
    </Routes>
  )
} 