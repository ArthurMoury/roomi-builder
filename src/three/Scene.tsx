import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { animate, type JSAnimation } from 'animejs'
import { useStore, GRID, footprint, canPlace, linksOf } from '../store'
import { ITEM_BY_ID } from '../data/catalog'
import type { Placed } from '../lib/valuation'
import { Model } from './models'
import { mat, C, halftones, setHalftoneDpr } from './materials'
import { Edges, type Anim } from './parts'
import { mergeItem, disposeMerged } from './merge'
import { FrontPhoto, Thumbs } from './Thumbs'
import { Zones } from './Zones'

const STEP = 170 // ms entre etapas da obra
const DROP = 8   // metros que telhados e coberturas caem até encaixar

// Altura de repouso de cada peça que cai, guardada na primeira vez. Sem isso, rodar o efeito
// de novo (StrictMode, HMR) tomava a posição já levantada como chão e o telhado ficava voando.
const restY = new WeakMap<THREE.Object3D, number>()

// Centro da pegada em coordenadas de mundo
const toWorld = (x: number, z: number, w: number, d: number): [number, number, number] =>
  [x + w / 2 - GRID / 2, 0, z + d / 2 - GRID / 2]

const cellAt = (p: THREE.Vector3) => ({ x: Math.floor(p.x + GRID / 2), z: Math.floor(p.z + GRID / 2) })

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

type ItemProps = { p: Placed; hovered: boolean; onHover: (u: string | null) => void }
type Controls = { enabled: boolean } | null

// Demolir arrastando: com o botão apertado no modo Demolir, tudo que o ponteiro tocar vai abaixo
const eraser = { on: false }
function startErasing(controls: Controls) {
  eraser.on = true
  if (controls) controls.enabled = false
  document.body.style.cursor = 'crosshair'
  const up = () => {
    window.removeEventListener('pointerup', up)
    eraser.on = false
    if (controls) controls.enabled = true
    document.body.style.cursor = ''
  }
  window.addEventListener('pointerup', up)
}

// Na cascata do exemplo, cada item só é montado quando chega a vez dele: o custo de criar
// centenas de peças se espalha pela animação em vez de travar a página num quadro só.
function PlacedItem(props: ItemProps) {
  const { uid } = props.p
  const [delay] = useState(() => useStore.getState().delays[uid] ?? 0)
  const [ready, setReady] = useState(delay === 0)
  const dying = useStore((s) => s.dying.has(uid))
  useEffect(() => {
    if (ready) return
    if (dying) { useStore.getState().purge(uid); return }
    const t = setTimeout(() => setReady(true), delay)
    return () => clearTimeout(t)
  }, [ready, dying, delay, uid])
  return ready ? <BuiltItem {...props} /> : null
}

function BuiltItem({ p, hovered, onHover }: ItemProps) {
  const outer = useRef<THREE.Group>(null!)
  const ref = useRef<THREE.Group>(null!)
  const flash = useRef<THREE.Mesh>(null!)
  const [merged, setMerged] = useState<THREE.Group | null>(null)
  const built = useRef(false)
  const item = ITEM_BY_ID[p.itemId]
  const dying = useStore((s) => s.dying.has(p.uid))
  const selected = useStore((s) => s.selected === p.uid)
  const tool = useStore((s) => s.tool)
  const drag = useStore((s) => (s.drag?.uid === p.uid ? s.drag : null))
  const links = useStore((s) => (item.link ? linksOf(s.placed, s.dying, p) : ''))
  const controls = useThree((s) => s.controls) as unknown as Controls
  const { w, d } = footprint(p.itemId, p.rot)
  const it = useMemo(() => footprint(p.itemId, 0), [p.itemId])
  const flashMat = useMemo(() => new THREE.MeshBasicMaterial({ color: C.coral, transparent: true, opacity: 0, depthWrite: false }), [])

  // Posição alvo: a célula do arraste (erguido) ou a do próprio item. O grupo desliza até ela.
  const lifted = !!drag && (drag.x !== p.x || drag.z !== p.z)
  const [tx, , tz] = toWorld(drag ? drag.x : p.x, drag ? drag.z : p.z, w, d)
  const target = useRef(new THREE.Vector3())
  target.current.set(tx, lifted ? 0.5 : 0, tz)
  useLayoutEffect(() => { outer.current.position.copy(target.current) }, [])
  useFrame((_, dt) => {
    const o = outer.current
    if (o.position.distanceToSquared(target.current) > 1e-6) o.position.lerp(target.current, 1 - Math.exp(-dt * 16))
  })
  // Giro (R): peças de ligação se orientam pelo modelo; as demais giram o grupo em quartos de volta
  useTurn(ref, item.link ? 0 : p.rot * (Math.PI / 2))

  // Obra: cada peça entra na sua etapa; quando tudo termina, o item vira poucas malhas
  useLayoutEffect(() => {
    const parts = collectParts(ref.current)
    const maxStage = Math.max(0, ...parts.map((o) => o.userData.stage as number))
    const anims = parts.map((o) => buildIn(o, 120))
    // marcação do terreno: pisca a pegada em coral antes da obra começar
    anims.push(animate(flashMat, { opacity: [0, 0.55, 0], duration: 520 + maxStage * STEP, ease: 'outQuad' }))
    anims.push(animate(flash.current.scale, { x: [0.6, 1], z: [0.6, 1], duration: 380, ease: 'outBack' }))
    let alive = true
    Promise.all(anims.map((a) => new Promise((done) => a.then(done)))).then(() => {
      if (!alive) return
      built.current = true
      setMerged(mergeItem(ref.current))
    })
    return () => { alive = false; anims.forEach((a) => a.cancel()) }
  }, [p.uid, flashMat])
  useEffect(() => () => { if (merged) disposeMerged(merged) }, [merged])

  // Peça de ligação cujos vizinhos (ou o giro do trecho isolado) mudaram depois da obra:
  // redesenha com os novos braços e mescla de novo
  const shape = item.link ? `${links}|${p.rot}` : ''
  const firstShape = useRef(true)
  useEffect(() => {
    if (firstShape.current) { firstShape.current = false; return }
    if (built.current) setMerged(null)
  }, [shape])
  useLayoutEffect(() => {
    if (built.current && !merged) setMerged(mergeItem(ref.current))
  }, [merged])

  useEffect(() => {
    if (!dying) return
    const parts = merged ? [merged] : collectParts(ref.current).reverse()
    const anims = parts.map((o, i) =>
      animate(o.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 280, delay: i * 18, ease: 'inBack(2)' }))
    const t = setTimeout(() => useStore.getState().purge(p.uid), 300 + parts.length * 18)
    return () => { clearTimeout(t); anims.forEach((a) => a.cancel()) }
  }, [dying, merged, p.uid])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 5 || dying) return
    e.stopPropagation()
    const s = useStore.getState()
    if (s.tool.type === 'select') s.select(p.uid)
  }

  // Selecionar: agarrar e arrastar move o item. Demolir: o clique demole e, segurando, o arraste
  // continua demolindo o que o ponteiro tocar.
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    const s = useStore.getState()
    if (e.button !== 0 || dying) return
    if (s.tool.type === 'demolish') {
      e.stopPropagation()
      s.demolish(p.uid)
      startErasing(controls)
      return
    }
    if (s.tool.type !== 'select') return
    e.stopPropagation()
    const c = cellAt(e.point)
    s.startDrag(p.uid, p.x - c.x, p.z - c.z)
    if (controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
    const up = () => {
      window.removeEventListener('pointerup', up)
      if (controls) controls.enabled = true
      document.body.style.cursor = ''
      useStore.getState().endDrag()
    }
    window.addEventListener('pointerup', up)
  }

  const interactive = tool.type === 'select' || tool.type === 'demolish'
  const frameColor = drag ? (drag.ok ? C.coral : C.ink) : tool.type === 'demolish' ? C.ink : C.coral
  return (
    <group ref={outer}>
      <group
        ref={ref}
        onClick={interactive ? onClick : undefined}
        onPointerDown={interactive ? onPointerDown : undefined}
        onPointerOver={interactive ? (e) => {
          e.stopPropagation()
          if (eraser.on) { if (!dying) useStore.getState().demolish(p.uid); return }
          onHover(p.uid)
          if (!useStore.getState().drag) document.body.style.cursor = tool.type === 'select' ? 'grab' : 'pointer'
        } : undefined}
        onPointerOut={interactive ? () => {
          onHover(null)
          if (!useStore.getState().drag) document.body.style.cursor = ''
        } : undefined}
      >
        {merged ? <primitive object={merged} /> : <Model id={p.itemId} w={it.w} d={it.d} links={links} rot={p.rot} />}
      </group>
      <mesh ref={flash} visible={!merged} position-y={0.012} rotation-x={-Math.PI / 2} material={flashMat}>
        <planeGeometry args={[w, d]} />
      </mesh>
      {(selected || drag || (hovered && !dying)) && <Frame w={w} d={d} color={frameColor} />}
    </group>
  )
}

// Moldura fina que flutua sobre a pegada (seleção, arraste, mira de demolição)
function Frame({ w, d, color }: { w: number; d: number; color: string }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => { ref.current.position.y = 0.05 + Math.sin(clock.elapsedTime * 4) * 0.03 })
  return (
    <group ref={ref}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} />
        <Edges color={color} />
      </mesh>
    </group>
  )
}

// Gira um grupo suavemente até o ângulo alvo, sempre pelo caminho mais curto (270° → 0° anda +90°).
// Um grupo recém-montado já nasce no ângulo certo, sem girar.
function useTurn(ref: { current: THREE.Object3D | null }, angle: number) {
  const target = useRef(angle)
  const seen = useRef<THREE.Object3D | null>(null)
  target.current = angle
  useFrame((_, dt) => {
    const o = ref.current
    if (!o) return
    if (o !== seen.current) { seen.current = o; o.rotation.y = target.current; return }
    const diff = Math.atan2(Math.sin(target.current - o.rotation.y), Math.cos(target.current - o.rotation.y))
    if (Math.abs(diff) > 1e-4) o.rotation.y += diff * (1 - Math.exp(-dt * 14))
  })
}

// Prévia do item no ponteiro: o próprio modelo em "holograma" coral (lugar livre) ou preto (ocupado),
// já virado para o lado escolhido com R
const holoMats = {
  ok: new THREE.MeshBasicMaterial({ color: C.coral, transparent: true, opacity: 0.5 }),
  bad: new THREE.MeshBasicMaterial({ color: C.ink, transparent: true, opacity: 0.4 }),
}
const holoLines = { ok: new THREE.LineBasicMaterial({ color: C.coral }), bad: new THREE.LineBasicMaterial({ color: C.ink }) }

function Ghost({ cell }: { cell: { x: number; z: number } | null }) {
  const tool = useStore((s) => s.tool)
  const placed = useStore((s) => s.placed)
  const dying = useStore((s) => s.dying)
  const bob = useRef<THREE.Group>(null)
  const holo = useRef<THREE.Group>(null)
  const placing = tool.type === 'place' ? tool : null
  const item = placing ? ITEM_BY_ID[placing.itemId] : null
  // o modelo só é recriado quando muda o item ou o giro; mover o ponteiro só desloca o grupo
  const model = useMemo(
    () => (placing && item ? <Model id={placing.itemId} w={item.w} d={item.d} rot={placing.rot} /> : null),
    [placing?.itemId, placing?.rot], // eslint-disable-line react-hooks/exhaustive-deps
  )
  useTurn(holo, placing && !item?.link ? placing.rot * (Math.PI / 2) : 0)
  useFrame(({ clock }) => { if (bob.current) bob.current.position.y = 0.3 + Math.sin(clock.elapsedTime * 5) * 0.05 })

  const fp = placing ? footprint(placing.itemId, placing.rot) : { w: 1, d: 1 }
  const x = cell ? Math.min(Math.max(cell.x - Math.floor((fp.w - 1) / 2), 0), GRID - fp.w) : 0
  const z = cell ? Math.min(Math.max(cell.z - Math.floor((fp.d - 1) / 2), 0), GRID - fp.d) : 0
  const ok = !!placing && canPlace(placed, dying, placing.itemId, x, z, placing.rot)
  useLayoutEffect(() => {
    holo.current?.traverse((o) => {
      if ((o as THREE.LineSegments).isLineSegments) (o as THREE.LineSegments).material = ok ? holoLines.ok : holoLines.bad
      else if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = ok ? holoMats.ok : holoMats.bad
    })
  })

  if (!placing || !cell) return null
  return (
    <group position={toWorld(x, z, fp.w, fp.d)}>
      <mesh position-y={0.01} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[fp.w, fp.d]} />
        <meshBasicMaterial color={ok ? C.coral : C.ink} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <group ref={bob}>
        <group ref={holo}>{model}</group>
      </group>
    </group>
  )
}

type Cell = { x: number; z: number }

// Células entre duas posições do ponteiro (sem a primeira): anda em x e depois em z, para que
// caminhos e cercas pintados com arrasto rápido continuem ligados lado a lado
function cellsBetween(a: Cell, b: Cell) {
  const out: Cell[] = []
  let { x, z } = a
  while (x !== b.x) { x += Math.sign(b.x - x); out.push({ x, z }) }
  while (z !== b.z) { z += Math.sign(b.z - z); out.push({ x, z }) }
  return out
}

// Posiciona o item escolhido no catálogo centrado na célula
function placeAt(c: Cell) {
  const s = useStore.getState()
  if (s.tool.type !== 'place') return
  const { w, d } = footprint(s.tool.itemId, s.tool.rot)
  s.place(s.tool.itemId,
    Math.min(Math.max(c.x - Math.floor((w - 1) / 2), 0), GRID - w),
    Math.min(Math.max(c.z - Math.floor((d - 1) / 2), 0), GRID - d), s.tool.rot)
}

function Island({ onCell, light }: { onCell: (c: Cell | null) => void; light: boolean }) {
  const group = useRef<THREE.Group>(null!)
  const painting = useRef<Cell | null>(null)
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null
  useLayoutEffect(() => {
    group.current.position.y = -5
    const a = animate(group.current.position, { y: 0, duration: 1400, ease: 'outExpo' })
    return () => { a.cancel() }
  }, [])

  // Itens pintáveis (caminhos, cercas, árvores...): segurar e arrastar preenche o trajeto.
  // No modo Demolir, segurar sobre o terreno começa a demolir o que o ponteiro tocar.
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    const s = useStore.getState()
    if (e.button === 0 && s.tool.type === 'demolish') { startErasing(controls); return }
    if (e.button !== 0 || s.tool.type !== 'place' || !ITEM_BY_ID[s.tool.itemId].paint) return
    e.stopPropagation()
    painting.current = cellAt(e.point)
    placeAt(painting.current)
    if (controls) controls.enabled = false
    const up = () => {
      window.removeEventListener('pointerup', up)
      painting.current = null
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const c = cellAt(e.point)
    onCell(c)
    const s = useStore.getState()
    if (s.drag) s.dragTo(c.x, c.z)
    const from = painting.current
    if (from && (from.x !== c.x || from.z !== c.z)) {
      cellsBetween(from, c).forEach(placeAt)
      painting.current = c
    }
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 5) return
    const s = useStore.getState()
    if (s.tool.type === 'select') s.select(null)
    else if (s.tool.type === 'place' && !ITEM_BY_ID[s.tool.itemId].paint) placeAt(cellAt(e.point))
  }

  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} onPointerDown={onDown} onPointerMove={onMove} onPointerOut={() => onCell(null)} onClick={onClick}>
        <planeGeometry args={[GRID, GRID]} />
        <meshBasicMaterial color={C.cream} />
      </mesh>
      <gridHelper args={[GRID, GRID, C.ink, C.ink]} position-y={0.004} material-transparent material-opacity={0.1} />
      {/* laje em meio-tom e o plano coral deslocado atrás dela */}
      <mesh position-y={-0.62} material={mat.slab}>
        <boxGeometry args={[GRID, 1.2, GRID]} />
        <Edges color={light ? C.ink : C.cream} />
      </mesh>
      <mesh position={[1.4, -1.1, 1.4]}>
        <boxGeometry args={[GRID, 1.2, GRID]} />
        <meshBasicMaterial color={C.coral} />
        <Edges color={C.ink} />
      </mesh>
    </group>
  )
}

function Rig() {
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)
  const dpr = useThree((s) => s.viewport.dpr)
  useEffect(() => setHalftoneDpr(dpr), [dpr])
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __r3f: get, __store: useStore })
  }, [gl, get])
  // Compila em segundo plano os shaders das peças (toon e tela) para a primeira obra não engasgar
  useEffect(() => {
    const { scene, camera } = get()
    const warm = new THREE.Group()
    const geo = new THREE.BoxGeometry()
    warm.add(new THREE.Mesh(geo, mat.cream), new THREE.Mesh(geo, mat.fence))
    warm.position.y = -50
    scene.add(warm)
    gl.compileAsync(scene, camera).finally(() => { scene.remove(warm); geo.dispose() })
  }, [gl, get])
  useFrame((_, dt) => { for (const m of halftones) m.uniforms.uTime.value += dt })
  return null
}

const MAX_DPR = Math.min(window.devicePixelRatio, 2)

export function Scene() {
  const placed = useStore((s) => s.placed)
  const light = useStore((s) => s.theme === 'light')
  const [cell, setCell] = useState<{ x: number; z: number } | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  // Resolução adaptativa: em máquina fraca o canvas perde densidade em vez de travar a animação
  const [dpr, setDpr] = useState(MAX_DPR)

  return (
    <Canvas flat dpr={dpr} camera={{ position: [50, 48, 50], fov: 30, near: 1, far: 600 }} gl={{ antialias: true }}>
      <PerformanceMonitor
        onDecline={() => setDpr((v) => Math.max(0.6, +(v - 0.2).toFixed(2)))}
        onIncline={() => setDpr((v) => Math.min(MAX_DPR, +(v + 0.2).toFixed(2)))}
      />
      <color attach="background" args={[light ? C.cream : C.ink]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 14, 3]} intensity={1.6} />
      <Island onCell={setCell} light={light} />
      <Zones />
      {placed.map((p) => <PlacedItem key={p.uid} p={p} hovered={hover === p.uid} onHover={setHover} />)}
      <Ghost cell={cell} />
      <OrbitControls
        makeDefault enableDamping maxPolarAngle={1.2} minPolarAngle={0.25} minDistance={8} maxDistance={140}
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      />
      <Rig />
      <Thumbs />
      <FrontPhoto />
    </Canvas>
  )
}
