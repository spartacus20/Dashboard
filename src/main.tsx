import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { CallsProvider } from './context/CallsContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CallsProvider>
        <App />
      </CallsProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
