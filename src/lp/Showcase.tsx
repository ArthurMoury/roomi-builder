import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ITEM_BY_ID } from '../data/catalog'
import { C, halftone, mat } from '../three/materials'
import { Model } from '../three/models'
import { Edges } from '../three/parts'
import { disposeMerged, mergeItem } from '../three/merge'
import { DPR, Rig } from '../three/Scene'
import { PhotoOf } from '../three/Thumbs'
import { CameraRig, POLAR, boardBounds, cam, resetView, view, type Inset } from '../three/view'
import { SHOW } from './example'
import { fall } from './motion'

// O 3D da LP. Na abertura, o livro da Roomi gira e folheia sozinho; em cada passo do fluxo, um grupo
// de elementos do resort cai do céu, sem o board. A rolagem (GSAP, em fall.p) faz o livro descer até
// sumir, e o grupo do passo descer e pousar enquanto o anterior segue descendo; voltar a rolagem
// desfaz, porque a posição é função do progresso. A troca é macia: as janelas de saída e de entrada só
// se encostam, sem quique e quase sem giro. Cada peça vem sobre a sua placa do board, com o plano coral
// deslocado atrás, e vira poucas malhas ao montar.

type Piece = { id: string; x: number; z: number }
// o grupo g (1 a 4) pousa no passo g; a abertura (g = 0) é do livro
const GROUPS: Piece[][] = [
  // critérios: o que o resort precisa ser (hospedagem para o público)
  [
    { id: 'std', x: -4.5, z: -3.5 }, { id: 'suite', x: 3.5, z: -3.5 }, { id: 'family', x: -5, z: 2.5 }, { id: 'chalet', x: -0.5, z: 2 },
    { id: 'chalet', x: 3, z: 2 }, { id: 'chalet', x: 6.5, z: 2.5 }, { id: 'tree', x: -0.5, z: -1 }, { id: 'tree', x: 1, z: 5 }, { id: 'tree', x: -2, z: 5.5 },
  ],
  // restrições: o escopo, o lazer que entra ou sai
  [
    { id: 'tennis', x: -4, z: -3 }, { id: 'kids', x: 4.5, z: -3.5 }, { id: 'playground', x: 4.5, z: 2.5 }, { id: 'gym', x: -5.5, z: 2.5 },
    { id: 'lounge', x: -1, z: 2.5 }, { id: 'palm', x: 8, z: -0.5 }, { id: 'palm', x: -3, z: 5.6 }, { id: 'tree', x: 1.5, z: 5.6 },
  ],
  // cálculos: a operação que gera receita e margem
  [
    { id: 'buffet', x: -4.5, z: -3 }, { id: 'spa', x: 4, z: -3 }, { id: 'alacarte', x: -5, z: 3 }, { id: 'poolbar', x: -0.5, z: 2.5 },
    { id: 'kiosk', x: 3, z: 2 }, { id: 'fountain', x: 6, z: 3 }, { id: 'sunbeds', x: 2.5, z: 4.5 }, { id: 'sunbeds', x: 3.8, z: 4.5 },
  ],
  // relatório: o resort pronto, o que ele vende
  [
    { id: 'infinity', x: -4, z: -3.5 }, { id: 'swimup', x: 2.5, z: -3.5 }, { id: 'villa', x: -5.5, z: 2.5 }, { id: 'bungalow', x: -1.5, z: 2 },
    { id: 'pergola', x: 2, z: 2 }, { id: 'villa', x: 6, z: 0 }, { id: 'palm', x: 7.5, z: -4 }, { id: 'palm', x: 1, z: 5 }, { id: 'palm', x: 5, z: 4.5 },
  ],
]
const LAST = GROUPS.length
const TURN = -0.4 // a composição vista em três quartos (quartos de volta da câmera)
const BOUNDS = { x0: -8.2, x1: 9, z0: -5.6, z1: 6.6 } // o que precisa caber no quadro
const SKY = 16    // de quanto acima as peças descem
const DEPTH = 16  // quanto as que saem descem até sumir
// janelas da troca, em unidades de p: o grupo g entra em [g − 0,6, g − 0,25] e sai em [g + 0,25, g + 0,6];
// a saída de um e a entrada do próximo se encostam em p = g + 0,5, onde o texto da etapa muda
const IN_FROM = 0.6, IN_TO = 0.25, OUT_FROM = 0.25, OUT_TO = 0.6
// cascata dentro do grupo: as peças entram espalhadas em 45% da janela e saem em 30%
const IN_SPREAD = 0.45, OUT_SPREAD = 0.3

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10) // sai e chega devagar
const easeIn = (t: number) => t * t * t                             // sai devagar, vai embora rápido

// O livro da Roomi (cofre: design › Formas geométricas da marca, "Livro que gira sozinho"): 12 folhas
// presas na lombada numa onda contínua de folheio, sempre várias no ar, e o livro inteiro girando
// sozinho, uma volta a cada 20 s, visto um pouco de cima. Cada folha tem frente e verso; depois de
// virar, aparece o verso. Planos chapados, contorno fino e meio-tom no tema escuro (ponto creme e
// contorno creme a 55%). Ao carregar, as folhas saem fechadas e abrem em leque, uma depois da outra.
type Face = 'claro' | 'escuro' | 'coral' | 'meio'
const FOLHAS: [Face, Face][] = [
  ['claro', 'escuro'], ['coral', 'claro'], ['meio', 'escuro'], ['claro', 'coral'],
  ['escuro', 'claro'], ['claro', 'meio'], ['coral', 'escuro'], ['claro', 'escuro'],
  ['escuro', 'coral'], ['meio', 'claro'], ['claro', 'coral'], ['coral', 'meio'],
]
const N = FOLHAS.length
const DEG = Math.PI / 180
const BOOK_H = 14, BOOK_W = (BOOK_H * 500) / 960 // a proporção da folha na arte
const BOOK_AT: [number, number, number] = [0.4, 1.6, 0.5] // no meio do quadro dos elementos
// a câmera da LP olha de 41° acima; o livro reclina para ela ficar só 0,28 rad acima dele, como na arte
const BOOK_TILT = POLAR + 0.28 - Math.PI / 2
const leafGeo = new THREE.PlaneGeometry(BOOK_W, BOOK_H).translate(BOOK_W / 2, 0, 0) // lombada em x = 0
const leafEdges = new THREE.EdgesGeometry(leafGeo)
const leafLine = new THREE.LineBasicMaterial({ color: '#928D8B' }) // creme a 55% sobre o escuro
// as faces recuam um tico na profundidade para o contorno ficar sempre por cima delas
const nudge = <M extends THREE.Material>(m: M, side: THREE.Side) => Object.assign(m, { side, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
const faces = (side: THREE.Side): Record<Face, THREE.Material> => ({
  claro: nudge(new THREE.MeshBasicMaterial({ color: C.cream }), side),
  escuro: nudge(new THREE.MeshBasicMaterial({ color: C.ink }), side),
  coral: nudge(new THREE.MeshBasicMaterial({ color: C.coral }), side),
  meio: nudge(halftone(C.ink, C.cream, 11, 3.4, [6, 0]), side),
})
const FRONT = faces(THREE.FrontSide), BACK = faces(THREE.BackSide)
const ahead = new THREE.Vector3(), up = new THREE.Vector3(), gap = new THREE.Vector3()

function Book({ still }: { still: boolean }) {
  const root = useRef<THREE.Group>(null!)
  const spin = useRef<THREE.Group>(null!)
  const leaves = useRef<THREE.Group[]>([])
  // com movimento reduzido o canvas só desenha quando pedem: a rolagem pede, para o livro sair da frente
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (!still) return
    const on = () => invalidate()
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [still, invalidate])
  useFrame(({ clock, camera, size }) => {
    const o = root.current
    o.position.set(...BOOK_AT)
    if (size.width < 960) {
      // no celular o livro fica em cima do texto: sobe com a página, um pouco mais rápido que ela, e
      // nunca passa por trás das letras
      const lift = scrollY * 1.2 // px de tela
      o.visible = lift < size.height
      if (!o.visible) return
      const cam = camera as THREE.PerspectiveCamera
      const perPx = (2 * gap.copy(o.position).sub(cam.position).dot(cam.getWorldDirection(ahead)) * Math.tan((cam.fov * DEG) / 2)) / size.height
      o.position.addScaledVector(up.set(0, 1, 0).applyQuaternion(cam.quaternion), lift * perPx)
    } else {
      // no desktop, ao lado do texto, desce até sair da tela na janela de saída da abertura (p de 0,25 a 0,6)
      const away = clamp01((fall.p - OUT_FROM) / (OUT_TO - OUT_FROM))
      o.visible = away < 1
      if (!o.visible) return
      o.position.y -= (camera.position.length() * 0.75 + BOOK_H) * easeIn(away) // a altura da tela, em qualquer formato
    }
    const t = still ? 0 : clock.elapsedTime
    spin.current.rotation.y = -((t * 2 * Math.PI) / 20 + 0.35)
    const open = still ? 1 : clamp01((t - 0.15) / 1.8)
    const fase = (t * 2 * Math.PI) / 6.5
    leaves.current.forEach((leaf, i) => {
      // onda de folheio: cada folha vai e volta entre as capas, defasada da vizinha
      const wave = -90 + 80 * Math.cos(fase - (i * 1.4 * Math.PI) / (N - 1))
      const shut = -10 - (N - 1 - i) * 0.8 // fechadas à direita, a primeira por cima
      const u = smoother(clamp01((open - (i / (N - 1)) * 0.45) / 0.55))
      leaf.rotation.y = (shut + (wave - shut) * u) * DEG
    })
  })
  return (
    <group ref={root} position={BOOK_AT} rotation={[BOOK_TILT, TURN * (Math.PI / 2), 0, 'YXZ']}>
      <group ref={spin}>
        {FOLHAS.map(([front, back], i) => (
          <group key={i} ref={(el) => { if (el) leaves.current[i] = el }}>
            <mesh geometry={leafGeo} material={FRONT[front]} />
            <mesh geometry={leafGeo} material={BACK[back]} />
            <lineSegments geometry={leafEdges} material={leafLine} raycast={() => null} />
          </group>
        ))}
      </group>
    </group>
  )
}

const plateTop = new THREE.MeshBasicMaterial({ color: C.cream })
const plateBack = new THREE.MeshBasicMaterial({ color: C.coral })
const plateFaces = [mat.slab, mat.slab, plateTop, mat.slab, mat.slab, mat.slab]

function PieceView({ piece, g, j, n }: { piece: Piece; g: number; j: number; n: number }) {
  const ref = useRef<THREE.Group>(null!)
  const model = useRef<THREE.Group>(null!)
  const [merged, setMerged] = useState<THREE.Group | null>(null)
  const it = ITEM_BY_ID[piece.id]
  const plate = useMemo(() => new THREE.BoxGeometry(it.w + 0.8, 0.45, it.d + 0.8), [it])
  useEffect(() => () => plate.dispose(), [plate])
  // as dezenas de peças do modelo viram poucas malhas, uma por material
  useLayoutEffect(() => {
    const m = mergeItem(model.current)
    setMerged(m)
    return () => { disposeMerged(m); setMerged(null) }
  }, [])
  const spin = j % 2 ? 1 : -1
  const lag = n > 1 ? j / (n - 1) : 0
  useFrame(() => {
    const into = clamp01((fall.p - (g - IN_FROM)) / (IN_FROM - IN_TO))
    const away = g === LAST ? 0 : clamp01((fall.p - (g + OUT_FROM)) / (OUT_TO - OUT_FROM))
    const u = clamp01((into - lag * IN_SPREAD) / (1 - IN_SPREAD))
    const v = clamp01((away - lag * OUT_SPREAD) / (1 - OUT_SPREAD))
    const o = ref.current
    o.visible = u > 0 && v < 1
    if (!o.visible) return
    const e = smoother(u), f = easeIn(v)
    o.position.y = SKY * (1 - e) - DEPTH * f
    o.rotation.y = ((1 - e) * 0.4 + f * 0.25) * spin
    o.rotation.x = (1 - e) * 0.1 * spin
  })
  return (
    <group ref={ref} position={[piece.x, 0, piece.z]} visible={false}>
      <mesh geometry={plate} material={plateFaces} position-y={-0.225}>
        <Edges color={C.cream} />
      </mesh>
      <mesh geometry={plate} material={plateBack} position={[0.35, -0.6, 0.35]}>
        <Edges color={C.ink} />
      </mesh>
      <group ref={model}>{merged ? <primitive object={merged} /> : <Model id={piece.id} w={it.w} d={it.d} />}</group>
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
    view.turn = TURN
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
      <Book still={still} />
      {GROUPS.map((group, i) => group.map((piece, j) => <PieceView key={`${i}-${j}`} piece={piece} g={i + 1} j={j} n={group.length} />))}
      <CameraRig wheel={false} />
      <Rig />
      {still && <Redraw beat={beat} />}
      {wantPhoto && <PhotoOf items={STILL_ITEMS} onShot={onPhoto} />}
    </Canvas>
  )
}
