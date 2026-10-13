import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useStore } from '../store'
import { MODELS, layoutOf, type ResortModel } from '../data/models'
import { evaluate } from '../lib/valuation'
import { obraRange } from '../lib/business'
import { brl } from '../lib/range'
import { EMPTY_SPEC } from '../lib/spec'

function openModel(m: ResortModel) {
  const st = useStore.getState()
  st.loadItems(m.name, layoutOf(m), m.spec ?? EMPTY_SPEC)
  st.closeModal()
  st.notify(`Modelo aberto: ${m.name}`)
}

// Galeria de modelos: a imagem de cada um é fotografada do próprio layout (three/Thumbs.tsx)
export function Models({ onClose }: { onClose: () => void }) {
  const thumbs = useStore((s) => s.thumbs)
  const facts = useMemo(() => MODELS.map((m) => {
    const ev = evaluate(layoutOf(m).map((i, k) => ({ uid: String(k), itemId: i.id, x: i.x, z: i.z, rot: i.rot })))
    return `${ev.keys} UHs · ${ev.tier?.name ?? '—'} · obra de ${brl(obraRange(ev.cost))}`
  }), [])

  return (
    <motion.div className="overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="models" onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}>
        <div className="explain-head">
          <div>
            <div className="eyebrow">Modelos</div>
            <h2 className="display">Comece de um resort pronto</h2>
          </div>
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
        <div className="model-grid">
          {MODELS.map((m, i) => {
            const src = thumbs[`model:${m.id}`]
            return (
              <motion.button key={m.id} className="model-card" onClick={() => openModel(m)}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.05 * i, type: 'spring', stiffness: 260, damping: 24 } }}
                whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
                <div className="model-img">
                  {src
                    ? <motion.img src={src} alt="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
                    : <span className="eyebrow">Fotografando…</span>}
                </div>
                <div className="model-body">
                  <h3>{m.name}</h3>
                  <p>{m.note}</p>
                  {m.refs && <p className="refs">{m.refs}</p>}
                  <div className="facts">{facts[i]}</div>
                </div>
              </motion.button>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
