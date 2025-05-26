import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { CallsProvider } from './context/CallsContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CallsProvider>
      <App />
    </CallsProvider>
  </React.StrictMode>,
)
