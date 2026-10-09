import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mat, C, type MatKey } from './materials'

// Todas as medidas daqui são em metros: o Model escala o conjunto para células (1 célula = 5 m).

// Geometrias unitárias compartilhadas por todas as peças (escaladas por instância). Com centenas de
// peças em cena, criar uma geometria e um contorno por peça travava a página ao carregar o exemplo.
const shared = new WeakSet<THREE.BufferGeometry>()
const share = <T extends THREE.BufferGeometry>(g: T) => (shared.add(g), g)

const unitBox = share(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0))       // pivô na base
const unitPlane = share(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0))
const unitIco = share(new THREE.IcosahedronGeometry(1, 0))
const unitSphere = share(new THREE.SphereGeometry(1, 12, 8))
const hipGeo = share(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0))
const gableGeo = share(new THREE.ExtrudeGeometry(
  new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]),
  { depth: 1, bevelEnabled: false },
).translate(0, 0, -0.5))

// Cilindro de raio 1 e altura 1 com pivô na base; `ratio` = raio do topo / raio da base
const cyls = new Map<string, THREE.CylinderGeometry>()
export function cylGeo(ratio: number, seg: number) {
  const key = `${ratio.toFixed(3)}/${seg}`
  if (!cyls.has(key)) cyls.set(key, share(new THREE.CylinderGeometry(ratio, 1, 1, seg).translate(0, 0.5, 0)))
  return cyls.get(key)!
}

// Contorno fino de 1px (gramática Roomi): EdgesGeometry + LineBasicMaterial compartilhado por cor.
// Para geometria compartilhada o contorno também é calculado uma vez só.
const lineMats = new Map<string, THREE.LineBasicMaterial>()
const lineMat = (color: string) => {
  if (!lineMats.has(color)) lineMats.set(color, new THREE.LineBasicMaterial({ color }))
  return lineMats.get(color)!
}
const sharedEdges = new WeakMap<THREE.BufferGeometry, Map<number, THREE.EdgesGeometry>>()

export function Edges({ color = C.ink, threshold = 20 }: { color?: string; threshold?: number }) {
  const ref = useRef<THREE.LineSegments>(null!)
  useLayoutEffect(() => {
    const lines = ref.current
    const geo = (lines.parent as THREE.Mesh).geometry
    if (shared.has(geo)) {
      if (!sharedEdges.has(geo)) sharedEdges.set(geo, new Map())
      const byThreshold = sharedEdges.get(geo)!
      if (!byThreshold.has(threshold)) byThreshold.set(threshold, new THREE.EdgesGeometry(geo, threshold))
      lines.geometry = byThreshold.get(threshold)!
      return
    }
    lines.geometry = new THREE.EdgesGeometry(geo, threshold)
    return () => lines.geometry.dispose()
  }, [threshold])
  return <lineSegments ref={ref} material={lineMat(color)} raycast={() => null} />
}

// Geometria própria de uma instância (tubos, anéis), descartada junto com ela
function useGeo<T extends THREE.BufferGeometry>(make: () => T, key: string) {
  const g = useMemo(make, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => g.dispose(), [g])
  return g
}

// Cada peça é um grupo com pivô na base. `stage` define a ordem na obra e `anim` como ela entra:
// grow (sobe do chão), spread (abre no plano), pop (escala inteira), fill (água enche), drop (cai do alto).
export type Anim = 'grow' | 'spread' | 'pop' | 'fill' | 'drop'
export type V3 = [number, number, number]

interface PartProps { p?: V3; ry?: number; stage?: number; anim?: Anim; children: ReactNode }

export function Part({ p = [0, 0, 0], ry = 0, stage = 0, anim = 'grow', children }: PartProps) {
  return <group position={p} rotation-y={ry} userData={{ stage, anim }}>{children}</group>
}

const DARK = new Set<MatKey>(['ink', 'asphalt', 'slab', 'glass'])
export const edgeColor = (m: MatKey) => (DARK.has(m) ? '#55554f' : C.ink)

interface Common { p?: V3; ry?: number; m?: MatKey; stage?: number; anim?: Anim; edges?: boolean }

export function Box({ s, ...c }: Common & { s: V3 }) {
  const m = c.m ?? 'cream'
  return (
    <Part p={c.p} ry={c.ry} stage={c.stage} anim={c.anim}>
      <mesh geometry={unitBox} scale={s} material={mat[m]}>
        {c.edges !== false && <Edges color={edgeColor(m)} />}
      </mesh>
    </Part>
  )
}

export function Cyl({ r, h, rt, seg = 24, ...c }: Common & { r: number; h: number; rt?: number; seg?: number }) {
  const m = c.m ?? 'cream'
  return (
    <Part p={c.p} ry={c.ry} stage={c.stage} anim={c.anim}>
      <mesh geometry={cylGeo((rt ?? r) / r, seg)} scale={[r, h, r]} material={mat[m]}>
        {c.edges !== false && <Edges color={edgeColor(m)} threshold={30} />}
      </mesh>
    </Part>
  )
}

// Disco elíptico (lago, praia): cilindro achatado com raios rx e rz
export function Disc({ p, rx, rz, h, m, stage = 1, anim = 'spread' }: { p: V3; rx: number; rz: number; h: number; m: MatKey; stage?: number; anim?: Anim }) {
  return (
    <Part p={p} stage={stage} anim={anim}>
      <mesh geometry={cylGeo(1, 48)} scale={[rx, h, rz]} material={mat[m]}><Edges threshold={30} /></mesh>
    </Part>
  )
}

// Pedra, arbusto, horta: icosaedro facetado apoiado no chão
export function Ico({ p, r, m = 'cream', stage = 3 }: { p: V3; r: number; m?: MatKey; stage?: number }) {
  return (
    <Part p={p} stage={stage} anim="pop">
      <mesh geometry={unitIco} position-y={r * 0.7} scale={r} material={mat[m]}><Edges /></mesh>
    </Part>
  )
}

// Casco de barco: esfera alongada, meio submersa
export function Hull({ p, m, stage }: { p: V3; m: MatKey; stage: number }) {
  return (
    <Part p={p} stage={stage} anim="pop">
      <mesh geometry={unitSphere} scale={[1.1, 0.5, 3]} material={mat[m]}><Edges color={edgeColor(m)} threshold={50} /></mesh>
    </Part>
  )
}

// Telhado de quatro águas (pirâmide quando w = d)
export function Hip({ w, d, h, ...c }: Common & { w: number; d: number; h: number }) {
  const m = c.m ?? 'ink'
  return (
    <Part p={c.p} ry={c.ry} stage={c.stage} anim={c.anim ?? 'drop'}>
      <mesh geometry={hipGeo} scale={[w, h, d]} material={mat[m]}>
        <Edges color={edgeColor(m)} />
      </mesh>
    </Part>
  )
}

// Telhado de duas águas: prisma triangular com a cumeeira ao longo de z
export function Gable({ w, h, d, ...c }: Common & { w: number; h: number; d: number }) {
  const m = c.m ?? 'ink'
  return (
    <Part p={c.p} ry={c.ry} stage={c.stage} anim={c.anim ?? 'drop'}>
      <mesh geometry={gableGeo} scale={[w, h, d]} material={mat[m]}>
        <Edges color={edgeColor(m)} />
      </mesh>
    </Part>
  )
}

// Faixa pintada no piso (quadras, vagas, heliponto)
export const Mark = ({ p, lx, lz, m = 'cream', stage = 1 }: { p: V3; lx: number; lz: number; m?: MatKey; stage?: number }) => (
  <Box p={p} s={[lx, 0.08, lz]} m={m} edges={false} stage={stage} anim="spread" />
)

export function Ring({ p, r, t, m = 'cream', stage = 1 }: { p: V3; r: number; t: number; m?: MatKey; stage?: number }) {
  const geo = useGeo(() => new THREE.RingGeometry(r - t / 2, r + t / 2, 56).rotateX(-Math.PI / 2), `${r}/${t}`)
  return (
    <Part p={p} stage={stage} anim="spread">
      <mesh geometry={geo} position-y={0.08} material={mat[m]} />
    </Part>
  )
}

// Tubo ao longo de pontos (tobogã, escorregador). Cresce do chão.
export function Tube({ pts, r, m = 'coral', stage = 4 }: { pts: V3[]; r: number; m?: MatKey; stage?: number }) {
  const geo = useGeo(
    () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((v) => new THREE.Vector3(...v))), 120, r, 6, false),
    `${JSON.stringify(pts)}/${r}`,
  )
  return (
    <Part stage={stage}>
      <mesh geometry={geo} material={mat[m]}><Edges threshold={50} /></mesh>
    </Part>
  )
}

// Tela de alambrado / guarda-corpo: só os pontos do meio-tom, com moldura fina
export function Fence({ p, len, h, ry = 0, stage = 3 }: { p: V3; len: number; h: number; ry?: number; stage?: number }) {
  return (
    <Part p={p} ry={ry} stage={stage}>
      <mesh geometry={unitPlane} scale={[len, h, 1]} material={mat.fence}>
        <Edges />
      </mesh>
    </Part>
  )
}

export function Tree({ p, h = 6, stage = 3 }: { p: V3; h?: number; stage?: number }) {
  return (
    <Part p={p} stage={stage} anim="pop">
      <mesh geometry={cylGeo(0.667, 6)} scale={[h * 0.045, h * 0.5, h * 0.045]} material={mat.ink} />
      <mesh geometry={unitIco} position-y={h * 0.68} scale={h * 0.3} material={mat.cream}>
        <Edges />
      </mesh>
    </Part>
  )
}

// Tronco levemente curvo, um por altura de palmeira
const trunks = new Map<number, THREE.TubeGeometry>()
function trunkGeo(h: number) {
  if (!trunks.has(h)) trunks.set(h, share(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(h * 0.02, h * 0.5, 0), new THREE.Vector3(h * 0.12, h, 0),
  ]), 12, h * 0.022, 6, false)))
  return trunks.get(h)!
}

export function Palm({ p, h = 9, stage = 3, ry = 0 }: { p: V3; h?: number; stage?: number; ry?: number }) {
  const top: V3 = [h * 0.12, h, 0]
  return (
    <Part p={p} ry={ry} stage={stage} anim="pop">
      <mesh geometry={trunkGeo(h)} material={mat.ink} />
      {Array.from({ length: 7 }, (_, i) => (
        <group key={i} position={top} rotation-y={(i / 7) * Math.PI * 2}>
          <group position={[0, -h * 0.04, h * 0.19]} rotation-x={0.5}>
            <mesh geometry={unitBox} position-y={-h * 0.006} scale={[h * 0.09, h * 0.012, h * 0.4]} material={mat.coral}>
              <Edges />
            </mesh>
          </group>
        </group>
      ))}
    </Part>
  )
}

export function Umbrella({ p, m = 'cream', h = 2.4, stage = 4 }: { p: V3; m?: MatKey; h?: number; stage?: number }) {
  return (
    <Part p={p} stage={stage} anim="pop">
      <mesh geometry={cylGeo(1, 5)} scale={[0.05, h, 0.05]} material={mat.ink} />
      <mesh geometry={cylGeo(0.053, 8)} position-y={h - 0.375} scale={[1.5, 0.55, 1.5]} material={mat[m]}>
        <Edges color={edgeColor(m)} threshold={30} />
      </mesh>
    </Part>
  )
}

// Espreguiçadeira de 2 m com o encosto para -z
export function Lounger({ p, ry = 0, m = 'coral', stage = 4 }: { p: V3; ry?: number; m?: MatKey; stage?: number }) {
  return (
    <Part p={p} ry={ry} stage={stage} anim="pop">
      <mesh geometry={unitBox} position={[0, 0, 0.15]} scale={[0.7, 0.36, 1.6]} material={mat[m]}>
        <Edges />
      </mesh>
      <group position={[0, 0.5, -0.8]} rotation-x={0.9}>
        <mesh geometry={unitBox} position-y={-0.05} scale={[0.7, 0.1, 0.8]} material={mat[m]}>
          <Edges />
        </mesh>
      </group>
    </Part>
  )
}
