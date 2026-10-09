import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { animate, type JSAnimation } from 'animejs'
import { useStore, GRID, footprint, linksOf } from '../store'
import { ITEM_BY_ID } from '../data/catalog'
import { TEMPLATES } from '../lib/autoplace'
import type { Placed } from '../lib/valuation'
import { Model } from './models'
import { mat, C, halftones, setHalftoneDpr } from './materials'
import { Edges, type Anim } from './parts'
import { mergeItem, disposeMerged } from './merge'
import { FrontPhoto, Thumbs } from './Thumbs'
import { Sea } from './Sea'
import { CameraRig, cam, sideAt, view } from './view'

const STEP = 170 // ms entre etapas da obra
const DROP = 8   // metros que telhados e coberturas caem até encaixar

// Altura de repouso de cada peça que cai, guardada na primeira vez. Sem isso, rodar o efeito
// de novo (StrictMode, HMR) tomava a posição já levantada como chão e o telhado ficava voando.
const restY = new WeakMap<THREE.Object3D, number>()

// Centro da pegada em coordenadas de mundo
const toWorld = (x: number, z: number, w: number, d: number): [number, number, number] =>
  [x + w / 2 - GRID / 2, 0, z + d / 2 - GRID / 2]

function collectParts(root: THREE.Object3D) {
  const parts: THREE.Object3D[] = []
  root.traverse((o) => { if (o.userData.anim) parts.push(o) })
  return parts
}

// Coreografia de entrada de cada peça (anime.js animando objetos three.js direto)
function buildIn(o: THREE.Object3D, delay: number): JSAnimation {
  const kind = o.userData.anim as Anim
  const d = delay + (o.userData.stage as number) * STEP
  switch (kind) {
    case 'spread':
      o.scale.set(0.001, 1, 0.001)
      return animate(o.scale, { x: 1, z: 1, duration: 520, delay: d, ease: 'outExpo' })
    case 'pop':
      o.scale.setScalar(0.001)
      return animate(o.scale, { x: 1, y: 1, z: 1, duration: 700, delay: d, ease: 'outElastic(1, .55)' })
    case 'fill':
      o.scale.y = 0.001
      return animate(o.scale, { y: 1, duration: 900, delay: d, ease: 'inOutSine' })
    case 'drop': {
      if (!restY.has(o)) restY.set(o, o.position.y)
      const y = restY.get(o)!
      o.position.y = y + DROP
      o.visible = false
      return animate(o.position, { y, duration: 560, delay: d, ease: 'outBounce', onBegin: () => { o.visible = true } })
    }
    default:
      o.scale.y = 0.001
      return animate(o.scale, { y: 1, duration: 560, delay: d, ease: 'outBack(1.6)' })
  }
}

const flashGeo = new THREE.PlaneGeometry(1, 1) // marcação da pegada, escalada para cada item

export interface ItemProps {
  p: Placed
  delay: number    // espera na cascata, em ms (lida uma vez, ao montar)
  dying: boolean   // em demolição
  links: string    // vizinhos iguais de uma peça de ligação ('nesw')
  onGone: (uid: string) => void
}

// Na cascata, cada item só é montado quando chega a vez dele: o custo de criar centenas de peças
// se espalha pela animação em vez de travar a página num quadro só.
export function Item(props: ItemProps) {
  const { p, dying, onGone } = props
  const [wait] = useState(props.delay)
  const [ready, setReady] = useState(wait <= 0)
  useEffect(() => {
    if (ready) return
    if (dying) { onGone(p.uid); return }
    const t = setTimeout(() => setReady(true), wait)
    return () => clearTimeout(t)
  }, [ready, dying, wait, p.uid, onGone])
  return ready ? <BuiltItem {...props} /> : null
}

function BuiltItem({ p, dying, links, onGone }: ItemProps) {
  const ref = useRef<THREE.Group>(null!)
  const flash = useRef<THREE.Mesh>(null!)
  const [merged, setMerged] = useState<THREE.Group | null>(null)
  const built = useRef(false)
  const item = ITEM_BY_ID[p.itemId]
  const { w, d } = footprint(p.itemId, p.rot)
  const it = useMemo(() => footprint(p.itemId, 0), [p.itemId])
  const flashMat = useMemo(() => new THREE.MeshBasicMaterial({ color: C.coral, transparent: true, opacity: 0, depthWrite: false }), [])
  useEffect(() => () => flashMat.dispose(), [flashMat])

  // Obra: cada peça entra na sua etapa; quando tudo termina, o item vira poucas malhas
  useLayoutEffect(() => {
    const parts = collectParts(ref.current)
    const maxStage = Math.max(0, ...parts.map((o) => o.userData.stage as number))
    const anims = parts.map((o) => buildIn(o, 120))
    // marcação do terreno: pisca a pegada em coral antes da obra começar
    anims.push(animate(flashMat, { opacity: [0, 0.55, 0], duration: 520 + maxStage * STEP, ease: 'outQuad' }))
    anims.push(animate(flash.current.scale, { x: [0.6 * w, w], y: [0.6 * d, d], duration: 380, ease: 'outBack' }))
    let alive = true
    Promise.all(anims.map((a) => new Promise((done) => a.then(done)))).then(() => {
      if (!alive) return
      built.current = true
      setMerged(mergeItem(ref.current))
    })
    return () => { alive = false; anims.forEach((a) => a.cancel()) }
  }, [p.uid, flashMat, w, d])
  useEffect(() => () => { if (merged) disposeMerged(merged) }, [merged])

  // Peça de ligação (caminho, cerca...) cujos vizinhos mudaram depois da obra: redesenha com os
  // novos braços e mescla de novo
  const firstLinks = useRef(true)
  useEffect(() => {
    if (firstLinks.current) { firstLinks.current = false; return }
    if (built.current) setMerged(null)
  }, [links])
  useLayoutEffect(() => {
    if (built.current && !merged) setMerged(mergeItem(ref.current))
  }, [merged])

  useEffect(() => {
    if (!dying) return
    const parts = merged ? [merged] : collectParts(ref.current).reverse()
    const anims = parts.map((o, i) =>
      animate(o.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 280, delay: i * 18, ease: 'inBack(2)' }))
    const t = setTimeout(() => onGone(p.uid), 300 + parts.length * 18)
    return () => { clearTimeout(t); anims.forEach((a) => a.cancel()) }
  }, [dying, merged, p.uid, onGone])

  // peças de ligação se orientam pelo modelo; as demais giram em quartos de volta
  return (
    <group position={toWorld(p.x, p.z, w, d)}>
      <group ref={ref} rotation-y={item.link ? 0 : p.rot * (Math.PI / 2)}>
        {merged ? <primitive object={merged} /> : <Model id={p.itemId} w={it.w} d={it.d} links={links} rot={p.rot} />}
      </group>
      <mesh ref={flash} visible={!merged} position-y={0.012} rotation-x={-Math.PI / 2} geometry={flashGeo} material={flashMat} />
    </group>
  )
}

// Seta curva desenhada uma vez: da ponta de trás da lateral até a frente, o lado que vem para perto
function arrowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.strokeStyle = g.fillStyle = '#fff'
  g.lineWidth = 13
  g.lineCap = 'round'
  const cx = 64, cy = 128, r = 98, a1 = 0.92
  g.beginPath()
  g.arc(cx, cy, r, -1.05, a1)
  g.stroke()
  const ex = cx + r * Math.cos(a1), ey = cy + r * Math.sin(a1)
  const tx = -Math.sin(a1), ty = Math.cos(a1) // tangente no fim do arco
  g.beginPath()
  g.moveTo(ex + tx * 36, ey + ty * 36)
  g.lineTo(ex - ty * 24, ey + tx * 24)
  g.lineTo(ex + ty * 24, ey - tx * 24)
  g.closePath()
  g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Realce da lateral sob o ponteiro: por cima de tudo, para não sumir atrás dos prédios
const sideMats = {
  strip: new THREE.MeshBasicMaterial({ color: C.coral, transparent: true, opacity: 0.2, depthTest: false, depthWrite: false }),
  arrow: new THREE.MeshBasicMaterial({ color: C.ink, map: arrowTexture(), transparent: true, depthTest: false, depthWrite: false }),
}
const BAND = 7 // células de cada lateral que giram o board

// Terreno: laje em meio-tom com o plano coral deslocado atrás dela. Sobe ao aparecer (menos com
// rise desligado). Com onTurn, um clique numa das laterais gira o board 90° (a lateral clicada vem
// para a frente)
export function Island({ light, onTurn, rise = true }: { light: boolean; onTurn?: (side: -1 | 1) => void; rise?: boolean }) {
  const group = useRef<THREE.Group>(null!)
  const sides = useRef<THREE.Group>(null)
  const [hover, setHover] = useState<-1 | 0 | 1>(0)
  useLayoutEffect(() => {
    if (!rise) return
    group.current.position.y = -5
    const a = animate(group.current.position, { y: 0, duration: 1400, ease: 'outExpo' })
    return () => { a.cancel() }
  }, [rise])
  useFrame(() => { if (sides.current) sides.current.rotation.y = cam.az })
  useEffect(() => {
    if (!hover) return
    document.body.style.cursor = 'pointer'
    return () => { document.body.style.cursor = '' }
  }, [hover])

  const events = onTurn && {
    onPointerMove: (e: ThreeEvent<PointerEvent>) => setHover(sideAt(e.point, BAND)),
    onPointerOut: () => setHover(0),
    onClick: (e: ThreeEvent<MouseEvent>) => {
      const s = sideAt(e.point, BAND)
      if (s) onTurn(s)
    },
  }

  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} {...events}>
        <planeGeometry args={[GRID, GRID]} />
        <meshBasicMaterial color={C.cream} />
      </mesh>
      <gridHelper args={[GRID, GRID, C.ink, C.ink]} position-y={0.004} material-transparent material-opacity={0.1} />
      <mesh position-y={-0.62} material={mat.slab}>
        <boxGeometry args={[GRID, 1.2, GRID]} />
        <Edges color={light ? C.ink : C.cream} />
      </mesh>
      <mesh position={[1.4, -1.1, 1.4]}>
        <boxGeometry args={[GRID, 1.2, GRID]} />
        <meshBasicMaterial color={C.coral} />
        <Edges color={C.ink} />
      </mesh>
      {onTurn && (
        <group ref={sides} position-y={0.03}>
          {([-1, 1] as const).map((s) => (
            <group key={s} position-x={s * (GRID / 2 - BAND / 2)} visible={hover === s}>
              <mesh rotation-x={-Math.PI / 2} material={sideMats.strip} renderOrder={10}>
                <planeGeometry args={[BAND, GRID]} />
              </mesh>
              <mesh rotation-x={-Math.PI / 2} scale={[s * 8, 8, 1]} geometry={flashGeo} material={sideMats.arrow} renderOrder={11} />
            </group>
          ))}
        </group>
      )}
    </group>
  )
}

// Tempo e densidade dos meios-tons. A resolução fica fixa: baixá-la quando a obra pesa (centenas de
// peças subindo de uma vez) deixava o mapa borrado depois de escolher a categoria, sem voltar.
export function Rig() {
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)
  const dpr = useThree((s) => s.viewport.dpr)
  useEffect(() => setHalftoneDpr(dpr), [dpr])
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __r3f: get, __store: useStore })
  }, [get])
  // Compila em segundo plano os shaders das peças (toon e tela) para a primeira obra não engasgar
  useEffect(() => {
    const { scene, camera } = get()
    const warm = new THREE.Group()
    const geo = new THREE.BoxGeometry()
    warm.add(new THREE.Mesh(geo, mat.cream), new THREE.Mesh(geo, mat.fence))
    warm.position.y = -5000 // longe da câmera: compila sem aparecer no quadro
    scene.add(warm)
    gl.compileAsync(scene, camera).finally(() => { scene.remove(warm); geo.dispose() })
  }, [gl, get])
  useFrame((_, dt) => { for (const m of halftones) m.uniforms.uTime.value += Math.min(dt, 0.1) })
  return null
}

export const DPR = Math.min(window.devicePixelRatio, 2) // nítido em telas de alta densidade, sem passar de 2

const purge = (uid: string) => useStore.getState().purge(uid)
const turn = (side: -1 | 1) => { view.turn += side }

function StoreItem({ p }: { p: Placed }) {
  const [delay] = useState(() => useStore.getState().delays[p.uid] ?? 0)
  const dying = useStore((s) => s.dying.has(p.uid))
  const link = !!ITEM_BY_ID[p.itemId].link
  const links = useStore((s) => (link ? linksOf(s.placed, s.dying, p) : ''))
  return <Item p={p} delay={delay} dying={dying} links={links} onGone={purge} />
}

// O mar aparece quando o destino é praia, na divisa de água do modelo de implantação
function StoreSea({ light }: { light: boolean }) {
  const side = useStore((s) => {
    const t = TEMPLATES[s.autoTemplate]
    return s.spec.destino === 'praia' && t.sea ? t.water : null
  })
  return side ? <Sea side={side} light={light} /> : null
}

export function Scene() {
  const placed = useStore((s) => s.placed)
  const light = useStore((s) => s.theme === 'light')
  // com o relatório, a galeria ou a explicação por cima, o mapa para de desenhar
  const covered = useStore((s) => s.explain || s.modal?.type === 'report' || s.modal?.type === 'models')

  return (
    <Canvas flat dpr={DPR} frameloop={covered ? 'never' : 'always'} camera={{ fov: 30, near: 1, far: 900 }} gl={{ antialias: true }}>
      <color attach="background" args={[light ? C.cream : C.ink]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 14, 3]} intensity={1.6} />
      <Island light={light} onTurn={turn} />
      <StoreSea light={light} />
      {placed.map((p) => <StoreItem key={p.uid} p={p} />)}
      <CameraRig />
      <Rig />
      <Thumbs />
      <FrontPhoto />
    </Canvas>
  )
}
