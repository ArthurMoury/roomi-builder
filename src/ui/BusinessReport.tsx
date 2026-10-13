import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { motion } from 'motion/react'
import { useStore } from '../store'
import type { Evaluation } from '../lib/valuation'
import type { Business } from '../lib/business'
import { PAGE_W, ReportSheets } from './ReportSheets'

// O relatório A4 aberto no Maker: as folhas (ReportSheets) numa coluna que encolhe para caber,
// com as ferramentas no canto (voltar ao checklist, como calculamos, imprimir, baixar em HTML e fechar)

export function BusinessReport({ ev, biz, onClose }: { ev: Evaluation; biz: Business; onClose: () => void }) {
  const name = useStore((s) => s.hotelName)
  const spec = useStore((s) => s.spec)
  const photo = useStore((s) => s.photo)
  const checks = useStore((s) => s.checks)
  const scroller = useRef<HTMLDivElement>(null)
  const sheets = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  // HTML único: as folhas com o CSS, as fontes e as imagens dentro do arquivo (o gerador carrega à parte)
  const saveHtml = async () => {
    setSaving(true)
    try {
      const { exportReportHtml } = await import('./exportHtml')
      await exportReportHtml(sheets.current!, { name, spec, checks })
    } finally {
      setSaving(false)
    }
  }
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = scroller.current!
    const fit = () => setScale(Math.min(1, (el.clientWidth - 48) / PAGE_W))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <motion.div className="overlay deck-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="deck-tools" onClick={(e) => e.stopPropagation()}>
        <button className="btn" onClick={() => useStore.getState().openModal('checklist')}>Voltar ao checklist</button>
        <button className="btn" onClick={() => useStore.getState().openModal('explain')}>Como calculamos</button>
        <button className="btn" onClick={() => window.print()}>Imprimir / PDF</button>
        <button className="btn" onClick={saveHtml} disabled={!photo || saving} title={photo ? 'Um arquivo .html que abre sozinho, sem internet' : 'Esperando a foto da fachada'}>{saving ? 'Gerando HTML…' : 'Baixar HTML'}</button>
        <button className="btn primary" onClick={onClose}>Fechar</button>
      </div>
      <div className="deck-scroll" ref={scroller} onClick={(e) => e.stopPropagation()}>
        <motion.div className="sheets" ref={sheets} style={{ '--s': scale } as CSSProperties}
          initial={{ y: 40 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 26 }}>
          <ReportSheets name={name} spec={spec} photo={photo} ev={ev} biz={biz} />
        </motion.div>
      </div>
    </motion.div>
  )
}
