import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Scene } from './three/Scene'
import { AnalystBar } from './ui/AnalystBar'
import { BusinessReport } from './ui/BusinessReport'
import { CalcExplainer } from './ui/CalcExplainer'
import { Models } from './ui/Models'
import { Checklist } from './ui/Checklist'
import { useStore } from './store'
import { evaluate } from './lib/valuation'
import { business } from './lib/business'
import { downloadSketch, parseSketch } from './lib/sketch'
import { resetView, view } from './three/view'

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M3 13l1.1-1.1M11.9 4.1 13 3" />
  </svg>
)
const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1Z" />
  </svg>
)

// O app: o board 3D ao fundo, o questionário embaixo e o checklist ao lado do mapa, antes do relatório
export default function App({ onHome }: { onHome: () => void }) {
  const placed = useStore((s) => s.placed)
  const dying = useStore((s) => s.dying)
  const name = useStore((s) => s.hotelName)
  const theme = useStore((s) => s.theme)
  const notice = useStore((s) => s.notice)
  const modal = useStore((s) => s.modal)
  const explain = useStore((s) => s.explain)
  const spec = useStore((s) => s.spec)
  const checks = useStore((s) => s.checks)
  const live = useMemo(() => placed.filter((p) => !dying.has(p.uid)), [placed, dying])
  const ev = useMemo(() => evaluate(live), [live])
  const biz = useMemo(() => business(ev, live, spec, checks), [ev, live, spec, checks])
  const [toast, setToast] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const checklist = modal?.type === 'checklist'
  const notify = (text: string) => useStore.getState().notify(text)
  const closeModal = () => useStore.getState().closeModal()

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  // o board abre reto e de frente; a primeira vez, ensina o giro
  useEffect(() => {
    resetView({ top: 88, right: 16, bottom: 230, left: 16 })
    notify('Clique numa das laterais do board para girá-lo 90°')
  }, [])
  // com o checklist aberto, o board recua para a esquerda e desce até o pé da tela
  useEffect(() => {
    view.inset.right = checklist ? 462 : 16
    if (checklist) view.inset.bottom = 16
  }, [checklist])

  // Comemora quando o hotel sobe de categoria
  const lastTier = useRef(-1)
  useEffect(() => {
    if (ev.tierIdx > lastTier.current && ev.tierIdx > 0) {
      setToast(ev.tier!.name)
      const t = setTimeout(() => setToast(null), 2600)
      lastTier.current = ev.tierIdx
      return () => clearTimeout(t)
    }
    lastTier.current = ev.tierIdx
  }, [ev.tierIdx, ev.tier])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => useStore.setState({ notice: null }), 4200)
    return () => clearTimeout(t)
  }, [notice])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState()
      if (e.key === 'Escape' && (s.modal || s.explain)) s.closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const save = () => {
    const { spec, checks } = useStore.getState()
    notify(`Esboço salvo em ${downloadSketch(name, live, { spec, checks })}`)
  }

  const open = async (file: File | undefined) => {
    if (!file) return
    try {
      const sketch = parseSketch(await file.text())
      const skipped = useStore.getState().loadItems(sketch.hotelName, sketch.items, sketch.spec, sketch.checks) + sketch.invalid
      const loaded = sketch.items.length + sketch.invalid - skipped
      notify(`Esboço aberto: ${loaded} ${loaded === 1 ? 'item' : 'itens'}${skipped ? ` (${skipped} ignorados)` : ''}`)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Não foi possível abrir o arquivo.')
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <>
      <div className="stage"><Scene /></div>

      <motion.header className="panel topbar" initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 22, delay: 0.2 }}>
        <button className="brand" onClick={onHome} aria-label="Roomi Builder, voltar à apresentação">
          <span className="logo" aria-hidden="true" /><span>Builder</span>
        </button>
        <span className={`project ${name ? '' : 'empty'}`}>{name || 'Novo projeto'}</span>
        <button className="btn icon" onClick={() => useStore.getState().setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }} style={{ display: 'grid' }}>
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </motion.span>
          </AnimatePresence>
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>Abrir</button>
        <button className="btn" onClick={save} disabled={!live.length}>Salvar esboço</button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => open(e.target.files?.[0])} />
        <button className="btn" onClick={() => useStore.getState().openModal('models')}>Modelos</button>
        <button className="btn" onClick={() => useStore.getState().clear()}>Limpar</button>
        {/* o relatório começa pelo checklist de escopo */}
        <button className="btn primary" onClick={() => useStore.getState().openModal('checklist')} disabled={!live.length}>Ver relatório</button>
      </motion.header>

      <div className="dock">
        <AnimatePresence mode="popLayout">
          {notice ? (
            <motion.div key={notice.id} className="notice" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }} role="status">
              {notice.text}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {!checklist && <AnalystBar key="analyst" ev={ev} biz={biz} />}
        {checklist && <Checklist key="checklist" biz={biz} onClose={closeModal} />}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" initial={{ opacity: 0, y: -20, x: '-50%', scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }} exit={{ opacity: 0, y: -20, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}>
            <div className="eyebrow" style={{ color: 'inherit' }}>Novo nível</div>
            <div className="display">{toast}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal?.type === 'report' && <BusinessReport key="biz" ev={ev} biz={biz} onClose={closeModal} />}
        {modal?.type === 'models' && <Models key="models" onClose={closeModal} />}
      </AnimatePresence>
      <AnimatePresence>
        {explain && <CalcExplainer key="explain" ev={ev} biz={biz} count={live.length} onClose={closeModal} />}
      </AnimatePresence>
    </>
  )
}
