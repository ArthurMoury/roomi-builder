import { Box, Cyl, Disc, Ico, Lounger, Palm, Tree, Umbrella, type V3 } from './parts'
import type { Rot } from '../lib/valuation'

// Caminhos, cercas e mobiliário externo, em metros. Peças de ligação ocupam uma célula (5 × 5 m)
// e desenham um "braço" para cada vizinho igual (n, e, s, w), então trechos lado a lado viram uma
// linha contínua com curvas, tês e cruzamentos. Sem vizinhos, a peça é um trecho reto.

type Dir = 'n' | 'e' | 's' | 'w'
const VEC: Record<Dir, [number, number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }
const ALL: Dir[] = ['n', 'e', 's', 'w']

interface Arm { dir: Dir; real: boolean }

function armsOf(links: string, rot: Rot): Arm[] {
  const real = ALL.filter((d) => links.includes(d))
  if (real.length) return real.map((dir) => ({ dir, real: true }))
  return (rot % 2 ? (['n', 's'] as Dir[]) : (['e', 'w'] as Dir[])).map((dir) => ({ dir, real: false }))
}

// Caixa ao longo de um braço, de `from` a `to` metros do centro
function armBox(dir: Dir, from: number, to: number, width: number, y: number, h: number): { p: V3; s: V3 } {
  const [vx, vz] = VEC[dir], mid = (from + to) / 2, len = to - from
  return { p: [vx * mid, y, vz * mid], s: vx ? [len, h, width] : [width, h, len] }
}

type LinkProps = { links: string; rot: Rot }

// Pisantes de pedra sobre faixa de pedrisco. A pedra da divisa fica com o braço leste/sul.
function StonePath({ links, rot }: LinkProps) {
  const arms = armsOf(links, rot)
  const stones: V3[] = [[0, 0.06, 0]]
  for (const a of arms) {
    const [vx, vz] = VEC[a.dir]
    stones.push([vx * 1.25, 0.06, vz * 1.25])
    if (a.real && (a.dir === 'e' || a.dir === 's')) stones.push([vx * 2.5, 0.06, vz * 2.5])
  }
  return (
    <>
      <Box s={[1.8, 0.06, 1.8]} m="sand" anim="spread" />
      {arms.map((a) => { const b = armBox(a.dir, 0.9, 2.5, 1.8, 0, 0.06); return <Box key={a.dir} p={b.p} s={b.s} m="sand" anim="spread" /> })}
      {stones.map((p, i) => <Box key={i} p={p} s={[0.95, 0.09, 0.75]} ry={((i * 0.37) % 0.5) - 0.25} stage={1} anim="pop" />)}
    </>
  )
}

// Calçada de 2 m com juntas transversais
function Walkway({ links, rot }: LinkProps) {
  const arms = armsOf(links, rot)
  return (
    <>
      <Box s={[2, 0.1, 2]} anim="spread" />
      {arms.map((a) => {
        const b = armBox(a.dir, 1, 2.5, 2, 0, 0.1)
        const j = armBox(a.dir, 1.72, 1.78, 2, 0.1, 0.01)
        return (
          <group key={a.dir}>
            <Box p={b.p} s={b.s} anim="spread" />
            <Box p={j.p} s={j.s} m="ink" edges={false} stage={1} anim="spread" />
          </group>
        )
      })}
    </>
  )
}

// Via de 5 m: asfalto, faixa central tracejada (um traço a cada 1,25 m, inclusive na divisa
// entre trechos) e meio-fio nos lados sem continuação
function Road({ links, rot }: LinkProps) {
  const arms = armsOf(links, rot)
  const dirs = arms.map((a) => a.dir)
  const straight = dirs.length === 2 && VEC[dirs[0]][0] === -VEC[dirs[1]][0] && VEC[dirs[0]][1] === -VEC[dirs[1]][1]
  const dashes = arms.flatMap((a) => (a.real && (a.dir === 'e' || a.dir === 's') ? [[a.dir, 1.25], [a.dir, 2.5]] : [[a.dir, 1.25]]) as [Dir, number][])
  return (
    <>
      <Box s={[5, 0.08, 5]} m="asphalt" anim="spread" />
      {dashes.map(([dir, at]) => { const b = armBox(dir, at - 0.3, at + 0.3, 0.14, 0.08, 0.03); return <Box key={`${dir}${at}`} p={b.p} s={b.s} edges={false} stage={1} anim="spread" /> })}
      {straight && <Box p={[0, 0.08, 0]} s={VEC[dirs[0]][0] ? [0.6, 0.03, 0.14] : [0.14, 0.03, 0.6]} edges={false} stage={1} anim="spread" />}
      {ALL.filter((d) => !dirs.includes(d)).map((d) => {
        const [vx, vz] = VEC[d]
        return <Box key={d} p={[vx * 2.4, 0.08, vz * 2.4]} s={vx ? [0.2, 0.15, 5] : [5, 0.15, 0.2]} stage={1} anim="spread" />
      })}
    </>
  )
}

function Deck() {
  return (
    <>
      <Box s={[5, 0.25, 5]} anim="spread" />
      {[-2, -1.2, -0.4, 0.4, 1.2, 2].map((z) => <Box key={z} p={[0, 0.25, z]} s={[5, 0.012, 0.05]} m="ink" edges={false} stage={1} anim="spread" />)}
    </>
  )
}

// Cerca de madeira: mourão no centro e a cada 1,25 m, duas réguas por braço
function WoodFence({ links, rot }: LinkProps) {
  const arms = armsOf(links, rot)
  const posts: V3[] = [[0, 0, 0]]
  for (const a of arms) {
    const [vx, vz] = VEC[a.dir]
    posts.push([vx * 1.25, 0, vz * 1.25])
    if (!a.real) posts.push([vx * 2.42, 0, vz * 2.42])
    else if (a.dir === 'e' || a.dir === 's') posts.push([vx * 2.5, 0, vz * 2.5])
  }
  return (
    <>
      {posts.map((p, i) => <Box key={i} p={p} s={[0.16, 1.2, 0.16]} />)}
      {arms.flatMap((a) => [0.45, 0.9].map((y) => {
        const b = armBox(a.dir, 0, a.real ? 2.5 : 2.42, 0.07, y, 0.1)
        return <Box key={`${a.dir}${y}`} p={b.p} s={b.s} stage={1} anim="spread" />
      }))}
    </>
  )
}

function Hedge({ links, rot }: LinkProps) {
  const arms = armsOf(links, rot)
  return (
    <>
      <Box s={[1.1, 1.3, 1.1]} m="grass" />
      {arms.map((a) => { const b = armBox(a.dir, 0.55, 2.5, 1.1, 0, 1.3); return <Box key={a.dir} p={b.p} s={b.s} m="grass" stage={1} /> })}
    </>
  )
}

// Muro de 2,1 m com pilar no centro e capa coral
function Wall({ links, rot }: LinkProps) {
  const arms = armsOf(links, rot)
  return (
    <>
      <Box s={[0.5, 2.3, 0.5]} />
      <Box p={[0, 2.3, 0]} s={[0.6, 0.08, 0.6]} m="coral" stage={2} anim="drop" />
      {arms.map((a) => {
        const b = armBox(a.dir, 0.25, 2.5, 0.3, 0, 2.1)
        const c = armBox(a.dir, 0.25, 2.5, 0.4, 2.1, 0.08)
        return (
          <group key={a.dir}>
            <Box p={b.p} s={b.s} stage={1} />
            <Box p={c.p} s={c.s} m="coral" stage={2} anim="drop" />
          </group>
        )
      })}
    </>
  )
}

export function LandscapeModel({ id, W, D, links, rot }: { id: string; W: number; D: number; links: string; rot: Rot }) {
  switch (id) {
    case 'path_stone': return <StonePath links={links} rot={rot} />
    case 'path_paved': return <Walkway links={links} rot={rot} />
    case 'road': return <Road links={links} rot={rot} />
    case 'deck': return <Deck />
    case 'fence': return <WoodFence links={links} rot={rot} />
    case 'hedge': return <Hedge links={links} rot={rot} />
    case 'wall': return <Wall links={links} rot={rot} />

    case 'lamp': // poste de 5 m com braço e luminária coral
      return (
        <>
          <Cyl r={0.18} h={0.35} m="ink" seg={10} />
          <Cyl p={[0, 0.35, 0]} r={0.07} h={4.6} m="ink" seg={8} stage={1} />
          <Box p={[0.45, 4.75, 0]} s={[0.9, 0.08, 0.08]} m="ink" stage={2} />
          <Box p={[0.95, 4.5, 0]} s={[0.55, 0.25, 0.32]} m="coral" stage={3} anim="pop" />
        </>
      )
    case 'bollard':
      return (
        <>
          <Cyl r={0.11} h={0.8} m="ink" seg={10} />
          <Cyl p={[0, 0.8, 0]} r={0.13} h={0.12} m="coral" seg={10} stage={1} anim="pop" />
        </>
      )
    case 'bench':
      return (
        <>
          {[-0.75, 0.75].map((x) => <Box key={x} p={[x, 0, 0]} s={[0.1, 0.42, 0.45]} m="ink" />)}
          <Box p={[0, 0.42, 0]} s={[1.8, 0.08, 0.5]} stage={1} />
          <Box p={[0, 0.5, -0.22]} s={[1.8, 0.45, 0.06]} stage={2} />
        </>
      )
    case 'sunbeds':
      return (
        <>
          <Lounger p={[-0.55, 0, 0.3]} stage={1} />
          <Lounger p={[0.55, 0, 0.3]} stage={1} />
          <Umbrella p={[0, 0, -1]} stage={2} />
        </>
      )
    case 'firepit': // roda de bancos em volta do fogo
      return (
        <>
          <Disc p={[0, 0, 0]} rx={4.4} rz={4.4} h={0.06} m="sand" stage={0} />
          <Cyl p={[0, 0.06, 0]} r={1.2} h={0.45} m="ink" seg={16} stage={1} />
          <Cyl p={[0, 0.51, 0]} r={0.75} rt={0.02} h={1.1} m="coral" seg={7} stage={2} anim="pop" />
          <Cyl p={[0.15, 0.51, 0.1]} r={0.4} rt={0.02} h={0.7} seg={6} stage={3} anim="pop" />
          {([[0, -2.9, 0], [2.9, 0, Math.PI / 2], [0, 2.9, 0], [-2.9, 0, Math.PI / 2]] as const).map(([x, z, ry], i) => (
            <Box key={i} p={[x, 0.06, z]} ry={ry} s={[2.6, 0.45, 0.55]} stage={2} />
          ))}
        </>
      )
    case 'pergola':
      return (
        <>
          <Box s={[8.4, 0.2, 8.4]} anim="spread" />
          {[[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]].map(([x, z], i) => <Box key={i} p={[x, 0.2, z]} s={[0.22, 2.8, 0.22]} m="ink" stage={1} />)}
          {[-3.6, 3.6].map((z) => <Box key={z} p={[0, 3, z]} s={[7.8, 0.22, 0.22]} m="ink" stage={2} />)}
          {[-3, -1.8, -0.6, 0.6, 1.8, 3].map((x) => <Box key={x} p={[x, 3.22, 0]} s={[0.2, 0.2, 8.2]} m="coral" stage={3} anim="drop" />)}
          <Box p={[0, 0.2, -1.8]} s={[3.6, 0.45, 1]} stage={4} anim="pop" />
          <Cyl p={[0, 0.2, 0.2]} r={0.55} h={0.45} seg={12} stage={4} anim="pop" />
        </>
      )
    case 'gazebo': // piso octogonal, oito colunas e telhado coral
      return (
        <>
          <Cyl r={3.6} h={0.45} seg={8} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2 + Math.PI / 8
            return <Box key={i} p={[Math.cos(a) * 3.15, 0.45, Math.sin(a) * 3.15]} s={[0.16, 2.6, 0.16]} m="ink" edges={false} stage={1} />
          })}
          <Cyl p={[0, 3.05, 0]} r={4.1} rt={0.15} h={2.2} m="coral" seg={8} stage={2} anim="drop" />
        </>
      )
    case 'fountain':
      return (
        <>
          <Cyl r={3.6} h={0.6} seg={32} />
          <Cyl r={3.3} h={0.63} m="water" seg={32} stage={1} anim="fill" />
          <Cyl r={0.35} h={2.6} seg={12} stage={2} />
          <Cyl p={[0, 1.5, 0]} r={1.3} h={0.22} m="coral" seg={20} stage={3} />
          <Cyl p={[0, 2.6, 0]} r={0.7} h={0.18} m="coral" seg={16} stage={4} />
        </>
      )
    case 'hammock': // três redes entre mourões, à sombra de palmeiras
      return (
        <>
          <Box s={[W - 0.8, 0.15, D - 0.8]} m="sand" anim="spread" />
          {[-2.8, 0, 2.8].map((z, i) => (
            <group key={z}>
              {[-1.9, 1.9].map((x) => <Box key={x} p={[x, 0.15, z]} s={[0.15, 2, 0.15]} m="ink" edges={false} stage={1} />)}
              <Box p={[0, 0.95, z]} s={[3.65, 0.12, 0.9]} m="coral" stage={2 + i} anim="spread" />
            </group>
          ))}
          <Palm p={[3.4, 0.15, -3.6]} h={8} stage={4} />
          <Palm p={[-3.5, 0.15, 3.7]} h={7} stage={4} />
        </>
      )
    case 'tree':
      return (
        <>
          <Disc p={[0, 0, 0]} rx={1.6} rz={1.6} h={0.05} m="grass" stage={0} />
          <Tree p={[0, 0.05, 0]} h={7.5} stage={1} />
        </>
      )
    case 'flowerbed':
      return (
        <>
          <Box s={[3.4, 0.5, 1.6]} m="ink" />
          {[-1.2, -0.4, 0.4, 1.2].flatMap((x, i) => [-0.35, 0.35].map((z, j) => (
            <Ico key={`${x}/${z}`} p={[x, 0.45, z]} r={0.32} m={(i + j) % 2 ? 'coral' : 'cream'} stage={1 + ((i + j) % 2)} />
          )))}
        </>
      )
    case 'gatehouse': // cabine com cancela sobre a via de acesso
      return (
        <>
          <Box p={[0, 0, 2.2]} s={[W - 0.4, 0.08, 4.4]} m="asphalt" anim="spread" />
          <Box p={[-2.6, 0, -2.4]} s={[3.2, 2.8, 3]} stage={1} />
          <Box p={[-2.6, 0.9, -0.88]} s={[2.4, 1.3, 0.1]} m="glass" edges={false} stage={2} />
          <Box p={[-2.6, 2.8, -2.4]} s={[4, 0.3, 3.8]} m="ink" stage={2} anim="drop" />
          <Box p={[-4.2, 0.08, 2.2]} s={[0.4, 1.05, 0.4]} m="ink" stage={2} />
          <Box p={[-0.7, 0.95, 2.2]} s={[6.6, 0.14, 0.14]} m="coral" stage={3} anim="spread" />
        </>
      )
  }
  return <Box s={[W - 0.8, 3, D - 0.8]} />
}
