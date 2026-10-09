import { useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { GRID } from '../store'

// Câmera fixa, reta e de frente para o board (a chegada, ao sul, fica embaixo). O board só gira de
// 90 em 90 graus, pelo clique numa das laterais, e a roda do mouse aproxima ou afasta. Não há
// órbita livre nem arrasto. O enquadramento cabe o board na área que a interface deixa livre.

export interface Inset { top: number; right: number; bottom: number; left: number }

// Alvos da câmera. A interface (e a LP, rolando) muda estes valores; a câmera anda até eles.
export const view = {
  turn: 0,  // quartos de volta; negativo traz a lateral esquerda para a frente
  zoom: 1,  // 1 = board inteiro na área livre; menor aproxima
  inset: { top: 88, right: 16, bottom: 230, left: 16 } as Inset, // px ocupados pela interface
}

// Valores atuais, suavizados a cada quadro (o giro em curso também vale para o clique nas laterais)
export const cam = { az: 0, zoom: 1, ...view.inset }

export function resetView(inset: Inset) {
  view.turn = 0
  view.zoom = 1
  view.inset = { ...inset }
  Object.assign(cam, { az: 0, zoom: 1 }, inset)
}

const POLAR = 0.86   // ângulo da câmera a partir da vertical (o board aparece reto, de frente)
const PAD = 20       // folga entre o board e a interface, em px
const HALF = GRID / 2 + 1.4 // meio board, com o plano coral deslocado atrás da laje
const TALL = 5       // altura dos prédios mais altos, para o fundo não cortar os telhados
const SIN = Math.sin(POLAR), COS = Math.cos(POLAR)

// Quanto o board ocupa na tela (px) com a câmera a D unidades: meia largura na borda da frente,
// o quanto desce abaixo do centro e o quanto sobe acima dele
function extent(D: number, k: number) {
  const near = D - HALF * SIN, far = D + HALF * SIN - TALL * COS
  return { wide: (HALF / near) * k, below: ((HALF * COS) / near) * k, above: ((TALL * SIN + HALF * COS) / far) * k }
}

// Menor distância em que o board cabe numa área livre de aw × ah px
function fit(aw: number, ah: number, k: number) {
  let lo = 10, hi = 2000
  for (let i = 0; i < 24; i++) {
    const D = (lo + hi) / 2, e = extent(D, k)
    if (e.wide <= aw / 2 && e.below + e.above <= ah) hi = D
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
    const e = extent(D, px)
    camera.position.set(Math.sin(cam.az) * SIN * D, COS * D, Math.cos(cam.az) * SIN * D)
    camera.lookAt(0, 0, 0)
    // desloca o quadro para o board ficar no meio da área livre (e não do canvas inteiro)
    camera.setViewOffset(W, H, (cam.right - cam.left) / 2, (cam.bottom - cam.top) / 2 + (e.below - e.above) / 2, W, H)
  })
  return null
}
