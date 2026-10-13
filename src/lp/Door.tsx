import { useEffect, useRef } from 'react'

// A porta da Roomi na abertura da LP (cofre: design › Formas geométricas da marca, "Porta que abre"):
// parede escura, porta creme, a luz coral do quarto, a bandeira e o piso em meio-tom, redesenhados
// peça por peça nas coordenadas da arte (1164 × 1482) e animados em Canvas 2D, sem biblioteca.
// - Ao carregar, a porta sai fechada e abre numa mola; a luz coral cresce com o vão.
// - Parada, balança devagar (ciclo de 9 s). Com o mouse em cima, segue o mouse (para a direita abre);
//   um clique a empurra, ela escancara e volta balançando.
// - Tudo conectado: cada vértice tem uma profundidade e anda com o mouse em paralaxe, sem plano
//   descolar. A retícula do chão engrossa perto da soleira quando entra luz e corre mais quando a
//   porta mexe; a bandeira pega o vento dela; os pontos incham perto do mouse.
// - Com a rolagem, a porta abre de vez antes de a abertura sair da tela.
// Tema escuro do molde: papel do meio-tom transparente, ponto creme e contorno creme a 55%.

const W = 1164, H = 1482
const TAU = Math.PI * 2, DEG = Math.PI / 180
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const clamp01 = (v: number) => clamp(v, 0, 1)
const INK = '#1D1D1B', CREAM = '#F1E9E7', CORAL = '#F97B55', LINE = 'rgba(241, 233, 231, .55)'

type Pt = [number, number]

function trace(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

// plano chapado com contorno fino
function plane(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string | null, lw: number) {
  trace(ctx, pts)
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  ctx.strokeStyle = LINE
  ctx.lineWidth = lw
  ctx.lineJoin = 'miter'
  ctx.stroke()
}

// Meio-tom: grade escalonada de pontos recortada pelo polígono, todos num caminho só. O raio é por
// ponto (degradê de pontos) e o deslocamento faz a retícula andar sem salto.
function dots(ctx: CanvasRenderingContext2D, pts: Pt[], step: number, radius: (x: number, y: number) => number, dx: number, dy: number) {
  ctx.save()
  trace(ctx, pts)
  ctx.clip()
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  const row = step * 0.866, period = row * 2
  const ox = ((dx % step) + step) % step, oy = ((dy % period) + period) % period
  ctx.fillStyle = CREAM
  ctx.beginPath()
  for (let j = Math.floor((y0 - oy) / row) - 1, jn = Math.ceil((y1 - oy) / row) + 1; j <= jn; j++) {
    const y = oy + j * row
    const half = Math.abs(j % 2) === 1 ? step / 2 : 0
    for (let i = Math.floor((x0 - ox - half) / step) - 1, n = Math.ceil((x1 - ox - half) / step) + 1; i <= n; i++) {
      const x = ox + half + i * step
      const r = radius(x, y)
      if (r > 0.4) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU) }
    }
  }
  ctx.fill()
  ctx.restore()
}

// A porta gira na dobradiça (x = 478) para dentro do quarto. O horizonte fica na verga (y = 292): o
// topo segue reto e a base sobe quando ela se afasta. Com 51,3° a borda cai em (874, 1188), a arte.
const HINGE = 478, DOOR_W = 684, TOP = 292, BASE = 1260, FOCUS = 6640
const REST = 51.3 * DEG
function edge(a: number) {
  const s = FOCUS / (FOCUS + DOOR_W * Math.sin(a))
  return { x: HINGE + DOOR_W * Math.cos(a) * s, yBase: TOP + (BASE - TOP) * s }
}
// normal (para baixo) da soleira, a linha do chão de (478, 1260) a (1164, 1482)
const SILL_NX = -222 / 721, SILL_NY = 686 / 721

interface State { ang: number; vel: number; floor: number; flag: number }
interface Ui { px: number; py: number; cx: number; cy: number; focus: number }

function draw(ctx: CanvasRenderingContext2D, s: number, st: State, ui: Ui) {
  const lw = 1.4 / s
  const P = (x: number, y: number, d: number): Pt => [x - ui.px * 34 * d, y - ui.py * 22 * d]
  const { x, yBase } = edge(st.ang)
  const open = clamp01((Math.sin(st.ang) - Math.sin(20 * DEG)) / (1 - Math.sin(20 * DEG)))
  const dDoor = 0.15 + 0.85 * Math.sin(st.ang)
  const HT = P(478, 292, 0), HB = P(478, 1260, 0)
  const PLT = P(0, 292, 0.8), PLB = P(0, 1105, 0.8)
  const BRT = P(1162, 292, -0.35), BRB = P(1164, 1482, -0.45)
  const PE = P(0, 1482, -0.9)
  const VE = P(478, 72, 0.15), BT = P(874, 0, -0.15), BB = P(874, 196, 0.05)
  const PT = P(x, 292, dDoor), PB = P(x, yBase, dDoor)
  // a luz que passa pela porta engrossa os pontos perto da soleira; os pontos incham perto do mouse
  const light = (px: number, py: number) => open * Math.exp(-Math.max(0, (px - 478) * SILL_NX + (py - 1260) * SILL_NY) / 200)
  const lens = (px: number, py: number) => (ui.focus > 0.01 ? ui.focus * Math.exp(-((px - ui.cx) ** 2 + (py - ui.cy) ** 2) / 57800) : 0)
  const floor = [PLB, HB, BRB, PE]
  dots(ctx, floor, 34, (px, py) => 11.5 * (0.85 + 0.55 * light(px, py) + 0.75 * lens(px, py)), st.floor * 0.95, st.floor * 0.31)
  plane(ctx, floor, null, lw)
  const flag = [VE, BT, BB]
  dots(ctx, flag, 34, (px, py) => 11.5 * (1 + 0.75 * lens(px, py)), st.flag, 0)
  plane(ctx, flag, null, lw)
  plane(ctx, [VE, BB, BRT, HT], INK, lw)
  plane(ctx, [PLT, HT, HB, PLB], INK, lw)
  plane(ctx, [PT, BRT, BRB, HB, PB], CORAL, lw)
  plane(ctx, [HT, PT, PB, HB], CREAM, lw)
  return open
}

export function Door({ still, onLight }: { still: boolean; onLight?: (open: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const light = useRef(onLight)
  useEffect(() => { light.current = onLight }, [onLight])

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const st: State = { ang: still ? REST : 6 * DEG, vel: 0, floor: 0, flag: 0 }
    const ui: Ui = { px: 0, py: 0, cx: -1e5, cy: -1e5, focus: 0 }
    const aim = { px: 0, py: 0, focus: 0 }
    let fit = { s: 1, ox: 0, oy: 0, dpr: 1 }
    let push = false

    const paint = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(fit.dpr * fit.s, 0, 0, fit.dpr * fit.s, fit.dpr * fit.ox, fit.dpr * fit.oy)
      light.current?.(draw(ctx, fit.s, st, ui))
    }
    // a arte inteira cabe no quadro (contain), nítida até densidade 2
    const resize = () => {
      const cw = canvas.clientWidth, ch = canvas.clientHeight
      if (!cw || !ch) return
      const dpr = Math.min(devicePixelRatio || 1, 2)
      canvas.width = Math.round(cw * dpr)
      canvas.height = Math.round(ch * dpr)
      const s = Math.min(cw / W, ch / H)
      fit = { s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, dpr }
      paint()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    // com movimento reduzido, a arte parada, como no molde
    if (still) return () => ro.disconnect()

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = canvas.getBoundingClientRect()
      aim.px = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1)
      aim.py = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1)
      aim.focus = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom ? 1 : 0
      ui.cx = (e.clientX - r.left - fit.ox) / fit.s
      ui.cy = (e.clientY - r.top - fit.oy) / fit.s
    }
    const onLeave = () => { aim.px = 0; aim.py = 0; aim.focus = 0 }
    const onDown = () => { push = true }
    addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)

    let raf = 0, last = 0, t = 0, running = false
    const frame = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0
      last = now
      t += dt
      const ease = 1 - Math.exp(-dt * 6)
      ui.px += (aim.px - ui.px) * ease
      ui.py += (aim.py - ui.py) * ease
      ui.focus += (aim.focus - ui.focus) * ease
      // parada balança; com o mouse em cima, segue o mouse; a rolagem escancara
      const idle = (51.3 + 14 * Math.sin((t * TAU) / 9)) * DEG
      const guided = (20 + 62 * ((ui.px + 1) / 2)) * DEG
      const scroll = clamp01(scrollY / (innerHeight * 0.55))
      let target = idle + (guided - idle) * ui.focus
      target += (86 * DEG - target) * scroll * scroll * (3 - 2 * scroll)
      // mola amortecida; espera o título subir antes de abrir
      if (t > 0.35) {
        st.vel += (40 * (target - st.ang) - 8.5 * st.vel) * dt
        if (push) st.vel += 3.4
        st.ang = clamp(st.ang + st.vel * dt, 6 * DEG, 88 * DEG)
      }
      push = false
      st.floor += dt * (20 + Math.abs(st.vel) * 90)
      st.flag += dt * (st.vel * 160 - 10)
      paint()
      raf = requestAnimationFrame(frame)
    }
    const run = (on: boolean) => {
      if (on === running) return
      running = on
      if (on) { last = 0; raf = requestAnimationFrame(frame) } else cancelAnimationFrame(raf)
    }
    // só anima com a porta na tela e a aba visível
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
      canvas.removeEventListener('pointerdown', onDown)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [still])

  return <canvas ref={ref} className="lp-door-art" />
}
