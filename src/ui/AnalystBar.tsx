import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useStore } from '../store'
import { TIERS, type Evaluation } from '../lib/valuation'
import { BUDGETS, LAYOUT_FIELDS, MAX_UHS, type Spec } from '../lib/spec'
import { rebuild } from '../lib/program'
import { adrRange, type Business } from '../lib/business'
import { brl } from '../lib/range'
import { view } from '../three/view'
import { InvestRange, RangeText } from './Counter'
import { InfoIcon } from './icons'

// Questionário que monta o hotel no mapa enquanto é respondido. Uma pergunta por vez; cada
// resposta vira uma etiqueta acima da barra, que leva de volta à pergunta. Destino, categoria,
// UHs e público mudam o que é construído; nome, tarifa, ocupação e orçamento só mudam o relatório.

let timer = 0
function update(patch: Partial<Spec>, wait: number) {
  useStore.getState().setSpec(patch)
  if (!LAYOUT_FIELDS.some((f) => f in patch)) return
  clearTimeout(timer)
  timer = window.setTimeout(rebuild, wait)
}

// ── desenhos das opções (traço fino, cor do texto) ─────────────────────────
const G = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const GLYPHS: Record<string, ReactNode> = {
  praia: <G><path d="M9.5 14a6.5 6.5 0 0 1 13 0" /><path d="M16 3.5v3M7 7.5l2 2M25 7.5l-2 2" /><path d="M3 19.5c2.2-1.6 4.3-1.6 6.5 0s4.3 1.6 6.5 0 4.3-1.6 6.5 0 4.3 1.6 6.5 0" /><path d="M3 25c2.2-1.6 4.3-1.6 6.5 0s4.3 1.6 6.5 0 4.3-1.6 6.5 0 4.3 1.6 6.5 0" /></G>,
  campo: <G><path d="M2 25c5-6 10-6 15 0 3-3 8-4 13 0" /><path d="M22 19v-8" /><circle cx="22" cy="8.5" r="4" /><path d="M2 28.5h28" /></G>,
  serra: <G><path d="M2 26.5 11.5 11l5 8 4-6 9.5 13.5Z" /><path d="M9 15l2.5 1.6L14 15" /></G>,
  familias: <G><circle cx="11" cy="9" r="3.5" /><circle cx="22.5" cy="13" r="2.6" /><path d="M4 27c0-5 3-9 7-9s7 4 7 9" /><path d="M17.5 27c0-4 2.2-7 5-7s5 3 5 7" /></G>,
  casais: <G><circle cx="12.5" cy="16" r="7" /><circle cx="19.5" cy="16" r="7" /></G>,
  eventos: <G><rect x="5" y="5" width="22" height="14" /><path d="M16 19v8M10 27h12M9.5 10h13M9.5 14h8" /></G>,
  misto: <G><rect x="5.5" y="5.5" width="8.5" height="8.5" /><rect x="18" y="5.5" width="8.5" height="8.5" /><rect x="5.5" y="18" width="8.5" height="8.5" /><circle cx="22.25" cy="22.25" r="4.25" /></G>,
}
const TIER_RANK: Record<string, number> = { eco: 1, mid: 2, up: 3, resort: 4, ai: 5, lux: 6 }
const Meter = ({ n }: { n: number }) => (
  <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
    {Array.from({ length: 6 }, (_, i) => (
      <rect key={i} x={3 + (i % 3) * 9.5} y={i < 3 ? 17 : 7} width="7" height="7" fill={i < n ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2" />
    ))}
  </svg>
)
// faixa de orçamento: colunas crescentes, preenchidas até a faixa
const Stack = ({ n }: { n: number }) => (
  <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
    {Array.from({ length: 5 }, (_, i) => (
      <rect key={i} x={3.5 + i * 5.3} y={27 - (i + 1) * 4.4} width="3.8" height={(i + 1) * 4.4} fill={i < n ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.1" />
    ))}
  </svg>
)

// ── perguntas ──────────────────────────────────────────────────────────────
type Key = 'nome' | 'destino' | 'categoria' | 'uhs' | 'publico' | 'adr' | 'ocupacao' | 'orcamento'
interface Opt { id: string; label: string; sub?: string; glyph: ReactNode }
type Step = { key: Key; label: string; title: string; hint: string } & (
  | { kind: 'text'; placeholder: string }
  | { kind: 'choice'; options: Opt[]; skip?: string }
  | { kind: 'number'; min: number; max: number; step: number; prefix?: string; suffix?: string; skip?: string }
)

const STEPS: Step[] = [
  { key: 'nome', kind: 'text', label: 'Projeto', title: 'Qual o nome do projeto?', hint: 'Ele vai na capa do relatório e no arquivo salvo.', placeholder: 'Ex.: Resort Praia Dourada' },
  {
    key: 'destino', kind: 'choice', label: 'Destino', title: 'Onde fica o hotel?', hint: 'O destino escolhe o desenho do terreno.',
    options: [
      { id: 'praia', label: 'Praia', sub: 'quartos de frente para o mar', glyph: GLYPHS.praia },
      { id: 'campo', label: 'Campo', sub: 'lazer no meio, lago e horta', glyph: GLYPHS.campo },
      { id: 'serra', label: 'Serra', sub: 'chalés, sauna e fogueira', glyph: GLYPHS.serra },
    ],
  },
  {
    key: 'categoria', kind: 'choice', label: 'Categoria', title: 'Em que categoria ele vai competir?', hint: 'Define o lazer obrigatório e a diária de referência.',
    options: TIERS.map((t) => ({ id: t.id, label: t.id === 'ai' ? 'All Inclusive' : t.name, sub: `diária de ${brl(adrRange(t.adr))}`, glyph: <Meter n={TIER_RANK[t.id]} /> })),
  },
  { key: 'uhs', kind: 'number', label: 'UHs', title: 'Quantas UHs?', hint: 'Prédios, vagas, piscinas e restaurantes crescem junto.', min: 10, max: MAX_UHS, step: 10 },
  {
    key: 'publico', kind: 'choice', label: 'Público', title: 'Para quem é o hotel?', hint: 'Cada público traz o lazer que procura.',
    options: [
      { id: 'familias', label: 'Famílias', sub: 'kids club e piscina infantil', glyph: GLYPHS.familias },
      { id: 'casais', label: 'Casais', sub: 'spa, sauna e redário', glyph: GLYPHS.casais },
      { id: 'eventos', label: 'Eventos', sub: 'centro de convenções', glyph: GLYPHS.eventos },
      { id: 'misto', label: 'Misto', sub: 'um pouco de cada', glyph: GLYPHS.misto },
    ],
  },
  { key: 'adr', kind: 'number', label: 'Tarifa', title: 'Qual a tarifa média esperada?', hint: 'Sem resposta, vale a diária de referência do mercado.', min: 150, max: 6000, step: 10, prefix: 'R$', skip: 'Usar a do mercado' },
  { key: 'ocupacao', kind: 'number', label: 'Ocupação', title: 'E a ocupação média esperada?', hint: 'Sem resposta, vale a ocupação de referência da categoria.', min: 20, max: 100, step: 1, suffix: '%', skip: 'Usar a do mercado' },
  {
    key: 'orcamento', kind: 'choice', label: 'Orçamento', title: 'Quanto há para investir?', hint: 'Basta a faixa. O relatório compara com o investimento.', skip: 'Sem orçamento',
    options: BUDGETS.map((b, i) => ({ id: b.id, label: b.label.replace('R$ ', ''), glyph: <Stack n={i + 1} /> })), // em milhões de reais
  },
]
const N = STEPS.length

interface Answers { spec: Spec; name: string }
// valor da resposta: o nome fica fora do Spec, no nome do projeto
const valueOf = (k: Key, a: Answers) => (k === 'nome' ? a.name.trim() || null : a.spec[k])
const fmtNum = (s: Step, v: number) => `${s.kind === 'number' && s.prefix ? `${s.prefix} ` : ''}${v.toLocaleString('pt-BR')}${s.kind === 'number' && s.suffix ? (s.suffix === '%' ? '%' : ` ${s.suffix}`) : ''}`

function crumbText(s: Step, v: string | number | null, skipped: boolean) {
  if (v == null) return skipped ? (s.key === 'orcamento' ? 'sem' : 'mercado') : ''
  if (s.kind === 'text') return String(v)
  if (s.kind === 'choice') return s.options.find((o) => o.id === v)?.label ?? ''
  return s.key === 'uhs' ? `${v} UHs` : fmtNum(s, v as number)
}

// ── nome do projeto: campo grande em Editorial ─────────────────────────────
function NameField({ s, value, onNext }: { s: Extract<Step, { kind: 'text' }>; value: string; onNext: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div className="dial">
      <label className="dial-value name-value">
        <input ref={ref} value={value} placeholder={s.placeholder} maxLength={60} aria-label={s.title}
          onChange={(e) => useStore.getState().setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onNext() }} />
      </label>
      <div className="dial-go">
        <button className="btn primary" onClick={onNext} disabled={!value.trim()}>Seguir</button>
      </div>
    </div>
  )
}

// ── controle numérico: número grande, − e +, régua e atalhos ──────────────
function Dial({ s, value, fallback, presets, onChange, onNext, onSkip }: {
  s: Extract<Step, { kind: 'number' }>; value: number | null; fallback: number; presets: number[]
  onChange: (v: number) => void; onNext: (v: number) => void; onSkip?: () => void
}) {
  const [draft, setDraft] = useState(value ?? fallback)
  const [text, setText] = useState<string | null>(null)
  useEffect(() => { if (value != null) setDraft(value) }, [value])
  const set = (v: number) => {
    const c = Math.min(s.max, Math.max(s.min, Math.round(v / s.step) * s.step))
    setDraft(c)
    onChange(c)
  }
  const p = ((draft - s.min) / (s.max - s.min)) * 100
  return (
    <div className="dial">
      <div className="dial-num">
        <button className="round" onClick={() => set(draft - s.step)} aria-label="Menos">−</button>
        <label className="dial-value">
          {s.prefix && <span>{s.prefix}</span>}
          <input inputMode="numeric" aria-label={s.title} style={{ width: `${Math.max(2, (text ?? draft.toLocaleString('pt-BR')).length) + 0.4}ch` }}
            value={text ?? draft.toLocaleString('pt-BR')}
            onFocus={() => setText(String(draft))}
            onBlur={() => { if (text) set(Number(text)); setText(null) }}
            onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 5))}
            onKeyDown={(e) => { if (e.key === 'Enter') { const v = text ? Number(text) : draft; set(v); setText(null); onNext(Math.min(s.max, Math.max(s.min, v))) } }} />
          {s.suffix && <span>{s.suffix}</span>}
        </label>
        <button className="round" onClick={() => set(draft + s.step)} aria-label="Mais">+</button>
      </div>
      <input type="range" className="range" min={s.min} max={s.max} step={s.step} value={draft} aria-label={`${s.title} (régua)`}
        style={{ '--p': `${p}%` } as CSSProperties} onChange={(e) => set(Number(e.target.value))} />
      <div className="presets">
        {presets.map((v) => <button key={v} className={`chip ${v === draft ? 'on' : ''}`} onClick={() => set(v)}>{s.key === 'uhs' ? v : fmtNum(s, v)}</button>)}
      </div>
      <div className="dial-go">
        {onSkip && <button className="btn ghost" onClick={onSkip}>{s.skip}</button>}
        <button className="btn primary" onClick={() => onNext(draft)}>Seguir</button>
      </div>
    </div>
  )
}

export function AnalystBar({ ev, biz }: { ev: Evaluation; biz: Business }) {
  const spec = useStore((s) => s.spec)
  const name = useStore((s) => s.hotelName)
  const answers = { spec, name }
  // as puladas ficam no estado global: fechar o checklist e voltar não as esquece
  const skippedList = useStore((s) => s.skipped)
  const skipped = useMemo(() => new Set(skippedList as Key[]), [skippedList])
  const done = (s: Step, a: Answers, sk: Set<Key>) => valueOf(s.key, a) != null || sk.has(s.key)
  const firstOpen = (from: number, a: Answers, sk: Set<Key>) => {
    for (let k = 1; k <= N; k++) { const i = (from + k) % N; if (!done(STEPS[i], a, sk)) return i }
    return N
  }
  const [step, setStep] = useState(() => firstOpen(N - 1, answers, skipped))

  // respostas trocadas de fora (modelo aberto, esboço, limpar): volta para a primeira pergunta aberta
  const internal = useRef(false)
  const seen = useRef(spec)
  useEffect(() => {
    if (seen.current === spec) return // montagem
    seen.current = spec
    if (internal.current) { internal.current = false; return }
    const st = useStore.getState()
    setStep(firstOpen(N - 1, { spec, name: st.hotelName }, new Set(st.skipped as Key[])))
  }, [spec]) // eslint-disable-line react-hooks/exhaustive-deps

  // o board e os avisos ficam acima da barra (e das etiquetas), seja qual for a altura dela
  const wrap = useRef<HTMLDivElement>(null)
  const crumbs = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const c = crumbs.current!.offsetHeight
      const h = 16 + wrap.current!.offsetHeight + (c ? c + 10 : 0) + 8
      view.inset.bottom = h
      document.documentElement.style.setProperty('--above-quiz', `${h}px`)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(wrap.current!)
    ro.observe(crumbs.current!)
    return () => ro.disconnect()
  }, [])

  const answer = (k: Key, v: string | number | null, wait: number) => {
    internal.current = true
    update({ [k]: v } as Partial<Spec>, wait)
  }
  const advance = (from: number, sk = skipped) => {
    window.setTimeout(() => {
      const st = useStore.getState()
      setStep(firstOpen(from, { spec: st.spec, name: st.hotelName }, sk))
    }, 320)
  }
  const skip = (k: Key) => {
    useStore.getState().skip(k)
    answer(k, null, 0)
    advance(step, new Set(skipped).add(k))
  }
  const s = STEPS[step]
  const open = (t: 'checklist' | 'explain') => useStore.getState().openModal(t)

  const presetsOf = (st: Extract<Step, { kind: 'number' }>): { fallback: number; presets: number[] } => {
    const r = (v: number) => Math.min(st.max, Math.max(st.min, Math.round(v / st.step) * st.step))
    if (st.key === 'adr') { const m = r(ev.adr || 800); return { fallback: m, presets: [0.8, 0.9, 1, 1.15, 1.3].map((f) => r(m * f)) } }
    if (st.key === 'ocupacao') { const m = Math.round((ev.occ || 0.6) * 100); return { fallback: m, presets: [m - 10, m - 5, m, m + 5, m + 10].map(r) } }
    return { fallback: 120, presets: [60, 120, 200, 300, 450] }
  }

  return (
    <motion.div ref={wrap} className="quiz-wrap" initial={{ y: 160, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 160, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 28 }}>
      <div className="crumbs" ref={crumbs}>
        <AnimatePresence initial={false}>
          {STEPS.map((st, i) => done(st, answers, skipped) && (
            <motion.button key={st.key} layout className={`crumb fields ${i === step ? 'on' : ''}`} onClick={() => setStep(i)}
              initial={{ opacity: 0, y: 14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
              <span className="lb">{st.label}</span><b>{crumbText(st, valueOf(st.key, answers), skipped.has(st.key))}</b>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <div className="quiz fields">
        <div className="q-count">
          <div className="nm"><b>{String(Math.min(step + 1, N)).padStart(2, '0')}</b><i>/{String(N).padStart(2, '0')}</i></div>
          <div className="q-progress">{STEPS.map((st, i) => <span key={st.key} className={i === step ? 'cur' : done(st, answers, skipped) ? 'done' : ''} />)}</div>
        </div>

        <div className="q-main">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} className="q" initial={{ opacity: 0, x: 48 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -48 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
              {s ? (
                <>
                  <div className="q-text"><h3>{s.title}</h3><p>{s.hint}</p></div>
                  {s.kind === 'text' ? (
                    <NameField s={s} value={name} onNext={() => { useStore.getState().setName(name.trim()); advance(step) }} />
                  ) : s.kind === 'choice' ? (
                    <div className="opts">
                      {s.options.map((o, i) => {
                        const on = valueOf(s.key, answers) === o.id
                        return (
                          <motion.button key={o.id} className={`opt ${on ? 'on' : ''}`} aria-pressed={on}
                            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.04 + i * 0.05, type: 'spring', stiffness: 420, damping: 30 } }}
                            whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
                            onClick={() => { answer(s.key, o.id, 40); advance(step) }}>
                            {on && <motion.span layoutId={`opt-${s.key}`} className="opt-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                            <span className="glyph">{o.glyph}</span>
                            <span className="txt"><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</span>
                          </motion.button>
                        )
                      })}
                      {s.skip && <button className="btn ghost skip" onClick={() => skip(s.key)}>{s.skip}</button>}
                    </div>
                  ) : (
                    <Dial key={s.key} s={s} value={valueOf(s.key, answers) as number | null} {...presetsOf(s)}
                      onChange={(v) => answer(s.key, v, s.key === 'uhs' ? 450 : 0)}
                      onNext={(v) => {
                        if (valueOf(s.key, { spec: useStore.getState().spec, name }) == null) {
                          // sem mexer no controle, a diária e a ocupação ficam as estimadas, que acompanham a categoria
                          if (s.key === 'adr' || s.key === 'ocupacao') return skip(s.key)
                          answer(s.key, v, 40)
                        }
                        advance(step)
                      }}
                      onSkip={s.skip ? () => skip(s.key) : undefined} />
                  )}
                </>
              ) : (
                <>
                  <div className="q-text"><h3>Programa pronto.</h3><p>O hotel está montado no mapa. Confirme o escopo e gere o relatório.</p></div>
                  <div className="opts">
                    <motion.button className="btn primary cta" onClick={() => open('checklist')} disabled={!biz.ready}
                      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ x: 4 }}>
                      Revisar escopo e gerar relatório
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="q-side">
          <div className="out"><span className="lb">Faixa de investimento</span><b><InvestRange value={biz.investment} /></b></div>
          <div className="out"><span className="lb">EBITDA por mês</span><b><RangeText text={biz.ready ? brl(biz.r.ebitdaMonth) : '—'} /></b></div>
          <div className="q-actions">
            <button className="icon-btn" onClick={() => open('explain')} aria-label="Como calculamos" title="Como calculamos"><InfoIcon /></button>
            <button className="btn primary" onClick={() => open('checklist')} disabled={!biz.ready}>Escopo e relatório</button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
