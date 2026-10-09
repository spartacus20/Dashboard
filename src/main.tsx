import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { Toaster } from 'sonner'
import './index.css'
import { CallsProvider } from './context/CallsContext'
import { AuthProvider } from './context/AuthContext'
import { BASE_URL } from './lib/supabase'

// Mostrar la URL base en la consola al cargar
// console.log('🌐 BASE_URL:', BASE_URL)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CallsProvider>
          <App />
          <Toaster richColors position="top-right" />
        </CallsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
