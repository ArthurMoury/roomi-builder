import { useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { GRID } from '../store'

// Câmera fixa, reta e de frente para o board (a chegada, ao sul, fica embaixo). O board só gira de
// 90 em 90 graus, pelo clique numa das laterais, e a roda do mouse aproxima ou afasta. Não há
// órbita livre nem arrasto. O enquadramento cabe o board (e o mar, quando houver) na área que a
// interface deixa livre.

export interface Inset { top: number; right: number; bottom: number; left: number }
export interface Bounds { x0: number; x1: number; z0: number; z1: number }

export const HALF = GRID / 2 + 1.4 // meio board, com o plano coral deslocado atrás da laje
export const boardBounds = (): Bounds => ({ x0: -HALF, x1: HALF, z0: -HALF, z1: HALF })

// Alvos da câmera. A interface (e a LP, rolando) muda estes valores; a câmera anda até eles.
export const view = {
  turn: 0,  // quartos de volta; negativo traz a lateral esquerda para a frente
  zoom: 1,  // 1 = tudo na área livre; menor aproxima
  inset: { top: 88, right: 16, bottom: 230, left: 16 } as Inset, // px ocupados pela interface
  bounds: boardBounds(), // o que precisa caber no quadro, em unidades do mundo
}

// Valores atuais, suavizados a cada quadro (o giro em curso também vale para o clique nas laterais)
export const cam = { az: 0, zoom: 1, ...view.inset }

export function resetView(inset: Inset) {
  view.turn = 0
  view.zoom = 1
  view.inset = { ...inset }
  Object.assign(cam, { az: 0, zoom: 1 }, inset)
}

export const POLAR = 0.86 // ângulo da câmera a partir da vertical (o board aparece reto, de frente)
const PAD = 20       // folga entre o conteúdo e a interface, em px
const BOTTOM = -1.8  // fundo das lajes
const TALL = 5       // altura dos prédios mais altos, para não cortar os telhados
const SIN = Math.sin(POLAR), COS = Math.cos(POLAR)

// Os oito cantos do que precisa caber, projetados com a câmera a D unidades no giro atual:
// largura, altura e centro na tela, em px a partir do centro do quadro
function project(D: number, k: number) {
  const sa = Math.sin(cam.az), ca = Math.cos(cam.az)
  const bx = sa * SIN, by = COS, bz = ca * SIN       // da mira para a câmera
  const rx = ca, rz = -sa                           // direita da tela
  const ux = by * rz, uy = bz * rx - bx * rz, uz = -by * rx // cima da tela
  const { x0, x1, z0, z1 } = view.bounds
  let l = Infinity, r = -Infinity, b = Infinity, t = -Infinity
  for (const x of [x0, x1]) for (const y of [BOTTOM, TALL]) for (const z of [z0, z1]) {
    const depth = D - (x * bx + y * by + z * bz)
    if (depth <= 1) return null
    const px = ((x * rx + z * rz) / depth) * k, py = ((x * ux + y * uy + z * uz) / depth) * k
    l = Math.min(l, px); r = Math.max(r, px); b = Math.min(b, py); t = Math.max(t, py)
  }
  return { w: r - l, h: t - b, cx: (l + r) / 2, cy: (b + t) / 2 }
}

// Menor distância em que tudo cabe numa área livre de aw × ah px
function fit(aw: number, ah: number, k: number) {
  let lo = 10, hi = 4000
  for (let i = 0; i < 24; i++) {
    const D = (lo + hi) / 2, p = project(D, k)
    if (p && p.w <= aw && p.h <= ah) hi = D
    else lo = D
  }
  return hi
}

// A lateral do board sob um ponto do chão, vista da câmera: −1 esquerda, 1 direita, 0 meio
export function sideAt(p: THREE.Vector3, band: number) {
  const u = p.x * Math.cos(cam.az) - p.z * Math.sin(cam.az)
  return u < -GRID / 2 + band ? -1 : u > GRID / 2 - band ? 1 : 0
}

export function CameraRig({ wheel = true }: { wheel?: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    if (!wheel) return
    const el = gl.domElement
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      view.zoom = THREE.MathUtils.clamp(view.zoom * Math.exp(e.deltaY * 0.001), 0.45, 1.25)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [gl, wheel])

  useFrame((state, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 6)
    cam.az += (view.turn * (Math.PI / 2) - cam.az) * k
    cam.zoom += (view.zoom - cam.zoom) * k
    cam.top += (view.inset.top - cam.top) * k
    cam.right += (view.inset.right - cam.right) * k
    cam.bottom += (view.inset.bottom - cam.bottom) * k
    cam.left += (view.inset.left - cam.left) * k

    const { width: W, height: H } = state.size
    const px = H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) // px por unidade a 1 de profundidade
    const aw = Math.max(120, W - cam.left - cam.right - 2 * PAD)
    const ah = Math.max(120, H - cam.top - cam.bottom - 2 * PAD)
    const D = fit(aw, ah, px) * cam.zoom
    const p = project(D, px) ?? { cx: 0, cy: 0 }
    camera.position.set(Math.sin(cam.az) * SIN * D, COS * D, Math.cos(cam.az) * SIN * D)
    camera.lookAt(0, 0, 0)
    // desloca o quadro para o conteúdo ficar no meio da área livre (e não do canvas inteiro)
    camera.setViewOffset(W, H, (cam.right - cam.left) / 2 + p.cx, (cam.bottom - cam.top) / 2 - p.cy, W, H)
  })
  return null
}
