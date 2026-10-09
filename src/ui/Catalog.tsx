import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CATS, CELL_METERS, ITEMS, type Cat } from '../data/catalog'
import { money } from '../lib/valuation'
import { useStore, type TemplateId } from '../store'
import { autoPlace, TEMPLATES } from '../lib/autoplace'
import { Chevron } from './icons'

// Miniatura fotografada do próprio modelo 3D (ver three/Thumbs.tsx); entra com fade quando fica pronta
function Thumb({ id }: { id: string }) {
  const src = useStore((s) => s.thumbs[id])
  return (
    <div className="thumb">
      {src && <motion.img src={src} alt="" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} />}
    </div>
  )
}

const slide = { type: 'spring', stiffness: 220, damping: 28 } as const

export function Catalog() {
  const [cat, setCat] = useState<Cat>('hospedagem')
  const open = useStore((s) => s.panels.left)
  const tool = useStore((s) => s.tool)
  const setTool = useStore((s) => s.setTool)
  const auto = useStore((s) => s.placeMode === 'auto')
  const analyst = useStore((s) => s.appMode === 'analyst')
  const tpl = useStore((s) => s.autoTemplate)
  const toggle = () => useStore.getState().togglePanel('left')
  const items = ITEMS.filter((i) => i.cat === cat)

  return (
    <AnimatePresence>
      {analyst ? null : open ? (
        <motion.aside key="catalog" className="panel catalog" initial={{ x: -340, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          exit={{ x: -340, opacity: 0 }} transition={slide}>
          <div className="panel-head">
            <span className="eyebrow">{auto ? 'Catálogo · clique para posicionar' : 'Catálogo'}</span>
            <button className="icon-btn" onClick={toggle} aria-label="Fechar catálogo" title="Fechar"><Chevron dir="left" /></button>
          </div>
          {/* no automático, o modelo de implantação decide onde cada item vai */}
          <AnimatePresence initial={false}>
            {auto && (
              <motion.div key="tpl" className="template" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
                <div className="segmented wide" role="radiogroup" aria-label="Modelo de implantação">
                  {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => (
                    <button key={id} role="radio" aria-checked={tpl === id} className={`seg ${tpl === id ? 'on' : ''}`}
                      onClick={() => useStore.getState().setAutoTemplate(id)}>
                      {tpl === id && <motion.span layoutId="tpl-pill" className="seg-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                      <span>{TEMPLATES[id].short}</span>
                    </button>
                  ))}
                </div>
                <p className="template-note">{TEMPLATES[tpl].note}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="tabs">
            {CATS.map((c) => (
              <button key={c.id} className={`tab ${c.id === cat ? 'on' : ''}`} onClick={() => setCat(c.id)}>
                {c.id === cat && <motion.div layoutId="pill" className="pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span>{c.label}</span>
              </button>
            ))}
          </div>
          <div className="items">
            <AnimatePresence mode="popLayout">
              {items.map((it, i) => {
                const on = tool.type === 'place' && tool.itemId === it.id
                return (
                  <motion.button
                    key={it.id}
                    className={`card ${on ? 'on' : ''}`}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.035, type: 'spring', stiffness: 300, damping: 26 } }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => (auto ? autoPlace(it.id) : setTool(on ? { type: 'build' } : { type: 'place', itemId: it.id, rot: 0 }))}
                  >
                    <Thumb id={it.id} />
                    <div>
                      <div className="t">{it.name}</div>
                      <div className="m">
                        <b>{money(it.cost)}</b>
                        <span>{it.link ? 'trecho de 5 m' : `${it.w * CELL_METERS}×${it.d * CELL_METERS} m`}</span>
                        {it.keys ? <span>{it.keys} UH</span> : null}
                        {it.paint && !auto ? <span>arraste para desenhar</span> : null}
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </div>
        </motion.aside>
      ) : (
        <motion.button key="catalog-tab" className="panel edge-tab left" onClick={toggle} aria-label="Abrir catálogo"
          initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }} transition={slide}>
          <span>Catálogo</span><Chevron dir="right" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
