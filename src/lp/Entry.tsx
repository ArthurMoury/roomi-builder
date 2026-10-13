import { useEffect, useRef, type RefObject } from 'react'

// A entrada da Roomi na abertura da LP (cofre: design › Formas geométricas da marca, "Degraus" e
// "Entrada com GSAP"): a parede com a porta, a moldura, o L coral, o vão em meio-tom e a massa em
// degraus, redesenhados nas coordenadas da arte (1214 × 1214) em Canvas 2D, com o plano coral
// deslocado atrás da parede (plano atrás de plano).
// - Ao carregar, as camadas vêm do fundo e se assentam, cada uma na sua profundidade.
// - Parada, uma onda de luz caminha pelo meio-tom dos degraus e o L coral sobe e desce como porta de
//   elevador. Com o mouse, as camadas andam em paralaxe pela profundidade e os pontos incham perto dele.
// - Com a rolagem (a abertura fica presa por uma tela), a câmera entra pela porta: cada camada cresce em
//   volta do ponto de fuga no vão, a de perto mais rápido que a do fundo, e os pontos crescem como lupa
//   sobre a impressão. No fim tudo some no escuro da página: a pessoa entrou.

const ART = 1214
const TAU = Math.PI * 2
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x) }
const INK = '#1D1D1B', CREAM = '#F1E9E7', CORAL = '#F97B55'

type Pt = [number, number]
const QUADRO: Pt[] = [[0, 0], [1214, 0], [1214, 1214], [0, 1214]]
const MOLDURA: Pt[] = [[460, 142], [1015, 142], [1015, 833], [460, 833]]
const VERGA: Pt[] = [[460, 142], [765, 142], [765, 300], [563, 300], [563, 833], [460, 833]]
const MASSA: Pt[] = [[0, 993], [460, 993], [460, 833], [1015, 833], [1015, 993], [1214, 993], [1214, 1214], [0, 1214]]
const VAO: Pt[] = [[765, 386], [912, 386], [912, 833], [563, 833], [563, 700], [765, 700]]
const FUGA: Pt = [963, 600] // o vão aberto da porta, à direita do L
const STEP = 32             // passo da retícula

function trace(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

function plane(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string | null, lw: number) {
  trace(ctx, pts)
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  if (lw > 0) { ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineJoin = 'miter'; ctx.stroke() }
}

// Meio-tom: grade de pontos tinta sobre o papel creme, recortada pelo polígono, num caminho só. Raio
// acima de meio passo funde os pontos e a área vira negativo (fundo cheio com furos em losango).
function dots(ctx: CanvasRenderingContext2D, pts: Pt[], radius: (x: number, y: number) => number) {
  ctx.save()
  trace(ctx, pts)
  ctx.fillStyle = CREAM
  ctx.fill()
  ctx.clip()
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  // só os pontos que caem na tela: com a câmera entrando, cada ponto fica enorme e quase todos saem do quadro
  const inv = ctx.getTransform().inverse()
  const { width: cw, height: ch } = ctx.canvas
  const seen = [[0, 0], [cw, 0], [0, ch], [cw, ch]].map(([x, y]) => inv.transformPoint(new DOMPoint(x, y)))
  x0 = Math.max(x0, Math.min(...seen.map((q) => q.x)) - STEP)
  x1 = Math.min(x1, Math.max(...seen.map((q) => q.x)) + STEP)
  y0 = Math.max(y0, Math.min(...seen.map((q) => q.y)) - STEP)
  y1 = Math.min(y1, Math.max(...seen.map((q) => q.y)) + STEP)
  ctx.fillStyle = INK
  ctx.beginPath()
  for (let y = Math.floor(y0 / STEP) * STEP + STEP / 2; y < y1 + STEP; y += STEP)
    for (let x = Math.floor(x0 / STEP) * STEP + STEP / 2; x < x1 + STEP; x += STEP) {
      const r = radius(x, y)
      if (r > 0.4) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU) }
    }
  ctx.fill()
  ctx.restore()
}

interface Ui { px: number; py: number; cx: number; cy: number; focus: number }

// Desenha a cena. travel: quanto a câmera andou porta adentro (negativo: as camadas ainda vêm do
// fundo); fade: quanto já sumiu no fim da entrada; s: pixels de tela por unidade da arte
function draw(ctx: CanvasRenderingContext2D, s: number, t: number, travel: number, fade: number, ui: Ui) {
  const [FX, FY] = FUGA
  const alpha = 1 - fade
  if (alpha <= 0.002) return
  const lens = (x: number, y: number) => (ui.focus > 0.01 ? ui.focus * Math.exp(-((x - ui.cx) ** 2 + (y - ui.cy) ** 2) / 50000) : 0)
  // cada camada tem uma distância: cresce k = dist / (dist − travel) em volta do ponto de fuga e anda
  // com o mouse pela profundidade (a do fundo contra o mouse, a da frente a favor)
  const layer = (dist: number, paint: (lw: number) => void) => {
    const k = dist / (dist - travel)
    if (!(k > 0) || k > 60) return
    const depth = (2.2 - dist) / 1.15 * 2 - 1
    ctx.save()
    ctx.translate(FX + ui.px * 26 * depth, FY + ui.py * 18 * depth)
    ctx.scale(k, k)
    ctx.translate(-FX, -FY)
    paint(1.4 / (s * k))
    ctx.restore()
  }
  ctx.globalAlpha = alpha
  // a parede, com o plano coral deslocado atrás
  layer(2.2, (lw) => {
    plane(ctx, QUADRO.map(([x, y]) => [x + 30, y + 30] as Pt), CORAL, lw)
    plane(ctx, QUADRO, CREAM, lw)
  })
  // o vão aberto da porta: meio-tom tão cheio que vira escuro com furos
  layer(1.45, (lw) => {
    dots(ctx, VAO, (x, y) => STEP * (0.62 + 0.25 * lens(x, y)))
    plane(ctx, VAO, null, lw)
  })
  // o L coral sobe e desce como porta de elevador
  layer(1.4, (lw) => {
    const base = 748 + 34 * Math.sin((t * TAU) / 5)
    plane(ctx, [[563, 300], [912, 300], [912, 386], [765, 386], [765, base], [563, base]], CORAL, lw)
  })
  // a moldura e a verga, com a retícula que engrossa para baixo e para a esquerda
  layer(1.3, (lw) => {
    plane(ctx, MOLDURA, null, lw)
    dots(ctx, VERGA, (x, y) => STEP * (0.34 * clamp01((770 - x) / 300 + (y - 300) / 520) + 0.3 * lens(x, y)))
    plane(ctx, VERGA, null, lw)
  })
  // os degraus: a retícula engrossa para a direita até virar negativo, com a onda de luz caminhando
  layer(1.05, (lw) => {
    const wave = (x: number) => 0.1 * Math.sin((t * TAU) / 6 - x / 170)
    dots(ctx, MASSA, (x, y) => STEP * (0.3 + 0.4 * clamp01((x - 60) / 1000 + (y - 900) / 1400 + wave(x)) + 0.25 * lens(x, y)))
    plane(ctx, MASSA, null, lw)
  })
  ctx.globalAlpha = 1
}

// `frame` é o lugar da arte parada (a coluna da direita no desktop, o alto da tela no celular); o
// canvas cobre a abertura inteira, para a entrada pela porta encher a tela. onGlow recebe a força do
// brilho coral da sala (some junto com a cena no fim da entrada).
export function Entry({ still, frame, onGlow }: { still: boolean; frame: RefObject<HTMLDivElement | null>; onGlow?: (v: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const glow = useRef(onGlow)
  useEffect(() => { glow.current = onGlow }, [onGlow])

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const ui: Ui = { px: 0, py: 0, cx: -1e5, cy: -1e5, focus: 0 }
    const aim = { px: 0, py: 0, focus: 0 }
    let fit = { s: 1, ox: 0, oy: 0, dpr: 1 }
    let t = still ? 1.2 : 0, intro = still ? 1 : 0

    const paint = () => {
      // a entrada: a rolagem da abertura presa (uma tela) leva a câmera porta adentro
      const q = still ? 0 : clamp01(scrollY / innerHeight)
      const z = smooth((q - 0.04) / 0.92)
      const travel = 1.12 * z - 0.3 * (1 - smooth(intro))
      const fade = smooth((z - 0.8) / 0.2)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(fit.dpr * fit.s, 0, 0, fit.dpr * fit.s, fit.dpr * fit.ox, fit.dpr * fit.oy)
      draw(ctx, fit.s, t, travel, Math.max(fade, 1 - smooth(intro * 1.6)), ui)
      glow.current?.((1 - smooth((q - 0.5) / 0.46)) * (0.6 + 0.4 * smooth(intro)))
    }
    // a arte cabe no lugar dela (contain), nítida até densidade 2
    const resize = () => {
      const cw = canvas.clientWidth, ch = canvas.clientHeight
      const box = frame.current?.getBoundingClientRect(), own = canvas.getBoundingClientRect()
      if (!cw || !ch || !box) return
      const dpr = Math.min(devicePixelRatio || 1, 2)
      canvas.width = Math.round(cw * dpr)
      canvas.height = Math.round(ch * dpr)
      const s = Math.min(box.width / (ART + 30), box.height / (ART + 30))
      fit = { s, ox: box.left - own.left + (box.width - ART * s) / 2, oy: box.top - own.top + (box.height - ART * s) / 2, dpr }
      paint()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    if (frame.current) ro.observe(frame.current)
    resize()
    if (still) return () => ro.disconnect()

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const b = frame.current?.getBoundingClientRect()
      if (!b) return
      aim.px = Math.max(-1, Math.min(1, ((e.clientX - b.left) / b.width) * 2 - 1))
      aim.py = Math.max(-1, Math.min(1, ((e.clientY - b.top) / b.height) * 2 - 1))
      aim.focus = e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom ? 1 : 0
      const own = canvas.getBoundingClientRect()
      ui.cx = (e.clientX - own.left - fit.ox) / fit.s
      ui.cy = (e.clientY - own.top - fit.oy) / fit.s
    }
    const onLeave = () => { aim.px = 0; aim.py = 0; aim.focus = 0 }
    addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)

    let raf = 0, last = 0, running = false
    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0
      last = now
      t += dt
      intro = Math.min(1, intro + dt / 1.3)
      const ease = 1 - Math.exp(-dt * 5)
      ui.px += (aim.px - ui.px) * ease
      ui.py += (aim.py - ui.py) * ease
      ui.focus += (aim.focus - ui.focus) * ease
      paint()
      raf = requestAnimationFrame(loop)
    }
    const run = (on: boolean) => {
      if (on === running) return
      running = on
      if (on) { last = 0; raf = requestAnimationFrame(loop) } else cancelAnimationFrame(raf)
    }
    // só anima com a abertura na tela e a aba visível
    let seen = true
    const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; run(seen && !document.hidden) })
    io.observe(canvas)
    const onVis = () => run(seen && !document.hidden)
    document.addEventListener('visibilitychange', onVis)
    run(true)
    return () => {
      run(false)
      ro.disconnect()
      io.disconnect()
      removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [still, frame])

  return <canvas ref={ref} className="lp-entry" aria-hidden="true" />
}
