import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ITEM_BY_ID } from '../data/catalog'
import { C, mat } from '../three/materials'
import { Model } from '../three/models'
import { Edges } from '../three/parts'
import { DPR, Rig } from '../three/Scene'
import { PhotoOf } from '../three/Thumbs'
import { CameraRig, boardBounds, cam, resetView, view, type Inset } from '../three/view'
import { SHOW } from './example'
import { fall } from './motion'

// Os elementos do resort caindo do céu, sem o board: um grupo na abertura e um em cada etapa do
// negócio. A rolagem (GSAP, em fall.p) faz o grupo da vez cair e pousar enquanto o anterior segue
// caindo até sumir; voltar a rolagem desfaz, porque a posição é função do progresso. Cada peça vem
// sobre a sua placa do board, com o plano coral deslocado atrás.

type Piece = { id: string; x: number; z: number }
const GROUPS: Piece[][] = [
  // abertura: o resort em peças
  [{ id: 'lobby', x: -4.5, z: -2.5 }, { id: 'pool', x: 3.5, z: -1 }, { id: 'villa', x: -4, z: 4 }, { id: 'palm', x: 1, z: 4.5 }, { id: 'palm', x: 7, z: 3 }],
  // investimento: a obra pesa nos prédios de hospedagem
  [{ id: 'std', x: -4, z: -2 }, { id: 'suite', x: 4, z: 1 }, { id: 'family', x: -3.5, z: 4.5 }],
  // receita: a diária das UHs e o A&B
  [{ id: 'villa', x: -5, z: -1 }, { id: 'bungalow', x: 0, z: -3 }, { id: 'alacarte', x: 4, z: 2 }],
  // operação: os serviços que dão margem
  [{ id: 'buffet', x: -3.5, z: -2 }, { id: 'spa', x: 4, z: 1.5 }, { id: 'kids', x: -4, z: 4.5 }],
  // retorno: o lazer que vende o resort
  [{ id: 'infinity', x: -2, z: -2 }, { id: 'swimup', x: 4.5, z: 1 }, { id: 'poolbar', x: -4.5, z: 3.5 }, { id: 'palm', x: 1, z: 4 }, { id: 'palm', x: 7, z: -2 }],
]
const LAST = GROUPS.length - 1
const BOUNDS = { x0: -8.5, x1: 8.5, z0: -5.5, z1: 7 } // o que precisa caber no quadro
const SKY = 26      // de quanto acima as peças caem
const STAGGER = 0.1 // atraso entre as peças de um grupo, na janela de queda

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
// pouso com quique, como uma peça que cai e assenta
function bounce(t: number) {
  const n = 7.5625, d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
  return n * (t -= 2.625 / d) * t + 0.984375
}

const plateTop = new THREE.MeshBasicMaterial({ color: C.cream })
const plateBack = new THREE.MeshBasicMaterial({ color: C.coral })
const plateFaces = [mat.slab, mat.slab, plateTop, mat.slab, mat.slab, mat.slab]

function PieceView({ piece, g, j, n }: { piece: Piece; g: number; j: number; n: number }) {
  const ref = useRef<THREE.Group>(null!)
  const it = ITEM_BY_ID[piece.id]
  const plate = useMemo(() => new THREE.BoxGeometry(it.w + 0.8, 0.45, it.d + 0.8), [it])
  useEffect(() => () => plate.dispose(), [plate])
  const spin = j % 2 ? 1 : -1
  useFrame(() => {
    // entrada: o grupo da abertura cai no carregamento; os outros, com a rolagem
    const into = g === 0 ? fall.intro : clamp01((fall.p - (g - 0.75)) / 0.5)
    const away = g === LAST ? 0 : clamp01((fall.p - (g + 0.25)) / 0.5)
    const u = clamp01((into - j * STAGGER) / (1 - (n - 1) * STAGGER))
    const v = clamp01((away - j * STAGGER * 0.5) / (1 - (n - 1) * STAGGER * 0.5))
    const o = ref.current
    o.visible = u > 0 && v < 1
    if (!o.visible) return
    const e = bounce(u)
    o.position.y = SKY * (1 - e) - SKY * 1.3 * v * v
    o.rotation.y = (1 - e) * 1.3 * spin + v * v * 0.9 * spin
    o.rotation.x = (1 - e) * 0.25 * spin
  })
  return (
    <group ref={ref} position={[piece.x, 0, piece.z]} visible={false}>
      <mesh geometry={plate} material={plateFaces} position-y={-0.225}>
        <Edges color={C.cream} />
      </mesh>
      <mesh geometry={plate} material={plateBack} position={[0.35, -0.6, 0.35]}>
        <Edges color={C.ink} />
      </mesh>
      <Model id={piece.id} w={it.w} d={it.d} />
    </group>
  )
}

// Com movimento reduzido o canvas só desenha quando a etapa muda
function Redraw({ beat }: { beat: number }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => { invalidate() }, [beat, invalidate])
  return null
}

const STILL_ITEMS = SHOW.map((p) => ({ id: p.itemId, x: p.x, z: p.z, rot: p.rot }))

export default function Showcase({ beat, inset, paused, still, wantPhoto, onPhoto }: {
  beat: number; inset: Inset; paused: boolean; still: boolean; wantPhoto: boolean; onPhoto: (url: string) => void
}) {
  // enquadramento: a composição à direita do texto, vista em três quartos; o primeiro já nasce no lugar
  useLayoutEffect(() => {
    resetView(inset)
    view.turn = -0.4
    cam.az = view.turn * (Math.PI / 2)
    view.bounds = { ...BOUNDS }
    return () => { view.bounds = boardBounds() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    view.inset = { ...inset }
    if (still) Object.assign(cam, inset)
  }, [inset, still])

  return (
    <Canvas flat dpr={DPR} frameloop={still ? 'demand' : paused ? 'never' : 'always'} camera={{ fov: 30, near: 1, far: 900 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 14, 3]} intensity={1.6} />
      {GROUPS.map((group, g) => group.map((piece, j) => <PieceView key={`${g}-${j}`} piece={piece} g={g} j={j} n={group.length} />))}
      <CameraRig wheel={false} />
      <Rig />
      {still && <Redraw beat={beat} />}
      {wantPhoto && <PhotoOf items={STILL_ITEMS} onShot={onPhoto} />}
    </Canvas>
  )
}
