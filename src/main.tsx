import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useStore } from './store'

// aplica o tema antes do primeiro quadro, sem piscar o escuro padrão do CSS
document.documentElement.dataset.theme = useStore.getState().theme

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
