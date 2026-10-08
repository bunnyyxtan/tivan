import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { TxProvider } from './tx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TxProvider>
      <App />
    </TxProvider>
  </StrictMode>,
)
