import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { Inset } from '../three/view'
import { PAGE_H, PAGE_W, ReportSheets } from '../ui/ReportSheets'
import { Plan } from './Plan'
import { BIZ, EV, MODEL, SHOW } from './example'
import { fall } from './motion'
import './landing.css'

gsap.registerPlugin(ScrollTrigger)

// LP que antecede o Maker. Segue o cofre (design › Animação de rolagem e bibliotecas › GSAP): a
// rolagem é de quem lê, cada passo muda uma coisa visível, o palco fica preso com position: sticky
// e o ScrollTrigger só mede o progresso. Texto só se move antes de ser lido. Na abertura, o livro da
// Roomi gira e folheia no 3D; nos passos, os elementos do resort caem do céu. O 3D carrega à parte, com
// a planta estática nos passos enquanto isso (ou de vez, sem WebGL). Todos os números saem do motor,
// para o resort de exemplo.

const Showcase = lazy(() => import('./Showcase'))

const num = (v: number, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const mi = (v: number) => num(v / 1e6, Math.abs(v) >= 1e8 ? 0 : 1)
const pct = (v: number, d = 0) => `${num(v * 100, d)}%`
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
// barras do caixa no passo dos cálculos, crescendo uma depois da outra até k = 1
const drawCash = (k: number) => document.querySelectorAll<SVGRectElement>('.lp-mini .bar').forEach((el, i, all) => {
  el.style.transform = `scaleY(${clamp01(k * (all.length + 2) - i)})`
})

// O fluxo em quatro passos, antes das perguntas; cada passo traz o seu grupo de elementos caindo do céu
const BEATS: { title: string; lead: string; note: string; chart?: boolean }[] = [
  {
    title: 'Defina seus critérios',
    lead: 'Destino, categoria, tamanho e público. Você diz o que o resort precisa ser e o programa sobe no terreno.',
    note: `No exemplo: praia, all inclusive e ${EV.keys} UHs para famílias.`,
  },
  {
    title: 'Confira as restrições',
    lead: 'A faixa de orçamento e o checklist de escopo dizem o que cabe. Cada Sim ou Não constrói ou tira do mapa.',
    note: 'Custos fora da obra só entram quando você confirma.',
  },
  {
    title: 'Entenda os cálculos',
    lead: 'Obra, receita, GOP, EBITDA e retorno em 10 anos, com a fonte de cada número.',
    note: `No exemplo: TIR real de ${pct(BIZ.irr ?? 0, 1)} e a obra paga em ${num(BIZ.payback ?? 0, 1)} anos.`,
    chart: true,
  },
  {
    title: 'Organize seu relatório',
    lead: 'Seis folhas A4 no molde dos PDFs da Roomi, prontas para imprimir e levar à mesa de decisão.',
    note: 'Capa, números, operação, caixa, risco e premissas.',
  },
]
const P_MAX = 4.6 // a rolagem dos passos vai de 0 (abertura) a 4,6; o passo k pousa em p = k + 1

const QUESTIONS = [
  { q: 'Onde fica o hotel?', why: 'Praia, campo ou serra mudam o desenho do terreno e o lazer que vende.' },
  { q: 'Em que categoria ele vai competir?', why: 'A categoria fixa a diária de referência e o lazer obrigatório.' },
  { q: 'Quantas UHs?', why: 'A escala dita a obra, as vagas, as piscinas e a receita.' },
  { q: 'Para quem é o hotel?', why: 'Famílias, casais e eventos pedem lazer e receitas diferentes.' },
  { q: 'Qual a tarifa média esperada?', why: 'A diária que você pretende praticar move toda a receita.' },
  { q: 'E a ocupação média esperada?', why: 'Com a diária, ela forma o RevPAR, o motor da operação.' },
  { q: 'Quanto há para investir?', why: 'Uma faixa basta. O estudo diz se o projeto cabe nela.' },
]

// onde os elementos ficam na tela: à direita do texto no desktop, em cima no celular
const insetFor = (w: number, h: number): Inset =>
  w >= 960 ? { top: 120, right: 64, bottom: 72, left: Math.round(w * 0.47) } : { top: 80, right: 16, bottom: Math.round(h * 0.52), left: 16 }

const webgl = (() => { try { return !!document.createElement('canvas').getContext('webgl2') } catch { return false } })()

// Caixa acumulado do exemplo, compacto: a obra afunda no ano 0 e o EBITDA traz de volta
function MiniCash() {
  const pts = [{ t: 0, cum: -BIZ.investment }, ...BIZ.years.map((y) => ({ t: y.t, cum: y.cum }))]
  const W = 480, H = 132, top = 6, bottom = 22
  const lo = Math.min(0, ...pts.map((p) => p.cum)), hi = Math.max(0, ...pts.map((p) => p.cum))
  const y = (v: number) => top + ((hi - v) / (hi - lo || 1)) * (H - top - bottom)
  const band = W / pts.length, bw = 16
  return (
    <svg className="lp-mini" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Caixa acumulado do exemplo, da obra ao ano 10">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="zero" />
      {pts.map((p) => {
        const cx = band * p.t + band / 2, y0 = y(0), y1 = y(p.cum)
        return (
          <g key={p.t}>
            <rect className={`bar ${p.cum >= 0 ? 'pos' : 'neg'}`} x={cx - bw / 2} y={Math.min(y0, y1)} width={bw} height={Math.max(1, Math.abs(y1 - y0))} />
            {p.t % 5 === 0 && <text x={cx} y={H - 5} textAnchor="middle">{p.t === 0 ? 'obra' : `ano ${p.t}`}</text>}
          </g>
        )
      })}
    </svg>
  )
}

const STEP_GAP = 22   // espaço entre as folhas no leitor (o mesmo de .sheets)
const READER_PAD = 64 // respiro acima da primeira folha no leitor (o mesmo de .lp-viewer-scroll)

export default function Landing({ onStart }: { onStart: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const cap = useRef<HTMLDivElement>(null)
  const reader = useRef<HTMLDivElement>(null)
  const [beat, setBeat] = useState(-1)
  const [paused, setPaused] = useState(false)
  const [still] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [inset, setInset] = useState(() => insetFor(innerWidth, innerHeight))
  const [photo, setPhoto] = useState<string | null>(null)
  const [wantPhoto, setWantPhoto] = useState(false)
  const [reading, setReading] = useState<number | null>(null)
  const shown = Math.max(0, beat)
  // a etapa na tela troca depois que a anterior sai (o texto some e o novo entra)
  const [current, setCurrent] = useState(0)
  const target = useRef(0)
  const cashK = useRef(0)
  const b = BEATS[current]

  useEffect(() => {
    let raf = 0
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setInset(insetFor(innerWidth, innerHeight))) }
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('resize', on); cancelAnimationFrame(raf) }
  }, [])

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // os passos ocupam a seção menos a última tela, em que as perguntas sobem por cima de tudo parado
      const build = root.current!.querySelector<HTMLElement>('.lp-build')!
      const span = () => `+=${build.offsetHeight - innerHeight}`
      // o passo do texto muda em degraus nítidos; o caixa dos cálculos se desenha com a rolagem
      ScrollTrigger.create({
        trigger: build, start: 'top bottom', end: span, invalidateOnRefresh: true,
        onUpdate: (st) => {
          const p = st.progress * P_MAX
          setBeat(p < 0.5 ? -1 : Math.min(BEATS.length - 1, Math.floor(p - 0.5)))
          cashK.current = still ? 1 : clamp01((p - 2.6) / 0.7)
          drawCash(cashK.current)
        },
      })
      // com a página clara por cima, o 3D para de desenhar; a foto da capa do relatório sai antes
      ScrollTrigger.create({ trigger: '.lp-questions', start: 'top top', onEnter: () => setPaused(true), onLeaveBack: () => setPaused(false) })
      ScrollTrigger.create({ trigger: '.lp-questions', start: 'top bottom', once: true, onEnter: () => setWantPhoto(true) })

      const mm = gsap.matchMedia()
      mm.add({ motion: '(prefers-reduced-motion: no-preference)', desk: '(min-width: 960px)' }, (c) => {
        const { motion, desk } = c.conditions as { motion: boolean; desk: boolean }
        if (!motion) return
        // o livro sai e os elementos caem do céu com a rolagem, num scrub com inércia: um leve atraso, sem tranco
        gsap.fromTo(fall, { p: 0 }, { p: P_MAX, ease: 'none', scrollTrigger: { trigger: build, start: 'top bottom', end: span, scrub: 1.2, invalidateOnRefresh: true } })
        gsap.from('.lp-hero .rise', { y: 12, opacity: 0, duration: 0.42, stagger: 0.07, ease: 'power2.out', delay: 0.1 })
        // perguntas entram 12 px em 260 ms, uma depois da outra
        gsap.set('.lp-q', { opacity: 0, y: 12 })
        ScrollTrigger.batch('.lp-q', {
          start: 'top 88%', once: true,
          onEnter: (els) => { gsap.to(els, { opacity: 1, y: 0, duration: 0.26, stagger: 0.06, ease: 'power2.out' }) },
        })
        // as folhas do relatório saem da pilha e abrem em leque com a rolagem (no celular, uma fila)
        if (!desk) return
        // leve: as medidas são lidas uma vez (e de novo só no refresh), a ordem das folhas é fixada
        // uma vez e cada quadro só escreve transform, que a placa de vídeo compõe sem repintar
        const deck = document.querySelector<HTMLElement>('.lp-deck')!
        const sheets = gsap.utils.toArray<HTMLElement>('.lp-deck .sheet-wrap')
        deck.classList.add('fan')
        sheets.forEach((el, i) => { el.style.zIndex = String(sheets.length - i) })
        let spread = 0
        const measure = () => { spread = Math.min(215, (deck.clientWidth - sheets[0].offsetWidth) / (sheets.length - 1)) }
        const k = { v: 0 }
        const place = () => sheets.forEach((el, i) => {
          const c = i - (sheets.length - 1) / 2
          const x = gsap.utils.interpolate(c * 7, c * spread, k.v)
          const y = gsap.utils.interpolate(Math.abs(c) * 3, c * c * 7, k.v)
          const r = gsap.utils.interpolate(c * 1.5, c * 4, k.v)
          el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${r}deg)`
        })
        measure()
        place()
        gsap.to(k, { v: 1, ease: 'none', onUpdate: place, scrollTrigger: { trigger: deck, start: 'top 85%', end: 'center 55%', scrub: 0.5, onRefresh: () => { measure(); place() } } })
        return () => { deck.classList.remove('fan'); sheets.forEach((el) => { el.style.transform = ''; el.style.zIndex = '' }) }
      })
    }, root)
    document.fonts.ready.then(() => ScrollTrigger.refresh())
    return () => ctx.revert()
  }, [still])

  // com movimento reduzido, o grupo da etapa aparece pousado, sem queda
  useEffect(() => { if (still) fall.p = beat + 1 }, [beat, still])

  // troca da etapa: o texto atual sai em 160 ms e só então o novo entra, antes de ser lido
  useEffect(() => {
    target.current = shown
    if (shown === current) return
    if (still || !cap.current) { setCurrent(shown); return }
    const tw = gsap.to(cap.current.children, { opacity: 0, y: -8, duration: 0.16, ease: 'power1.in', onComplete: () => setCurrent(target.current) })
    return () => { tw.kill() }
  }, [shown, current, still])
  useLayoutEffect(() => {
    drawCash(cashK.current)
    if (still || !cap.current) return
    const tw = gsap.fromTo(cap.current.children, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.05, ease: 'power2.out' })
    return () => { tw.kill() }
  }, [current, still])

  // leitor do relatório: trava a página, abre na folha clicada e fecha com Esc
  const scale = Math.min(1, (innerWidth - 48) / PAGE_W)
  useLayoutEffect(() => {
    if (reading == null) return
    const html = document.documentElement
    html.style.overflow = 'hidden'
    reader.current!.scrollTop = reading * (PAGE_H * scale + STEP_GAP) + READER_PAD - 16 // a folha abre rente ao topo
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setReading(null) }
    window.addEventListener('keydown', onKey)
    return () => { html.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [reading, scale])

  const onPhoto = useCallback((url: string) => { setPhoto(url); setWantPhoto(false) }, [])
  const start = (e?: MouseEvent) => {
    e?.preventDefault()
    if (still) return onStart()
    gsap.to(root.current, { opacity: 0, duration: 0.22, ease: 'power1.in', onComplete: onStart })
  }
  const go = (sel: string) => document.querySelector(sel)?.scrollIntoView({ behavior: still ? 'auto' : 'smooth' })
  const openSheet = (e: MouseEvent) => {
    const w = (e.target as HTMLElement).closest('.sheet-wrap')
    if (w) setReading([...w.parentElement!.children].indexOf(w))
  }
  const plan = <div className="lp-fallback" style={{ top: inset.top, right: inset.right, bottom: inset.bottom, left: inset.left }}><Plan items={SHOW} sea /></div>
  const report = <ReportSheets name={MODEL.name} spec={MODEL.spec!} photo={photo} ev={EV} biz={BIZ} />

  return (
    <div className="lp" ref={root}>
      <div className="lp-canvas" aria-hidden="true">
        {webgl ? (
          <Suspense fallback={beat < 0 ? null : plan}>
            <Showcase beat={beat} inset={inset} paused={paused} still={still} wantPhoto={wantPhoto} onPhoto={onPhoto} />
          </Suspense>
        ) : plan}
      </div>

      <header className="lp-nav">
        <a className="lockup" href="#" aria-label="Roomi Maker"><span className="wm" /><i /><span>Maker</span></a>
        <a className="lp-btn" href="#builder" onClick={start}>Começar meu projeto</a>
      </header>

      <section className="lp-hero">
        <div className="col">
          <h1 className="lp-title">
            <span className="t1 rise">Simulador de resorts</span>
            <span className="t2 rise">Comece seu sonho</span>
            <span className="t3 rise">com a Roomi</span>
          </h1>
          <p className="lp-desc rise">Responda oito perguntas e veja o resort se montar em 3D, num terreno de 4 hectares. O relatório sai em folhas A4, com investimento, operação e retorno em 10 anos.</p>
          <div className="lp-ctas rise">
            <a className="lp-btn" href="#builder" onClick={start}>Começar meu projeto</a>
            <button className="lp-btn ghost" onClick={() => go('.lp-build')}>Ver como funciona</button>
          </div>
          <div className="lp-hero-nums rise">
            <div><b>{EV.keys}</b><span>UHs</span></div>
            <div><b>{mi(BIZ.investment)}</b><span>R$ mi de investimento</span></div>
            <div><b>{num((BIZ.irr ?? 0) * 100, 1)}</b><span>% de TIR real</span></div>
          </div>
          <p className="lp-note rise">Exemplo: {MODEL.name.toLowerCase()}, montado no Maker.</p>
        </div>
      </section>

      <section className="lp-build" aria-label="Como funciona, passo a passo">
        <div className="lp-stick">
          <div className="lp-beat">
            <div className="lp-count">
              <div className="nm"><b>{String(current + 1).padStart(2, '0')}</b><i>/{String(BEATS.length).padStart(2, '0')}</i></div>
              <div className="lp-prog">{BEATS.map((x, i) => <span key={x.title} className={i === shown ? 'cur' : i < shown ? 'done' : ''} />)}</div>
            </div>
            <div className="cap" ref={cap} key={current}>
              <h2>{b.title}</h2>
              <p className="lp-lead">{b.lead}</p>
              <p className="lp-step-note">{b.note}</p>
              {b.chart && <MiniCash />}
            </div>
            <button className="lp-skip" onClick={() => go('.lp-questions')}>Pular para as perguntas</button>
          </div>
        </div>
      </section>

      <section className="lp-questions">
        <h2 className="lp-h2">Perguntas que visam <span className="hl">o futuro</span></h2>
        <p className="lp-lede">Sete perguntas de negócio, mais o nome do projeto. Cada resposta muda o hotel no mapa e as contas na hora. No fim, um checklist de escopo confirma o que entra no investimento.</p>
        <ol className="lp-qs">
          {QUESTIONS.map((q, i) => (
            <li key={q.q} className="lp-q">
              <span className="quad">{i + 1}</span>
              <div><h3>{q.q}</h3><p>{q.why}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-report">
        <h2 className="lp-h2">O estudo sai em <span className="hl">seis folhas A4</span>.</h2>
        <p className="lp-lede">Este é o relatório do exemplo, gerado pelo Maker: a capa com a fachada, o hotel em números, a operação, o caixa em 10 anos, valor e risco, e as premissas. Clique numa folha para ler.</p>
        <div className="sheets lp-deck" style={{ '--s': 0.38 } as CSSProperties} onClick={openSheet}>{report}</div>
        <button className="lp-btn ghost lp-read" onClick={() => setReading(0)}>Ler o relatório do exemplo</button>
      </section>

      <section className="lp-cta">
        <h2 className="lp-h2">Seu estudo fica pronto em 8 respostas.</h2>
        <a className="lp-btn ink" href="#builder" onClick={start}>Começar meu projeto</a>
        <img className="lp-chapeu" src="/roomi-chapeu.svg" alt="" />
        <div className="lockup ink"><span className="wm" /><i /><span>Maker</span></div>
      </section>

      <footer className="lp-foot">
        <p>Simulação para comparar cenários, não um estudo de viabilidade. Fontes: Panorama da Hotelaria Brasileira 2026 (HotelInvest e FOHB), JLL, HVS, ABIH-SP, Resorts Brasil, CUB Sinduscon-SP e SINAPI.</p>
      </footer>

      {reading != null && (
        <div className="lp-viewer" role="dialog" aria-modal="true" aria-label="Relatório do exemplo" onClick={() => setReading(null)}>
          <button className="lp-btn lp-viewer-close" onClick={() => setReading(null)}>Fechar</button>
          <div className="lp-viewer-scroll" ref={reader} onClick={(e) => e.stopPropagation()}>
            <div className="sheets" style={{ '--s': scale } as CSSProperties}>{report}</div>
          </div>
        </div>
      )}
    </div>
  )
}
