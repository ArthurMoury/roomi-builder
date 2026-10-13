import { useEffect, useRef, type RefObject } from 'react'

// A entrada da Roomi na abertura da LP (cofre: design › Formas geométricas da marca, "Degraus" e
// "Entrada com GSAP"): a parede com a porta, a moldura, o L coral, o vão em meio-tom e a massa em
// degraus, redesenhados nas coordenadas da arte (1214 × 1214) em Canvas 2D, com o plano coral
// deslocado atrás da parede (plano atrás de plano).
// - Ao carregar, as camadas vêm do fundo e se assentam, cada uma na sua profundidade.
// - Parada, uma onda de luz caminha pelo meio-tom dos degraus e o L coral sobe e desce como porta de
//   elevador. O mouse não mexe na cena: ela só muda sozinha e com a rolagem.
// - Com a rolagem (a abertura fica presa por uma tela), a câmera entra pelo vão escuro da porta: cada
//   camada cresce em volta do ponto de fuga, a de perto mais rápido que a do fundo, e passa da câmera;
//   os pontos do vão crescem como lupa até se fundirem num escuro só. A tela termina preta, e os passos
//   começam no mesmo fundo.

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
// as mesmas formas em retângulos (todas são retas): o recorte por retângulo não vira máscara, então a
// retícula continua barata com a câmera bem perto
type Rect = [number, number, number, number]
const VAO_R: Rect[] = [[765, 386, 912, 700], [563, 700, 912, 833]]
const VERGA_R: Rect[] = [[460, 142, 765, 300], [460, 300, 563, 833]]
const MASSA_R: Rect[] = [[0, 993, 1214, 1214], [460, 833, 1015, 993]]
const FUGA: Pt = [838, 543] // o meio do vão escuro, à direita do L: é por ali que a câmera entra
const STEP = 32             // passo da retícula
const DOOR = 1.45           // distância do vão: a câmera anda até ele ficar do tamanho da tela inteira
const ZOOM = 30             // quanto o vão cresce até o fim da abertura presa (cobre qualquer tela)

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

// Meio-tom: grade de pontos tinta sobre o papel creme, recortada retângulo a retângulo, num caminho só
// por retângulo. Raio acima de meio passo funde os pontos e a área vira negativo (fundo cheio com furos
// em losango); a partir de 0,71 do passo os furos fecham e a área fica toda escura (aí vira um
// preenchimento só). Cada passada desenha os pontos que tocam o seu retângulo, então não há costura.
function dots(ctx: CanvasRenderingContext2D, rects: Rect[], radius: (x: number, y: number) => number, solid = false) {
  // só os pontos que caem na tela: com a câmera entrando, cada ponto fica enorme e quase todos saem do quadro
  const inv = ctx.getTransform().inverse()
  const { width: cw, height: ch } = ctx.canvas
  const seen = [[0, 0], [cw, 0], [0, ch], [cw, ch]].map(([x, y]) => inv.transformPoint(new DOMPoint(x, y)))
  const vx0 = Math.min(...seen.map((q) => q.x)), vx1 = Math.max(...seen.map((q) => q.x))
  const vy0 = Math.min(...seen.map((q) => q.y)), vy1 = Math.max(...seen.map((q) => q.y))
  for (const [rx0, ry0, rx1, ry1] of rects) {
    const x0 = Math.max(rx0, vx0) - STEP, x1 = Math.min(rx1, vx1) + STEP
    const y0 = Math.max(ry0, vy0) - STEP, y1 = Math.min(ry1, vy1) + STEP
    if (x0 > x1 || y0 > y1) continue
    ctx.save()
    ctx.beginPath()
    ctx.rect(rx0, ry0, rx1 - rx0, ry1 - ry0)
    ctx.fillStyle = solid ? INK : CREAM
    ctx.fill()
    if (!solid) {
      ctx.clip()
      ctx.fillStyle = INK
      ctx.beginPath()
      for (let y = Math.floor(y0 / STEP) * STEP + STEP / 2; y < y1 + STEP; y += STEP)
        for (let x = Math.floor(x0 / STEP) * STEP + STEP / 2; x < x1 + STEP; x += STEP) {
          const r = radius(x, y)
          if (r > 0.4) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU) }
        }
      ctx.fill()
    }
    ctx.restore()
  }
}

// Desenha a cena. travel: quanto a câmera andou porta adentro (negativo: as camadas ainda vêm do
// fundo); dark: quanto o vão já fechou no escuro; out: quanto o resto da cena já se apagou na entrada
// (só o vão escuro fica); alpha: a cena aparecendo ao carregar; s: pixels de tela por unidade da arte
function draw(ctx: CanvasRenderingContext2D, s: number, t: number, travel: number, dark: number, out: number, alpha: number) {
  const [FX, FY] = FUGA
  if (alpha <= 0.002) return
  // cada camada tem uma distância: cresce k = dist / (dist − travel) em volta do ponto de fuga; a que a
  // câmera já passou some
  const layer = (dist: number, paint: (lw: number) => void, fade = out) => {
    const k = dist / (dist - travel)
    if (!(k > 0) || k > 120 || fade >= 0.999) return
    ctx.save()
    ctx.globalAlpha = alpha * (1 - fade)
    ctx.translate(FX, FY)
    ctx.scale(k, k)
    ctx.translate(-FX, -FY)
    paint(1.4 / (s * k))
    ctx.restore()
  }
  // a parede, com o plano coral deslocado atrás; fica até o fim, para o vão escuro crescer sobre ela
  layer(2.2, (lw) => {
    plane(ctx, QUADRO.map(([x, y]) => [x + 30, y + 30] as Pt), CORAL, lw)
    plane(ctx, QUADRO, CREAM, lw)
  }, 0)
  // o vão aberto da porta: meio-tom tão cheio que vira escuro com furos; na entrada, os furos fecham
  layer(1.45, (lw) => {
    dots(ctx, VAO_R, () => STEP * (0.62 + 0.12 * dark), dark >= 0.999)
    plane(ctx, VAO, null, lw)
  }, 0)
  // o L coral sobe e desce como porta de elevador
  layer(1.4, (lw) => {
    const base = 748 + 34 * Math.sin((t * TAU) / 5)
    plane(ctx, [[563, 300], [912, 300], [912, 386], [765, 386], [765, base], [563, base]], CORAL, lw)
  })
  // a moldura e a verga, com a retícula que engrossa para baixo e para a esquerda
  layer(1.3, (lw) => {
    plane(ctx, MOLDURA, null, lw)
    dots(ctx, VERGA_R, (x, y) => STEP * 0.34 * clamp01((770 - x) / 300 + (y - 300) / 520))
    plane(ctx, VERGA, null, lw)
  })
  // os degraus: a retícula engrossa para a direita até virar negativo, com a onda de luz caminhando
  layer(1.05, (lw) => {
    const wave = (x: number) => 0.1 * Math.sin((t * TAU) / 6 - x / 170)
    dots(ctx, MASSA_R, (x, y) => STEP * (0.3 + 0.4 * clamp01((x - 60) / 1000 + (y - 900) / 1400 + wave(x))))
    plane(ctx, MASSA, null, lw)
  })
}

// `frame` é o lugar da arte parada (a coluna da direita no desktop, o alto da tela no celular); o
// canvas cobre a abertura inteira, para a entrada pela porta encher a tela. onGlow recebe a força do
// brilho coral da sala (some na entrada, que termina no escuro).
export function Entry({ still, frame, onGlow }: { still: boolean; frame: RefObject<HTMLDivElement | null>; onGlow?: (v: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const glow = useRef(onGlow)
  useEffect(() => { glow.current = onGlow }, [onGlow])

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let fit = { s: 1, ox: 0, oy: 0, dpr: 1 }
    let t = still ? 1.2 : 0, intro = still ? 1 : 0

    const paint = () => {
      // a entrada: a rolagem da abertura presa (uma tela) leva a câmera pelo vão escuro da porta. O vão
      // cresce por um fator constante a cada pedaço de rolagem (zoom uniforme), então qualquer rolagem
      // mexe a cena; a moldura, o L e os degraus se apagam cedo, e o escuro do vão toma a parede creme
      const q = still ? 0 : clamp01(scrollY / innerHeight)
      const k = Math.exp((Math.min(q, 0.94) / 0.94) * Math.log(ZOOM))
      const travel = DOOR * (1 - 1 / k) - 0.3 * (1 - smooth(intro))
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(fit.dpr * fit.s, 0, 0, fit.dpr * fit.s, fit.dpr * fit.ox, fit.dpr * fit.oy)
      draw(ctx, fit.s, t, travel, smooth((q - 0.3) / 0.45), smooth((q - 0.08) / 0.26), smooth(intro * 1.6))
      // no fim da entrada a tela fica toda no escuro da página, em qualquer formato de tela
      const night = smooth((q - 0.9) / 0.08)
      if (night > 0) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = night
        ctx.fillStyle = INK
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.globalAlpha = 1
      }
      glow.current?.((1 - smooth((q - 0.2) / 0.5)) * (0.6 + 0.4 * smooth(intro)))
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

    let raf = 0, last = 0, running = false
    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0
      last = now
      t += dt
      intro = Math.min(1, intro + dt / 1.3)
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
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [still, frame])

  return <canvas ref={ref} className="lp-entry" aria-hidden="true" />
}
