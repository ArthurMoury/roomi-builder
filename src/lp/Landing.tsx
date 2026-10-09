import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ITEM_BY_ID } from '../data/catalog'
import { ASSUME } from '../lib/business'
import type { TemplateId } from '../store'
import type { Inset } from '../three/view'
import { Plan, TemplatePlan } from './Plan'
import { BIZ, EV, MODEL, SHOW, STAGE_FACTS } from './example'
import './landing.css'

gsap.registerPlugin(ScrollTrigger)

// LP que antecede o Builder. Segue o cofre (design › Animação de rolagem e bibliotecas › GSAP): a
// rolagem é de quem lê, cada passo muda uma coisa visível, o palco fica preso com position: sticky
// e o ScrollTrigger só mede o progresso. Texto só se move antes de ser lido. O 3D carrega à parte,
// com a planta estática no lugar enquanto isso (ou de vez, sem WebGL). Números, todos do motor.

const Showcase = lazy(() => import('./Showcase'))

const num = (v: number, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const mi = (v: number) => num(v / 1e6, Math.abs(v) >= 1e8 ? 0 : 1)
const pct = (v: number) => `${num(v * 100)}%`
const count = (s: number, test: (id: string) => boolean) => SHOW.filter((p) => p.stage === s && test(p.itemId)).length
const cat = (c: string) => (id: string) => ITEM_BY_ID[id].cat === c

const BEATS = [
  { title: 'Chegada', text: `A via entra pelo sul até a recepção, com portaria e estacionamento. ${STAGE_FACTS[0].added} peças abrem a obra.` },
  { title: 'Hospedagem', text: `${STAGE_FACTS[1].keys} UHs em ${STAGE_FACTS[1].added} prédios de frente para o mar, no mix de quartos que a categoria pede.` },
  { title: 'Lazer', text: `${count(2, cat('aquatico'))} áreas aquáticas, ${count(2, cat('gastronomia'))} restaurantes e bares e mais ${count(2, (id) => !['aquatico', 'gastronomia'].includes(ITEM_BY_ID[id].cat))} equipamentos de esporte, família e bem-estar, cada um onde faz sentido.` },
  { title: 'Paisagismo', text: `${count(3, (id) => id.startsWith('path'))} trechos de caminho ligam os acessos e ${count(3, (id) => id === 'palm')} palmeiras fecham a obra. Um clique na lateral gira o board 90°, como no Builder.` },
]

const STEPS = [
  { title: 'Questionário', text: 'Uma pergunta por vez: nome, destino, categoria, UHs, público, tarifa, ocupação e faixa de orçamento. Cada resposta muda o mapa na hora.' },
  { title: 'Checklist de escopo', text: 'Sim ou Não em dez itens de lazer e serviços constrói ou demole no mapa. FF&E, projetos, pré-operacional e contingência entram quando confirmados.' },
  { title: 'Relatório A4', text: 'Seis folhas para imprimir ou salvar em PDF: investimento, operação, caixa em 10 anos, TIR, VPL, payback e a diária entre as categorias.' },
]

const PLANS: { id: TemplateId; name: string; text: string; refs: string }[] = [
  { id: 'nucleo', name: 'Núcleo central', text: 'Piscina e restaurantes no meio, quartos em ferradura voltados para eles, quadras junto à entrada.', refs: 'Grand Palladium Imbassaí e Club Med Trancoso (BA)' },
  { id: 'praia', name: 'Frente de mar', text: 'Quartos em fileiras de frente para a praia, lazer entre eles e a areia, villas na ponta.', refs: 'Costão do Santinho (Florianópolis, SC)' },
  { id: 'vila', name: 'Vila de bangalôs', text: 'Núcleo compacto na chegada, villas e bangalôs espalhados rumo ao mar por caminhos próprios.', refs: 'Nannai (Muro Alto, PE)' },
]

const KPIS = [
  { label: 'Investimento', value: BIZ.investment / 1e6, d: BIZ.investment >= 1e8 ? 0 : 1, unit: 'R$ mi', text: 'Obra mais FF&E, projetos, pré-operacional e contingência. Sem terreno.' },
  { label: 'TIR real', value: (BIZ.irr ?? 0) * 100, d: 1, unit: '%', text: `Em 10 anos, com a venda do hotel no ano 10 pelo cap rate de ${pct(ASSUME.capRate)}.` },
  { label: 'EBITDA por mês', value: BIZ.ebitdaMonth / 1e6, d: 1, unit: 'R$ mi', text: 'Com a operação estabilizada, a partir do ano 3.' },
  { label: 'Ocupação de equilíbrio', value: (BIZ.breakEven ?? 1) * 100, d: 0, unit: '%', text: `Abaixo dela a operação não cobre os custos. A prevista é ${pct(BIZ.occ)}.` },
]

// onde o board fica na tela: à direita do texto no desktop, em cima no celular
const insetFor = (w: number, h: number): Inset =>
  w >= 960 ? { top: 120, right: 64, bottom: 72, left: Math.round(w * 0.47) } : { top: 80, right: 16, bottom: Math.round(h * 0.52), left: 16 }

const webgl = (() => { try { return !!document.createElement('canvas').getContext('webgl2') } catch { return false } })()

// Número que anda até o valor novo (algarismos tabulares, sem pular de largura)
function Tween({ value, format, still }: { value: number; format: (v: number) => string; still: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const from = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current!
    if (still || from.current == null) { el.textContent = format(value); from.current = value; return }
    const o = { v: from.current }
    from.current = value
    const tw = gsap.to(o, { v: value, duration: 0.42, ease: 'power2.out', onUpdate: () => { el.textContent = format(o.v) } })
    return () => { tw.kill() }
  }, [value, format, still])
  return <b ref={ref} />
}
const fmtInt = (v: number) => num(Math.round(v))
const fmtMi = (v: number) => num(v, 1)

// Caixa acumulado do exemplo: a obra afunda no ano 0 e o EBITDA traz de volta
function Cash() {
  const pts = [{ t: 0, cum: -BIZ.investment }, ...BIZ.years.map((y) => ({ t: y.t, cum: y.cum }))]
  const W = 1000, H = 250, top = 16, bottom = 26
  const lo = Math.min(0, ...pts.map((p) => p.cum)), hi = Math.max(0, ...pts.map((p) => p.cum))
  const y = (v: number) => top + ((hi - v) / (hi - lo || 1)) * (H - top - bottom)
  const band = W / pts.length, bw = 26
  return (
    <svg className="lp-cash-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Caixa acumulado do exemplo, da obra ao ano 10">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="zero" />
      {pts.map((p) => {
        const cx = band * p.t + band / 2, y0 = y(0), y1 = y(p.cum)
        return (
          <g key={p.t}>
            <rect className={`bar ${p.cum >= 0 ? 'pos' : 'neg'}`} x={cx - bw / 2} y={Math.min(y0, y1)} width={bw} height={Math.max(1, Math.abs(y1 - y0))} />
            <text x={cx} y={H - 6} textAnchor="middle" className={p.t % 5 ? 'minor' : ''}>{p.t === 0 ? 'obra' : `ano ${p.t}`}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function Landing({ onStart }: { onStart: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const cap = useRef<HTMLDivElement>(null)
  const [beat, setBeat] = useState(-1)
  const [paused, setPaused] = useState(false)
  const [still] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [inset, setInset] = useState(() => insetFor(innerWidth, innerHeight))
  const facts = STAGE_FACTS[Math.max(0, beat)]
  const shown = Math.max(0, beat)

  useEffect(() => {
    let raf = 0
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setInset(insetFor(innerWidth, innerHeight))) }
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('resize', on); cancelAnimationFrame(raf) }
  }, [])

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // a obra: quatro etapas ao longo do palco preso; antes dele, só o terreno
      ScrollTrigger.create({
        trigger: '.lp-build', start: 'top 65%', end: 'bottom bottom',
        onUpdate: (st) => setBeat(Math.min(BEATS.length - 1, Math.floor(st.progress * BEATS.length))),
        onLeaveBack: () => setBeat(-1),
      })
      // com a página clara por cima, o 3D para de desenhar
      ScrollTrigger.create({ trigger: '.lp-steps', start: 'top top', onEnter: () => setPaused(true), onLeaveBack: () => setPaused(false) })

      const bars = gsap.utils.toArray<SVGRectElement>('.lp-cash-svg .bar')
      const draw = (p: number) => bars.forEach((b, i) => { b.style.transform = `scaleY(${gsap.utils.clamp(0, 1, p * (bars.length + 2) - i)})` })
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.lp-hero .rise', { y: 12, opacity: 0, duration: 0.42, stagger: 0.07, ease: 'power2.out', delay: 0.1 })
        // cartões entram 12 px em 260 ms e o plano de meio-tom vem 80 ms depois
        gsap.set('.lp-card', { opacity: 0, y: 12 })
        gsap.set('.lp-card .plane', { x: -10, y: -10, opacity: 0 })
        ScrollTrigger.batch('.lp-card', {
          start: 'top 86%', once: true,
          onEnter: (els) => {
            gsap.to(els, { opacity: 1, y: 0, duration: 0.26, stagger: 0.08, ease: 'power2.out' })
            gsap.to(els.map((e) => (e as Element).querySelector('.plane')), { x: 0, y: 0, opacity: 1, duration: 0.26, delay: 0.08, stagger: 0.08, ease: 'power2.out' })
          },
        })
        // números do exemplo correm uma vez, ao entrar
        const figs = gsap.utils.toArray<HTMLElement>('.lp-kpis b[data-v]')
        figs.forEach((el) => { el.textContent = num(0, Number(el.dataset.d)) })
        ScrollTrigger.create({
          trigger: '.lp-kpis', start: 'top 80%', once: true,
          onEnter: () => figs.forEach((el, i) => {
            const o = { v: 0 }, d = Number(el.dataset.d)
            gsap.to(o, { v: Number(el.dataset.v), duration: 0.9, delay: i * 0.08, ease: 'power2.out', onUpdate: () => { el.textContent = num(o.v, d) } })
          }),
        })
        // o caixa se desenha com a rolagem e se desfaz ao voltar
        draw(0)
        ScrollTrigger.create({ trigger: '.lp-cash', start: 'top 85%', end: 'bottom 60%', scrub: 0.4, onUpdate: (st) => draw(st.progress) })
      })
      mm.add('(prefers-reduced-motion: reduce)', () => draw(1))
    }, root)
    document.fonts.ready.then(() => ScrollTrigger.refresh())
    return () => ctx.revert()
  }, [])

  // a legenda nova entra antes de ser lida
  useLayoutEffect(() => {
    if (still || !cap.current) return
    const tw = gsap.fromTo(cap.current.children, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.26, stagger: 0.05, ease: 'power2.out' })
    return () => { tw.kill() }
  }, [shown, still])

  const start = (e?: MouseEvent) => {
    e?.preventDefault()
    if (still) return onStart()
    gsap.to(root.current, { opacity: 0, duration: 0.22, ease: 'power1.in', onComplete: onStart })
  }
  const skip = () => document.querySelector('.lp-steps')?.scrollIntoView({ behavior: still ? 'auto' : 'smooth' })
  const box = { top: inset.top, right: inset.right, bottom: inset.bottom, left: inset.left }
  const plan = <div className="lp-fallback" style={box}><Plan items={SHOW} sea /></div>

  return (
    <div className="lp" ref={root}>
      <div className="lp-canvas" aria-hidden="true">
        {webgl ? (
          <Suspense fallback={plan}>
            <Showcase stage={beat} turn={beat >= 3 && !still ? 1 : 0} inset={inset} paused={paused} still={still} />
          </Suspense>
        ) : plan}
      </div>

      <header className="lp-nav">
        <a className="lockup" href="#" aria-label="Roomi Builder"><span className="wm" /><i /><span>Builder</span></a>
        <a className="lp-btn" href="#builder" onClick={start}>Começar meu projeto</a>
      </header>

      <section className="lp-hero">
        <div className="col">
          <h1 className="lp-title">
            <span className="t1 rise">Simulador de resorts</span>
            <span className="t2 rise">Do terreno ao retorno</span>
            <span className="t3 rise">em 8 respostas</span>
          </h1>
          <p className="lp-desc rise">Responda oito perguntas e veja o resort se montar em 3D, num terreno de 4 hectares. O relatório sai em folhas A4, com investimento, operação e retorno em 10 anos.</p>
          <div className="lp-ctas rise">
            <a className="lp-btn" href="#builder" onClick={start}>Começar meu projeto</a>
            <button className="lp-btn ghost" onClick={() => document.querySelector('.lp-build')?.scrollIntoView({ behavior: still ? 'auto' : 'smooth' })}>Ver a obra</button>
          </div>
          <div className="lp-hero-nums rise">
            <div><b>{EV.keys}</b><span>UHs</span></div>
            <div><b>{mi(BIZ.investment)}</b><span>R$ mi de investimento</span></div>
            <div><b>{num((BIZ.irr ?? 0) * 100, 1)}</b><span>% de TIR real</span></div>
          </div>
          <p className="lp-note rise">Exemplo: {MODEL.name.toLowerCase()}, montado pelo Builder.</p>
        </div>
      </section>

      <section className="lp-build" aria-label="A obra, etapa por etapa">
        <div className="lp-stick">
          <div className="lp-beat">
            <div className="lp-count">
              <div className="nm"><b>{String(shown + 1).padStart(2, '0')}</b><i>/{String(BEATS.length).padStart(2, '0')}</i></div>
              <div className="lp-prog">{BEATS.map((b, i) => <span key={b.title} className={i === shown ? 'cur' : i < shown ? 'done' : ''} />)}</div>
            </div>
            <div className="cap" ref={cap} key={shown}>
              <h2>{BEATS[shown].title}</h2>
              <p>{BEATS[shown].text}</p>
            </div>
            <div className="lp-live">
              <div><Tween value={facts.keys} format={fmtInt} still={still} /><span>UHs</span></div>
              <div><Tween value={facts.cost / 1e6} format={fmtMi} still={still} /><span>R$ mi de obra</span></div>
              <div><b>{facts.tier ?? 'Sem categoria'}</b><span>Categoria</span></div>
            </div>
            <button className="lp-skip" onClick={skip}>Pular a obra</button>
          </div>
        </div>
      </section>

      <section className="lp-steps">
        <h2 className="lp-h2">Oito perguntas, um checklist e <span className="hl">seis folhas A4</span>.</h2>
        <p className="lp-lede">O Builder monta o programa de necessidades a cada resposta e implanta tudo no terreno com o motor de posicionamento. Você revisa o escopo e leva o estudo pronto.</p>
        <div className="lp-cards">
          {STEPS.map((s, i) => (
            <article key={s.title} className="lp-card">
              <span className="plane" aria-hidden="true" />
              <div className="face">
                <span className="quad">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-numbers">
        <h2 className="lp-h2">{BIZ.payback != null ? <>O exemplo paga a obra em <em>{num(BIZ.payback, 1)} anos</em>.</> : 'O exemplo, em números.'}</h2>
        <p className="lp-lede">{MODEL.name}, com {EV.keys} UHs para famílias. Investimento completo, sem terreno. Valores reais, sem inflação e sem financiamento.</p>
        <div className="lp-kpis">
          {KPIS.map((k) => (
            <div key={k.label}>
              <span className="lp-lb">{k.label}</span>
              <div className="fig"><b data-v={k.value} data-d={k.d}>{num(k.value, k.d)}</b><i>{k.unit}</i></div>
              <p>{k.text}</p>
            </div>
          ))}
        </div>
        <div className="lp-cash">
          <span className="lp-lb">Caixa acumulado, da obra ao ano 10</span>
          <Cash />
        </div>
      </section>

      <section className="lp-plans">
        <h2 className="lp-h2">Três desenhos de implantação, <span className="hl">vistos em resorts reais</span>.</h2>
        <p className="lp-lede">O motor posiciona cada peça por zona, vizinhança e ruído, vira a fachada para onde faz sentido e liga os acessos por caminhos de 3 a 7 blocos.</p>
        <div className="lp-cards lp-plan-grid">
          {PLANS.map((p) => (
            <article key={p.id} className="lp-card">
              <span className="plane" aria-hidden="true" />
              <div className="face">
                <TemplatePlan t={p.id} className="lp-plan" />
                <h3>{p.name}</h3>
                <p>{p.text}</p>
                <p className="refs">{p.refs}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-cta">
        <h2 className="lp-h2">Seu estudo fica pronto em 8 respostas.</h2>
        <p className="lp-lede">Sem cadastro. O esboço fica salvo no seu computador e o relatório sai em PDF.</p>
        <a className="lp-btn ink" href="#builder" onClick={start}>Começar meu projeto</a>
        <img className="lp-chapeu" src="/roomi-chapeu.svg" alt="" />
        <div className="lockup ink"><span className="wm" /><i /><span>Builder</span></div>
      </section>

      <footer className="lp-foot">
        <p>Simulação para comparar cenários, não um estudo de viabilidade. Fontes: Panorama da Hotelaria Brasileira 2026 (HotelInvest e FOHB), JLL, HVS, ABIH-SP, Resorts Brasil, CUB Sinduscon-SP e SINAPI.</p>
      </footer>
    </div>
  )
}
