import { useEffect, useMemo, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { createPortal, useThree } from '@react-three/fiber'
import { ITEM_BY_ID } from '../data/catalog'
import { MODELS, layoutOf } from '../data/models'
import { GRID, footprint, linksOf, useStore, type SketchItem } from '../store'
import { Model } from './models'
import { C, halftones, mat } from './materials'
import { Edges } from './parts'

const MODEL_SIZE = { w: 560, h: 340 }  // imagem da galeria de modelos
const MODEL_VIEW = new THREE.Vector3(0, Math.cos(0.86), Math.sin(0.86)) // de frente, como o board abre
const PHOTO_SIZE = { w: 1600, h: 840 } // fachada para o relatório
const FRONT_VIEW = new THREE.Vector3(0, 0.42, 1).normalize() // de frente, pela chegada (sul)

// Itens prontos, sem animação de obra (fotos e LP com movimento reduzido)
export function StaticItems({ items }: { items: SketchItem[] }) {
  const placed = useMemo(() => items.map((it, k) => ({ uid: `t${k}`, itemId: it.id, x: it.x, z: it.z, rot: it.rot })), [items])
  const none = useMemo(() => new Set<string>(), [])
  return placed.map((p) => {
    const it = ITEM_BY_ID[p.itemId], f = footprint(p.itemId, p.rot)
    return (
      <group key={p.uid} position={[p.x + f.w / 2 - GRID / 2, 0, p.z + f.d / 2 - GRID / 2]} rotation-y={it.link ? 0 : p.rot * (Math.PI / 2)}>
        <Model id={p.itemId} w={it.w} d={it.d} links={it.link ? linksOf(placed, none, p) : ''} rot={p.rot} />
      </group>
    )
  })
}

// Resort inteiro sobre a laje, como no mapa
function Layout({ items }: { items: SketchItem[] }) {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[GRID, GRID]} />
        <meshBasicMaterial color={C.cream} />
      </mesh>
      <mesh position-y={-0.62} material={mat.slab}>
        <boxGeometry args={[GRID, 1.2, GRID]} />
        <Edges color={C.ink} />
      </mesh>
      <mesh position={[1.4, -1.1, 1.4]}>
        <boxGeometry args={[GRID, 1.2, GRID]} />
        <meshBasicMaterial color={C.coral} />
        <Edges color={C.ink} />
      </mesh>
      <StaticItems items={items} />
    </>
  )
}

interface Subject { key: string; node: ReactNode; size: { w: number; h: number }; view: THREE.Vector3; fill: number; dots: number }
type Shot = Omit<Subject, 'key' | 'node'>

// Fotografa o grupo 'subject' da cena num render target e devolve a imagem em PNG
function shoot(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, target: THREE.WebGLRenderTarget, shot: Shot) {
  const root = scene.getObjectByName('subject')!
  const { w: W, h: H } = shot.size
  const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere())
  camera.aspect = W / H
  camera.updateProjectionMatrix()
  camera.position.copy(sphere.center).addScaledVector(shot.view, (sphere.radius / Math.sin(THREE.MathUtils.degToRad(15))) * shot.fill)
  camera.lookAt(sphere.center)

  // pontos do meio-tom proporcionais à imagem
  const saved = halftones.map((m) => [m.uniforms.uCell.value, m.uniforms.uR.value] as const)
  halftones.forEach((m) => { m.uniforms.uCell.value *= shot.dots; m.uniforms.uR.value *= shot.dots })
  const prevColor = gl.getClearColor(new THREE.Color()), prevAlpha = gl.getClearAlpha()
  gl.setRenderTarget(target)
  gl.setClearColor(0x000000, 0)
  gl.clear()
  gl.render(scene, camera)
  const px = new Uint8Array(W * H * 4)
  gl.readRenderTargetPixels(target, 0, 0, W, H, px)
  gl.setRenderTarget(null)
  gl.setClearColor(prevColor, prevAlpha)
  halftones.forEach((m, k) => { m.uniforms.uCell.value = saved[k][0]; m.uniforms.uR.value = saved[k][1] })

  // o WebGL lê de baixo para cima: inverte as linhas
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4)
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

function makeTarget({ w, h }: { w: number; h: number }) {
  const t = new THREE.WebGLRenderTarget(w, h, { samples: 4 })
  t.texture.colorSpace = THREE.SRGBColorSpace
  return t
}

const Lights = () => (
  <>
    <ambientLight intensity={0.55} />
    <directionalLight position={[6, 14, 3]} intensity={1.6} />
  </>
)

// Fotografa cada modelo da galeria com o próprio layout, um por vez, numa cena à parte. A fila só
// começa quando a galeria abre pela primeira vez.
export function Thumbs() {
  const gl = useThree((s) => s.gl)
  const [i, setI] = useState(0)
  const [models, setModels] = useState(false)
  const gallery = useStore((s) => s.modal?.type === 'models')
  useEffect(() => { if (gallery) setModels(true) }, [gallery])
  const subjects = useMemo<Subject[]>(() => models
    ? MODELS.map((m) => ({ key: `model:${m.id}`, node: <Layout items={layoutOf(m)} />, size: MODEL_SIZE, view: MODEL_VIEW, fill: 0.62, dots: 0.5 }))
    : [], [models])
  const scene = useMemo(() => new THREE.Scene(), [])
  const camera = useMemo(() => new THREE.PerspectiveCamera(30, 1, 0.1, 500), [])
  const targets = useMemo(() => new Map<Subject['size'], THREE.WebGLRenderTarget>(), [])
  const subject = subjects[i]

  useEffect(() => () => targets.forEach((t) => t.dispose()), [targets])

  useEffect(() => {
    if (!subject || !scene.getObjectByName('subject')) return
    let target = targets.get(subject.size)
    if (!target) targets.set(subject.size, (target = makeTarget(subject.size)))
    const url = shoot(gl, scene, camera, target, subject)
    useStore.setState((s) => ({ thumbs: { ...s.thumbs, [subject.key]: url } }))

    // próximo da fila sem depender de quadros (segue mesmo com a aba em segundo plano)
    const next = setTimeout(() => setI((n) => n + 1), 0)
    return () => clearTimeout(next)
  }, [subject, scene, camera, targets, gl])

  if (!subject) return null
  return createPortal(
    <>
      <Lights />
      <group key={subject.key} name="subject">{subject.node}</group>
    </>,
    scene,
  )
}

// Fachada do hotel para o relatório: o mapa atual montado numa cena à parte (sem animação de obra,
// sem moldura de seleção) e fotografado de frente, pela chegada
export function FrontPhoto() {
  const gl = useThree((s) => s.gl)
  const req = useStore((s) => s.photoReq)
  const [items, setItems] = useState<SketchItem[] | null>(null)
  const scene = useMemo(() => new THREE.Scene(), [])
  const camera = useMemo(() => new THREE.PerspectiveCamera(30, 1, 0.1, 500), [])
  const target = useMemo(() => makeTarget(PHOTO_SIZE), [])
  useEffect(() => () => target.dispose(), [target])
  useEffect(() => {
    if (!req) return
    const { placed, dying } = useStore.getState()
    setItems(placed.filter((p) => !dying.has(p.uid)).map((p) => ({ id: p.itemId, x: p.x, z: p.z, rot: p.rot })))
  }, [req])
  useEffect(() => {
    if (!items) return
    useStore.setState({ photo: shoot(gl, scene, camera, target, { size: PHOTO_SIZE, view: FRONT_VIEW, fill: 0.47, dots: 0.9 }) })
    setItems(null)
  }, [items, gl, scene, camera, target])
  if (!items) return null
  return createPortal(
    <>
      <Lights />
      <group name="subject"><Layout items={items} /></group>
    </>,
    scene,
  )
}
