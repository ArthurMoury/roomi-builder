import { motion } from 'motion/react'
import { useStore } from '../store'
import { money } from '../lib/valuation'
import { answerScope } from '../lib/program'
import type { Business } from '../lib/business'
import { InvestRange } from './Counter'

const pct = (v: number) => `${Math.round(v * 100)}%`
const spring = { type: 'spring', stiffness: 500, damping: 34 } as const

// Interruptor Sim/Não: o botão desliza para o lado da resposta
function Toggle({ label, yes, onChange }: { label: string; yes: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={yes} aria-label={label} className={`toggle ${yes ? 'on' : ''}`} onClick={() => onChange(!yes)}>
      <motion.span layout className="knob" transition={spring} />
      <span className="y">Sim</span><span className="n">Não</span>
    </button>
  )
}

const row = (i: number) => ({
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { delay: 0.12 + i * 0.05, type: 'spring' as const, stiffness: 320, damping: 28 } },
})

// Primeira etapa do relatório, ao lado do mapa: cada resposta de lazer constrói ou demole no mapa
// na hora, e os custos fora da obra entram no investimento quando confirmados
export function Checklist({ biz, onClose }: { biz: Business; onClose: () => void }) {
  const setCheck = useStore((s) => s.setCheck)
  const open = (t: 'report' | 'explain') => useStore.getState().openModal(t)
  const n = biz.scope.length

  return (
    <motion.aside className="panel checklist fields" initial={{ x: 440, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 440, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 28 }}>
      <header className="ck-head">
        <div className="ck-step"><b>01</b><i>/02</i></div>
        <div>
          <h2>Checklist de escopo</h2>
          <p>Confirme o que entra no projeto. Cada resposta muda o mapa ao lado.</p>
        </div>
      </header>

      <div className="ck-body">
        <span className="lb">Lazer e serviços</span>
        <ul>
          {biz.scope.map((c, i) => (
            <motion.li key={c.id} {...row(i)} className={c.yes ? '' : 'off'}>
              <span className="quad">{i + 1}</span>
              <span className="q">{c.ask}<small>{c.onMap ? `no mapa · ${money(c.cost)}` : c.yes ? `sem espaço no mapa · ${money(c.delta)} estimado` : 'fora do mapa'}</small></span>
              <Toggle label={c.ask} yes={c.yes} onChange={(v) => answerScope(c.id, v)} />
            </motion.li>
          ))}
        </ul>
        <span className="lb">Custos fora da obra</span>
        <ul>
          {biz.extras.map((e, i) => (
            <motion.li key={e.id} {...row(n + i)} className={e.yes ? '' : 'off'}>
              <span className="quad">{n + i + 1}</span>
              <span className="q">{e.ask}<small>{pct(e.pct)} da obra · {money(e.value)}</small></span>
              <Toggle label={e.ask} yes={e.yes} onChange={(v) => setCheck(e.id, v)} />
            </motion.li>
          ))}
        </ul>
      </div>

      <footer className="ck-foot">
        <div className="ck-total">
          <span className="lb">Faixa de investimento</span>
          <b><InvestRange value={biz.investment} /></b>
          <small>{biz.pending ? `${money(biz.pending)} ainda a confirmar` : 'tudo confirmado'}</small>
        </div>
        <div className="ck-actions">
          <button className="btn" onClick={onClose}>Voltar</button>
          <button className="btn" onClick={() => open('explain')}>Como calculamos</button>
          <button className="btn primary" onClick={() => open('report')} disabled={!biz.ready}>Gerar relatório</button>
        </div>
      </footer>
    </motion.aside>
  )
}
