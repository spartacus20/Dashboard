import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { CallsProvider } from './context/CallsContext'
import { AuthProvider } from './context/AuthContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CallsProvider>
          <App />
        </CallsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
