import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthGate } from './features/auth/AuthGate'
import { Toast } from './components/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate />
    <Toast />
  </StrictMode>,
)
