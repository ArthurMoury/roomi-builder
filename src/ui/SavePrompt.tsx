import { useEffect } from 'react'
import { motion } from 'motion/react'

// Pede para salvar o esboço antes de sair (de volta à apresentação, ou trocando de aba) quando há
// respostas que ainda não estão num arquivo. "Não mostrar novamente" vale para este navegador.
export function SavePrompt({ onSave, onLater, onNever }: { onSave: () => void; onLater: () => void; onNever: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onLater() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onLater])
  return (
    <motion.div className="overlay top" onClick={onLater} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="save-prompt" role="dialog" aria-modal="true" aria-labelledby="save-title" onClick={(e) => e.stopPropagation()}
        initial={{ y: 24, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
        <div className="eyebrow">Esboço</div>
        <h2 id="save-title" className="display">Salve o esboço antes de sair</h2>
        <p>As respostas e o mapa ainda não estão salvos. O esboço vira um arquivo que abre de novo aqui, em Abrir, com o mapa, as respostas e o checklist.</p>
        <div className="save-actions">
          <button className="btn ghost" onClick={onNever}>Não mostrar novamente</button>
          <button className="btn" onClick={onLater}>Agora não</button>
          <button className="btn primary" onClick={onSave} autoFocus>Salvar</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
