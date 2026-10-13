import { StrictMode, Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { useStore } from './store'

// aplica o tema antes do primeiro quadro, sem piscar o escuro padrão do CSS
document.documentElement.dataset.theme = useStore.getState().theme

// A LP abre primeiro; o Maker fica em #builder (um link com #builder abre direto nele). Cada um
// carrega à parte. "Começar meu projeto" na LP abre o board sempre vazio.
const Landing = lazy(() => import('./lp/Landing'))
const Builder = lazy(() => import('./App'))
const atBuilder = () => location.hash === '#builder'
document.documentElement.dataset.view = atBuilder() ? 'app' : 'lp'

function Root() {
  const [builder, setBuilder] = useState(atBuilder)
  useEffect(() => {
    const on = () => setBuilder(atBuilder())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.view = builder ? 'app' : 'lp'
    window.scrollTo(0, 0)
  }, [builder])
  return (
    <Suspense fallback={null}>
      {builder
        ? <Builder onHome={() => { location.hash = '' }} />
        : <Landing onStart={() => { useStore.getState().reset(); location.hash = 'builder' }} />}
    </Suspense>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
