import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { linksOf } from '../store'
import { ITEM_BY_ID } from '../data/catalog'
import { C } from '../three/materials'
import { Island, Item, MAX_DPR, Rig } from '../three/Scene'
import { Sea } from '../three/Sea'
import { StaticItems } from '../three/Thumbs'
import { CameraRig, cam, resetView, view, type Inset } from '../three/view'
import { SHOW, type ShowItem } from './example'

// O board da LP, no mesmo 3D do Builder: o resort de exemplo sobe por etapas conforme a rolagem
// (stage) e o que volta na rolagem é demolido. Para de desenhar quando a LP cobre o board (paused).
// Com movimento reduzido, o resort aparece pronto num quadro parado (still).

interface Board { live: ShowItem[]; dying: Set<string>; delay: Record<string, number> }
let seq = 0
const STILL_ITEMS = SHOW.map((p) => ({ id: p.itemId, x: p.x, z: p.z, rot: p.rot }))

export default function Showcase({ stage, turn, inset, paused, still }: { stage: number; turn: number; inset: Inset; paused: boolean; still: boolean }) {
  const [dpr, setDpr] = useState(MAX_DPR)
  const [board, setBoard] = useState<Board>({ live: [], dying: new Set(), delay: {} })

  // enquadramento e giro vêm da LP; o primeiro já nasce no lugar, os seguintes a câmera persegue
  useLayoutEffect(() => { resetView(inset) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    view.inset = { ...inset }
    view.turn = turn
    if (still) Object.assign(cam, inset, { az: turn * (Math.PI / 2) })
  }, [inset, turn, still])

  // cada etapa nova sobe em cascata; as que a rolagem desfez vão abaixo
  useEffect(() => {
    if (still) return
    setBoard((b) => {
      const dying = new Set(b.dying)
      for (const p of b.live) if (p.stage > stage) dying.add(p.uid)
      const kept = new Set(b.live.filter((p) => !dying.has(p.uid)).map((p) => p.key))
      const add = SHOW.filter((p) => p.stage <= stage && !kept.has(p.key))
      const step = Math.min(60, 2000 / Math.max(add.length, 1))
      const delay = { ...b.delay }
      const fresh = add.map((p, i) => {
        const uid = `s${p.key}-${++seq}`
        delay[uid] = Math.round(i * step)
        return { ...p, uid }
      })
      return { live: [...b.live, ...fresh], dying, delay }
    })
  }, [stage, still])
  const gone = useCallback((uid: string) => setBoard((b) => {
    const dying = new Set(b.dying)
    dying.delete(uid)
    const delay = { ...b.delay }
    delete delay[uid]
    return { live: b.live.filter((p) => p.uid !== uid), dying, delay }
  }), [])

  return (
    <Canvas flat dpr={dpr} frameloop={still ? 'demand' : paused ? 'never' : 'always'} camera={{ fov: 30, near: 1, far: 900 }} gl={{ antialias: true }}>
      <color attach="background" args={[C.ink]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 14, 3]} intensity={1.6} />
      <Island light={false} rise={!still} />
      <Sea side="n" light={false} />
      {still ? <StaticItems items={STILL_ITEMS} /> : board.live.map((p) => (
        <Item key={p.uid} p={p} delay={board.delay[p.uid] ?? 0} dying={board.dying.has(p.uid)}
          links={ITEM_BY_ID[p.itemId].link ? linksOf(board.live, board.dying, p) : ''} onGone={gone} />
      ))}
      <CameraRig wheel={false} />
      <Rig onDpr={still ? undefined : (s) => setDpr((v) => Math.min(MAX_DPR, Math.max(0.6, +(v + s).toFixed(2))))} />
    </Canvas>
  )
}
