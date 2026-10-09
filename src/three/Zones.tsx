import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import { GRID, useStore } from '../store'
import { ROLE_LABEL, TEMPLATES, type Role } from '../lib/autoplace'
import { C } from './materials'

// Leitura do terreno no posicionamento automático: as zonas do modelo de implantação escolhido,
// tracejadas no chão com o nome de cada papel, e o mar quando o modelo é de frente de mar.
// No modo analista, só o mar aparece (quando o destino é praia).

const FONT = '/fonts/FuturaNew-500.otf'
const dash = new THREE.LineDashedMaterial({ color: C.coral, dashSize: 0.5, gapSize: 0.3 })
const waveMat = new THREE.LineBasicMaterial({ color: C.coral })

function Outline({ w, d }: { w: number; d: number }) {
  const ref = useRef<THREE.LineSegments>(null!)
  const geo = useMemo(() => {
    const i = 0.12 // recuo, para as bordas de zonas vizinhas não se sobreporem
    const a = new THREE.Vector3(i, 0, i), b = new THREE.Vector3(w - i, 0, i)
    const c = new THREE.Vector3(w - i, 0, d - i), e = new THREE.Vector3(i, 0, d - i)
    return new THREE.BufferGeometry().setFromPoints([a, b, b, c, c, e, e, a])
  }, [w, d])
  useLayoutEffect(() => { ref.current.computeLineDistances() }, [geo])
  useEffect(() => () => geo.dispose(), [geo])
  return <lineSegments ref={ref} geometry={geo} material={dash} />
}

// Texto deitado no chão, girado 45° para ler na horizontal a partir da câmera inicial
function Label({ x, z, size, color, children }: { x: number; z: number; size: number; color: string; children: string }) {
  return (
    <group position={[x, 0, z]} rotation-y={Math.PI / 4}>
      <Text font={FONT} fontSize={size} letterSpacing={0.16} color={color} fillOpacity={0.8} rotation-x={-Math.PI / 2}>
        {children.toUpperCase()}
      </Text>
    </group>
  )
}

// Três linhas de onda logo além da divisa norte; o grupo gira para as outras divisas
const waves = (() => {
  const pts: THREE.Vector3[] = []
  const at = (x: number, z: number, ph: number) => new THREE.Vector3(x, 0, z + Math.sin(x * Math.PI + ph) * 0.15)
  for (const [z, ph] of [[-1.1, 0], [-1.9, 1.2], [-2.7, 2.4]])
    for (let x = 0; x < GRID; x += 0.25) pts.push(at(x, z, ph), at(x + 0.25, z, ph))
  return new THREE.BufferGeometry().setFromPoints(pts)
})()
const TURN = { n: 0, w: Math.PI / 2, s: Math.PI, e: -Math.PI / 2 }

function Sea({ side, color }: { side: keyof typeof TURN; color: string }) {
  return (
    <group position={[GRID / 2, 0, GRID / 2]} rotation-y={TURN[side]}>
      <group position={[-GRID / 2, 0, -GRID / 2]}>
        <lineSegments geometry={waves} material={waveMat} />
        <Label x={GRID / 2} z={-4.6} size={1.6} color={color}>Mar</Label>
      </group>
    </group>
  )
}

export function Zones() {
  const zones = useStore((s) => s.appMode === 'builder' && s.placeMode === 'auto')
  const beach = useStore((s) => s.appMode === 'analyst' && s.spec.destino === 'praia')
  const t = TEMPLATES[useStore((s) => s.autoTemplate)]
  const light = useStore((s) => s.theme === 'light')
  if (!zones && !beach) return null
  return (
    // a fonte carrega à parte, sem suspender o resto da cena
    <Suspense fallback={null}>
      <group position={[-GRID / 2, 0.03, -GRID / 2]}>
        {zones && (Object.keys(t.zones) as Role[]).flatMap((role) => t.zones[role].map((r, k) => (
          <group key={`${role}${k}`} position={[r.x, 0, r.z]}>
            <Outline w={r.w} d={r.d} />
            <Label x={r.w / 2} z={r.d / 2} size={1.1} color={C.ink}>{ROLE_LABEL[role]}</Label>
          </group>
        )))}
        {t.sea && <Sea side={t.water} color={light ? C.ink : C.cream} />}
      </group>
    </Suspense>
  )
}
