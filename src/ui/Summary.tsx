import { useEffect } from 'react'
import { AnimatePresence, motion, useSpring, useTransform } from 'motion/react'
import { TIERS, money, type Evaluation } from '../lib/valuation'
import type { Business } from '../lib/business'
import { useStore } from '../store'
import { Chevron, InfoIcon } from './icons'

// Número que corre até o valor novo (mola do Motion fora do ciclo de render)
export function Counter({ value, format }: { value: number; format: (v: number) => string }) {
  const mv = useSpring(value, { stiffness: 90, damping: 20 })
  useEffect(() => { mv.set(value) }, [mv, value])
  const text = useTransform(mv, format)
  return <motion.span>{text}</motion.span>
}

const int = (v: number) => Math.round(v).toLocaleString('pt-BR')
const pct = (v: number) => `${Math.round(v * 100)}%`
const years = (v: number) => (v ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} anos` : '—')

export function AdrBars({ ev }: { ev: Evaluation }) {
  const max = Math.max(TIERS[TIERS.length - 1].adr, ev.adr) * 1.05
  return (
    <div className="bars">
      {TIERS.map((t) => (
        <div key={t.id} className="bar">
          <span>{t.name}</span>
          <div className="track"><motion.div className="fill" animate={{ width: `${(t.adr / max) * 100}%` }} /></div>
          <span className="n">{money(t.adr)}</span>
        </div>
      ))}
      <div className="bar me">
        <span>Seu hotel</span>
        <div className="track">
          <motion.div className="fill" initial={{ width: 0 }} animate={{ width: `${(ev.adr / max) * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
        </div>
        <span className="n" style={{ color: 'var(--accent-text)' }}>{ev.adr ? money(ev.adr) : '—'}</span>
      </div>
    </div>
  )
}

const slide = { type: 'spring', stiffness: 220, damping: 28 } as const

export function Summary({ ev, biz, count }: { ev: Evaluation; biz: Business; count: number }) {
  const open = useStore((s) => s.panels.right)
  const analyst = useStore((s) => s.appMode === 'analyst')
  const toggle = () => useStore.getState().togglePanel('right')
  return (
    <AnimatePresence>
      {analyst ? null : open ? (
        <motion.aside key="summary" className="panel summary" initial={{ x: 360, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }} transition={slide}>
          <SummaryBody ev={ev} biz={biz} count={count} onClose={toggle} />
        </motion.aside>
      ) : (
        <motion.button key="summary-tab" className="panel edge-tab right" onClick={toggle} aria-label="Abrir resumo"
          initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={slide}>
          <Chevron dir="left" /><span>Resumo</span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

function SummaryBody({ ev, biz, count, onClose }: { ev: Evaluation; biz: Business; count: number; onClose: () => void }) {
  return (
    <>
      <div className="panel-head flush">
        <span className="eyebrow">Resumo</span>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar resumo" title="Fechar"><Chevron dir="right" /></button>
      </div>
      <section>
        <div className="eyebrow">Valor de construção</div>
        <div className="big display"><Counter value={ev.cost} format={money} /></div>
      </section>

      <div className="row3">
        <div><div className="eyebrow">UHs</div><div className="v"><Counter value={ev.keys} format={int} /></div></div>
        <div><div className="eyebrow">Itens</div><div className="v"><Counter value={count} format={int} /></div></div>
        <div><div className="eyebrow">Custo/UH</div><div className="v"><Counter value={ev.costPerKey} format={(v) => (v ? money(v) : '—')} /></div></div>
      </div>

      <section>
        <div className="eyebrow">Categoria de mercado</div>
        <AnimatePresence mode="wait">
          <motion.div key={ev.tier?.id ?? 'none'} className="tier"
            initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }} transition={{ duration: 0.3 }}>
            {ev.tier?.name ?? 'Sem hospedagem'}
          </motion.div>
        </AnimatePresence>
      </section>

      <section>
        <div className="eyebrow">Precificação estimada</div>
        <div className="kv"><span>Diária média (ADR)</span><b><Counter value={ev.adr} format={(v) => (v ? money(v) : '—')} /></b></div>
        <div className="kv"><span>Ocupação de referência</span><span>{ev.occ ? pct(ev.occ) : '—'}</span></div>
        <div className="kv"><span>RevPAR</span><Counter value={ev.revpar} format={(v) => (v ? money(v) : '—')} /></div>
        <div className="kv"><span>Receita de hospedagem/ano</span><Counter value={ev.revenue} format={(v) => (v ? money(v) : '—')} /></div>
        <div className="kv"><span>Retorno (payback)</span><span>{years(biz.payback ?? 0)}</span></div>
        {ev.tier && <div className="kv"><span>Custo/UH de mercado ({ev.tier.name})</span><span>{money(ev.tier.costPerKey)}</span></div>}
      </section>

      <section>
        <div className="eyebrow">Diária vs. categorias</div>
        <AdrBars ev={ev} />
      </section>

      {ev.next && (
        <section>
          <div className="eyebrow">Para chegar a {ev.next.name}</div>
          <ul className="reqs">
            {ev.nextReqs.map((r) => (
              <motion.li key={r.label} className={r.ok ? 'ok' : ''} layout>
                <span className="dot">{r.ok && <motion.svg width="8" height="8" viewBox="0 0 8 8"><motion.path d="M1 4l2 2 4-4" stroke="#1D1D1B" strokeWidth="1.5" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} /></motion.svg>}</span>
                {r.label}
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      <button className="how" onClick={() => useStore.getState().openModal('explain')}>
        <InfoIcon /><span>Como calculamos</span>
      </button>
    </>
  )
}
