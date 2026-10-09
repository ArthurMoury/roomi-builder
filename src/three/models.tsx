import type { ReactNode } from 'react'
import { Box, Cyl, Disc, Edges, Fence, Gable, Hip, Hull, Ico, Lounger, Mark, Palm, Part, Ring, Tree, Tube, Umbrella, cylGeo, type V3 } from './parts'
import { mat, type MatKey } from './materials'
import { CELL_METERS } from '../data/catalog'
import { LandscapeModel } from './landscape'
import type { Rot } from '../lib/valuation'

// Tudo aqui é em metros, com a pegada W×D centrada na origem e o chão em y=0.
// O grupo externo escala para células do mapa (1 célula = 5 m).

const Pad = ({ W, D, m = 'cream', h = 0.25 }: { W: number; D: number; m?: MatKey; h?: number }) => (
  <Box s={[W - 0.8, h, D - 0.8]} m={m} anim="spread" />
)

const Water = ({ p, w, d, h = 0.3, stage = 2 }: { p: V3; w: number; d: number; h?: number; stage?: number }) => (
  <Box p={p} s={[w, h, d]} m="water" stage={stage} anim="fill" />
)

// Piscina rebaixada: deck em quatro faixas em volta da lâmina, água 8 cm abaixo do deck
function Basin({ p = [0, 0, 0], ow, od, ww, wd, h = 0.35, deck = 'cream', stage = 0 }: {
  p?: V3; ow: number; od: number; ww: number; wd: number; h?: number; deck?: MatKey; stage?: number
}) {
  const [x, y, z] = p
  const sx = (ow - ww) / 2, sz = (od - wd) / 2
  return (
    <>
      <Box p={[x, y, z - wd / 2 - sz / 2]} s={[ow, h, sz]} m={deck} stage={stage} anim="spread" />
      <Box p={[x, y, z + wd / 2 + sz / 2]} s={[ow, h, sz]} m={deck} stage={stage} anim="spread" />
      <Box p={[x - ww / 2 - sx / 2, y, z]} s={[sx, h, wd]} m={deck} stage={stage} anim="spread" />
      <Box p={[x + ww / 2 + sx / 2, y, z]} s={[sx, h, wd]} m={deck} stage={stage} anim="spread" />
      <Water p={[x, y, z]} w={ww} d={wd} h={h - 0.08} stage={stage + 1} />
    </>
  )
}

// Ofurô redondo: borda maciça e lâmina d'água por cima
const Tub = ({ p, r, stage = 2 }: { p: V3; r: number; stage?: number }) => (
  <>
    <Cyl p={p} r={r} h={0.7} seg={28} stage={stage} />
    <Cyl p={p} r={r - 0.25} h={0.73} m="water" seg={28} stage={stage + 1} anim="fill" />
  </>
)

const Table = ({ p, stage = 3 }: { p: V3; stage?: number }) => <Cyl p={p} r={0.6} h={0.75} seg={12} stage={stage} anim="pop" />

const Posts = ({ x, z, cx = 0, cz = 0, y, h, stage }: { x: number; z: number; cx?: number; cz?: number; y: number; h: number; stage: number }) => (
  <>{[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
    <Box key={i} p={[cx + sx * x, y, cz + sz * z]} s={[0.16, h, 0.16]} m="ink" edges={false} stage={stage} />
  ))}</>
)

interface BuildingProps {
  W: number; D: number; bw: number; bd: number; bx?: number; bz?: number
  floors: number; gh?: number; fh?: number
  roof?: 'flat' | 'gable' | 'hip'; roofM?: MatKey; roofH?: number
  balconies?: boolean; core?: boolean; canopy?: MatKey | null; padM?: MatKey; rooftop?: boolean
}

// Edifício: térreo com vidro e marquise, andares com faixa de janelas (e varandas), núcleo coral e cobertura.
function Building({
  W, D, bw, bd, bx = 0, bz = 0, floors, gh = 4, fh = 3.2, roof = 'flat', roofM = 'ink', roofH = 3,
  balconies = false, core = false, canopy = 'coral', padM = 'cream', rooftop = true,
}: BuildingProps) {
  const y0 = 0.25
  const top = y0 + gh + (floors - 1) * fh
  const front = bz + bd / 2
  const coreX = Math.min(bx + bw / 2 + 1, W / 2 - 2.3)
  return (
    <>
      <Pad W={W} D={D} m={padM} />
      <Box p={[bx, y0, bz]} s={[bw, gh, bd]} stage={1} />
      <Box p={[bx, y0 + 0.3, front + 0.02]} s={[bw * 0.8, gh - 0.9, 0.12]} m="glass" edges={false} stage={1} />
      {canopy && <Box p={[bx, y0 + gh - 0.7, front + 1]} s={[Math.min(8, bw * 0.5), 0.3, 2]} m={canopy} stage={2} anim="spread" />}
      {Array.from({ length: floors - 1 }, (_, i) => {
        const y = y0 + gh + i * fh, st = 2 + i
        return (
          <group key={i}>
            <Box p={[bx, y, bz]} s={[bw, fh, bd]} stage={st} />
            {[1, -1].map((side) => (
              <group key={side}>
                <Box p={[bx, y + 0.8, bz + side * (bd / 2 + 0.02)]} s={[bw * 0.86, 1.5, 0.12]} m="glass" edges={false} stage={st} />
                {balconies && (
                  <>
                    <Box p={[bx, y, bz + side * (bd / 2 + 0.65)]} s={[bw * 0.9, 0.18, 1.5]} stage={st} anim="spread" />
                    <Fence p={[bx, y + 0.18, bz + side * (bd / 2 + 1.38)]} len={bw * 0.9} h={1} stage={st} />
                  </>
                )}
              </group>
            ))}
          </group>
        )
      })}
      {core && <Box p={[coreX, y0, bz]} s={[3.5, top - y0 + 2.4, bd * 0.5]} m="coral" stage={floors} />}
      {roof === 'flat' && (
        <>
          <Box p={[bx, top, bz]} s={[bw + 0.6, 0.4, bd + 0.6]} m={roofM} stage={floors + 1} anim="drop" />
          {rooftop && (
            <>
              <Box p={[bx - bw / 4, top + 0.4, bz - bd / 6]} s={[3, 1.2, 2.4]} stage={floors + 2} anim="pop" />
              <Box p={[bx + bw / 8, top + 0.4, bz + bd / 8]} s={[2, 0.9, 2]} stage={floors + 2} anim="pop" />
            </>
          )}
        </>
      )}
      {roof === 'gable' && (bw >= bd
        ? <Gable p={[bx, top, bz]} ry={Math.PI / 2} w={bd + 1.2} d={bw + 1.2} h={roofH} m={roofM} stage={floors + 1} />
        : <Gable p={[bx, top, bz]} w={bw + 1.2} d={bd + 1.2} h={roofH} m={roofM} stage={floors + 1} />)}
      {roof === 'hip' && <Hip p={[bx, top, bz]} w={bw + 1.2} d={bd + 1.2} h={roofH} m={roofM} stage={floors + 1} />}
    </>
  )
}

// Quadra: piso, linhas (children) e alambrado em volta
function Court({ W, D, floor, children, fence = 3.5 }: { W: number; D: number; floor: MatKey; children?: ReactNode; fence?: number | null }) {
  const fw = W - 0.8, fd = D - 0.8
  return (
    <>
      <Box s={[fw, 0.15, fd]} m={floor} anim="spread" />
      {children}
      {fence && (
        <>
          <Fence p={[0, 0.15, fd / 2 - 0.05]} len={fw - 0.1} h={fence} />
          <Fence p={[0, 0.15, -fd / 2 + 0.05]} len={fw - 0.1} h={fence} />
          <Fence p={[fw / 2 - 0.05, 0.15, 0]} ry={Math.PI / 2} len={fd - 0.1} h={fence} />
          <Fence p={[-fw / 2 + 0.05, 0.15, 0]} ry={Math.PI / 2} len={fd - 0.1} h={fence} />
        </>
      )}
    </>
  )
}

// Tobogã: sai de `a`, faz voltas e pousa em `b`
function slidePath(a: V3, b: V3, loops: number, r: number): V3[] {
  return Array.from({ length: 48 }, (_, i) => {
    const t = i / 47, env = Math.sin(Math.PI * t) * r, ang = t * loops * Math.PI * 2
    return [a[0] + (b[0] - a[0]) * t + Math.cos(ang) * env, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + Math.sin(ang) * env]
  })
}

function Car({ x, z, m, stage }: { x: number; z: number; m: MatKey; stage: number }) {
  return (
    <>
      <Box p={[x, 0.12, z]} s={[1.8, 0.75, 4.3]} m={m} stage={stage} anim="pop" />
      <Box p={[x, 0.87, z + 0.2]} s={[1.6, 0.6, 2.2]} m={m} stage={stage} anim="pop" />
    </>
  )
}

function ModelM({ id, W, D, links, rot }: { id: string; W: number; D: number; links: string; rot: Rot }) {
  switch (id) {
    // ── Hospedagem ─────────────────────────────────────────────
    case 'std': // 30×15 m: térreo + 4 andares de 12 quartos
      return <Building W={W} D={D} bw={24} bd={10.5} floors={5} gh={4} fh={3.2} balconies core />
    case 'suite': // 25×15 m: térreo + 2 andares de 8 suítes, telhado coral
      return <Building W={W} D={D} bw={20} bd={10} floors={3} gh={3.6} fh={3.4} balconies roof="gable" roofM="coral" roofH={3.2} canopy="ink" />
    case 'family': // 20×15 m: térreo + 3 andares de 4 apartamentos
      return <Building W={W} D={D} bw={14} bd={10} floors={4} gh={3.6} fh={3.2} balconies core roofM="coral" />
    case 'chalet':
      return (
        <>
          <Pad W={W} D={D} m="grass" />
          <Box p={[0, 0.25, -0.8]} s={[6, 2.8, 5.5]} stage={1} />
          <Box p={[0, 0.25, 2.85]} s={[6, 0.25, 1.8]} stage={1} anim="spread" />
          <Box p={[0.9, 0.5, 1.97]} s={[1.1, 2.1, 0.1]} m="coral" edges={false} stage={2} />
          <Box p={[-1.4, 1.1, 1.97]} s={[1.6, 1.2, 0.1]} m="glass" edges={false} stage={2} />
          <Gable p={[0, 3.05, -0.8]} w={7.2} d={6.7} h={3.4} stage={2} />
          <Box p={[1.7, 3.9, -2]} s={[0.7, 2.2, 0.7]} stage={3} />
          <Tree p={[3.4, 0.25, -3.4]} h={5.5} />
        </>
      )
    case 'bungalow':
      return (
        <>
          <Water p={[0, 0, 0]} w={W - 0.4} d={D - 0.4} h={0.4} stage={0} />
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
            <Cyl key={i} p={[x * 2.8, 0, z * 2.8]} r={0.16} h={1.5} m="ink" seg={8} stage={1} />
          ))}
          <Box p={[0, 1.5, 0.3]} s={[8, 0.25, 8.2]} stage={2} anim="spread" />
          <Box p={[0, 1.75, -1]} s={[5.6, 2.6, 4.6]} stage={3} />
          <Box p={[0, 2, 1.32]} s={[3.6, 1.9, 0.1]} m="glass" edges={false} stage={3} />
          <Hip p={[0, 4.35, -1]} w={7.4} d={6.4} h={3} m="coral" stage={4} />
          <Lounger p={[1.4, 1.75, 2.9]} stage={5} />
          <Lounger p={[2.6, 1.75, 2.9]} stage={5} />
        </>
      )
    case 'villa':
      return (
        <>
          <Pad W={W} D={D} m="grass" />
          <Box p={[-2.5, 0.25, -3.2]} s={[8.5, 3.4, 6.6]} stage={1} />
          <Box p={[3.9, 0.25, -4.4]} s={[4.6, 3, 4.2]} stage={1} />
          <Box p={[-2.5, 0.55, 0.12]} s={[6.5, 2.7, 0.1]} m="glass" edges={false} stage={2} />
          <Box p={[-2.5, 3.65, -3]} s={[9.6, 0.35, 7.8]} m="ink" stage={2} anim="drop" />
          <Box p={[3.9, 3.25, -4.4]} s={[5.2, 0.3, 4.8]} m="coral" stage={2} anim="drop" />
          <Basin p={[1.6, 0.25, 3.6]} ow={9} od={5.4} ww={6.6} wd={3} stage={2} />
          <Lounger p={[-4.6, 0.25, 3.4]} />
          <Lounger p={[-3.4, 0.25, 3.4]} />
          <Umbrella p={[-5.9, 0.25, 2.2]} />
          <Palm p={[-6.3, 0.25, 6.3]} h={8} stage={4} />
        </>
      )

    // ── Aquático ───────────────────────────────────────────────
    case 'pool': // lâmina de 18×7,5 m com deck em volta
      return (
        <>
          <Basin ow={W - 0.8} od={D - 0.8} ww={18} wd={7.5} />
          {[-8, -5.6, -3.2, 3.2, 5.6, 8].map((x) => <Lounger key={x} p={[x, 0.35, -5.2]} />)}
          {[-6.8, 0, 6.8].map((x) => <Umbrella key={x} p={[x, 0.35, -5.7]} />)}
          <Palm p={[-10.8, 0.35, 5.4]} h={7} stage={4} />
          <Palm p={[10.8, 0.35, 5.4]} h={7.5} stage={4} />
        </>
      )
    case 'kidpool':
      return (
        <>
          <Basin ow={W - 0.8} od={D - 0.8} ww={6.6} wd={5.6} />
          <Umbrella p={[1.6, 0, 0.6]} m="coral" h={2.2} stage={3} />
          <Box p={[-2.2, 0, -1.6]} s={[1.6, 1.4, 1.6]} m="coral" stage={2} />
          <Tube pts={[[-2.2, 1.4, -0.8], [-2.2, 1, 0.4], [-2, 0.4, 1.8]]} r={0.3} m="cream" stage={3} />
        </>
      )
    case 'infinity': // a lâmina vai até a borda sul e transborda numa canaleta
      return (
        <>
          <Box p={[0, 0, -5.1]} s={[W - 0.8, 0.35, 4]} anim="spread" />
          <Box p={[-10.6, 0, 1.9]} s={[3, 0.35, 10]} anim="spread" />
          <Box p={[10.6, 0, 1.9]} s={[3, 0.35, 10]} anim="spread" />
          <Water p={[0, 0, 1.75]} w={18.2} d={9.7} h={0.33} stage={1} />
          <Box p={[0, 0, 6.85]} s={[18.2, 0.12, 0.5]} m="ink" stage={1} anim="spread" />
          {[-7, -4.6, 4.6, 7].map((x) => <Lounger key={x} p={[x, 0.35, -5.6]} />)}
          <Box p={[0, 0.35, -5.2]} s={[3.6, 0.4, 2.4]} m="coral" stage={4} anim="pop" />
          {[-5.8, 5.8].map((x) => <Umbrella key={x} p={[x, 0.35, -6.2]} />)}
        </>
      )
    case 'indoor': // estrutura com cobertura de vidro, laterais abertas
      return (
        <>
          <Basin ow={W - 0.8} od={D - 0.8} ww={12} wd={6} />
          {[-8.6, 0, 8.6].map((x) => [-6.2, 6.2].map((z) => (
            <Box key={`${x}/${z}`} p={[x, 0.35, z]} s={[0.35, 4.6, 0.35]} m="ink" stage={3} />
          )))}
          <Box p={[0, 0.35, -6.3]} s={[17, 4.6, 0.12]} m="glass" edges={false} stage={3} />
          {[-6.2, 6.2].map((z) => <Box key={z} p={[0, 4.95, z]} s={[17.6, 0.35, 0.35]} m="ink" stage={4} />)}
          <Gable p={[0, 5.3, 0]} ry={Math.PI / 2} w={13.2} d={18} h={3} m="glass" stage={5} />
        </>
      )
    case 'jacuzzi':
      return (
        <>
          <Pad W={W} D={D} m="sand" h={0.2} />
          <Tub p={[0, 0.2, 0]} r={1.75} stage={1} />
        </>
      )
    case 'swimup': // ilha de bar coberta no meio da piscina, banquetas dentro d'água
      return (
        <>
          <Basin ow={W - 0.8} od={D - 0.8} ww={11.6} wd={6.4} />
          <Cyl p={[0, 0, 0]} r={1.8} h={1.2} m="coral" seg={20} stage={2} />
          <Posts x={1.1} z={1.1} y={1.2} h={2.1} stage={3} />
          <Hip p={[0, 3.3, 0]} w={4.8} d={4.8} h={1.8} m="cream" stage={4} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            return <Cyl key={i} p={[Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5]} r={0.25} h={0.75} m="ink" seg={10} stage={4} anim="pop" />
          })}
        </>
      )
    case 'waterpark': {
      const tower: V3 = [-15, 0.2, -15]
      return (
        <>
          <Pad W={W} D={D} m="sand" h={0.2} />
          <Basin p={[7, 0.2, 5]} ow={28} od={26} ww={23} wd={20} stage={1} />
          <Basin p={[-14, 0.2, 12]} ow={12} od={12} ww={8} wd={8} stage={1} />
          <Basin p={[-6, 0.2, -16]} ow={12} od={10} ww={9} wd={7} stage={1} />
          <Box p={tower} s={[5, 12, 5]} m="ink" stage={2} />
          <Box p={[tower[0], 12.2, tower[2]]} s={[7, 0.4, 7]} m="coral" stage={3} anim="drop" />
          <Posts x={3.2} z={3.2} cx={tower[0]} cz={tower[2]} y={12.6} h={2.2} stage={4} />
          <Hip p={[tower[0], 14.8, tower[2]]} w={7.6} d={7.6} h={2.4} m="cream" stage={5} />
          <Tube pts={slidePath([-11.5, 12.6, -15], [-4, 0.5, -16], 1.25, 3.5)} r={0.5} stage={5} />
          <Tube pts={slidePath([-15, 12.6, -11.5], [-2, 0.5, -3], 0.75, 3)} r={0.5} m="cream" stage={6} />
          <Umbrella p={[-16, 0.2, 10]} m="coral" stage={4} />
          <Umbrella p={[-11.5, 0.2, 14.5]} m="coral" h={2} stage={4} />
          {[-1, 5, 11, 17].map((x) => <Umbrella key={x} p={[x, 0.55, 16.6]} stage={5} />)}
          {[1, 3, 7, 9, 13, 15].map((x) => <Lounger key={x} p={[x, 0.55, 16.4]} stage={5} />)}
          <Box p={[13, 0.2, -16]} s={[6, 3, 4]} m="coral" stage={2} />
          <Box p={[13, 3.2, -16]} s={[7, 0.3, 5]} stage={3} anim="drop" />
          {([[-20, -2], [-20, 3], [19.5, -12], [6, -16]] as const).map(([x, z], i) => <Palm key={i} p={[x, 0.2, z]} h={8} stage={5} />)}
        </>
      )
    }

    // ── Esporte ────────────────────────────────────────────────
    case 'tennis': // quadra oficial 23,77×10,97 m em saibro
      return (
        <Court W={W} D={D} floor="coral">
          {[11.885, -11.885].map((x) => <Mark key={x} p={[x, 0.15, 0]} lx={0.1} lz={10.97} />)}
          {[5.485, -5.485, 4.115, -4.115].map((z) => <Mark key={z} p={[0, 0.15, z]} lx={23.77} lz={0.1} />)}
          {[6.4, -6.4].map((x) => <Mark key={x} p={[x, 0.15, 0]} lx={0.1} lz={8.23} />)}
          <Mark p={[0, 0.15, 0]} lx={12.8} lz={0.1} />
          <Box p={[0, 0.15, 0]} s={[0.06, 0.92, 12.8]} m="ink" stage={2} />
          {[6.4, -6.4].map((z) => <Cyl key={z} p={[0, 0.15, z]} r={0.07} h={1.07} m="ink" seg={8} stage={2} />)}
        </Court>
      )
    case 'beach': // 16×8 m na areia, rede a 1,70 m
      return (
        <>
          <Box s={[W - 0.8, 0.2, D - 0.8]} m="sand" anim="spread" />
          {[8, -8].map((x) => <Mark key={x} p={[x, 0.2, 0]} lx={0.1} lz={8} m="ink" />)}
          {[4, -4].map((z) => <Mark key={z} p={[0, 0.2, z]} lx={16} lz={0.1} m="ink" />)}
          {[4.6, -4.6].map((z) => <Cyl key={z} p={[0, 0.2, z]} r={0.07} h={1.7} m="ink" seg={8} stage={2} />)}
          <Box p={[0, 1.2, 0]} s={[0.04, 0.7, 9.2]} m="ink" edges={false} stage={2} />
          {[9, -9].map((x) => (
            <group key={x}>
              <Cyl p={[x, 0.2, -6.6]} r={0.1} h={7} m="ink" seg={8} stage={3} />
              <Box p={[x * 0.97, 7.2, -6.3]} s={[0.8, 0.35, 0.6]} m="coral" stage={4} anim="pop" />
            </group>
          ))}
        </>
      )
    case 'padel': // 20×10 m, fundos de vidro e laterais com tela
      return (
        <Court W={W} D={D} floor="ink" fence={null}>
          {[6.95, -6.95].map((x) => <Mark key={x} p={[x, 0.15, 0]} lx={0.1} lz={8.9} />)}
          <Mark p={[0, 0.15, 0]} lx={13.9} lz={0.1} />
          <Box p={[0, 0.15, 0]} s={[0.05, 0.88, 9.1]} stage={2} />
          {[9.2, -9.2].map((x) => <Box key={x} p={[x, 0.15, 0]} s={[0.12, 3, 9.2]} stage={3} />)}
          {[4.55, -4.55].map((z) => (
            <group key={z}>
              <Fence p={[0, 0.15, z]} len={14.4} h={3} />
              {[8.2, -8.2].map((x) => <Box key={x} p={[x, 0.15, z]} s={[2, 3, 0.12]} stage={3} />)}
            </group>
          ))}
        </Court>
      )
    case 'multi': // 28×15 m, tabelas de basquete
      return (
        <Court W={W} D={D} floor="ink" fence={3}>
          {[14, -14, 0].map((x) => <Mark key={x} p={[x, 0.15, 0]} lx={0.1} lz={15} />)}
          {[7.5, -7.5].map((z) => <Mark key={z} p={[0, 0.15, z]} lx={28} lz={0.1} />)}
          <Ring p={[0, 0.15, 0]} r={1.8} t={0.1} />
          {[1, -1].map((s) => (
            <group key={s}>
              <Box p={[s * 14.15, 0.15, 0]} s={[0.25, 3.4, 0.25]} stage={2} />
              <Box p={[s * 13.75, 3.2, 0]} s={[0.8, 0.12, 0.12]} stage={3} />
              <Box p={[s * 13.4, 2.55, 0]} s={[0.1, 1.05, 1.8]} m="coral" stage={3} />
            </group>
          ))}
        </Court>
      )
    case 'society': // campo 46×26 m em grama sintética
      return (
        <Court W={W} D={D} floor="grass" fence={null}>
          {[23, -23, 0].map((x) => <Mark key={x} p={[x, 0.15, 0]} lx={0.14} lz={26} m="coral" />)}
          {[13, -13].map((z) => <Mark key={z} p={[0, 0.15, z]} lx={46} lz={0.14} m="coral" />)}
          <Ring p={[0, 0.15, 0]} r={4.5} t={0.14} m="coral" />
          {[1, -1].map((s) => (
            <group key={s}>
              <Mark p={[s * 17, 0.15, 0]} lx={0.14} lz={14} m="coral" />
              {[7, -7].map((z) => <Mark key={z} p={[s * 20, 0.15, z]} lx={6} lz={0.14} m="coral" />)}
              {[1.6, -1.6].map((z) => <Box key={z} p={[s * 23, 0.15, z]} s={[0.12, 2.1, 0.12]} stage={2} />)}
              <Box p={[s * 23, 2.25, 0]} s={[0.12, 0.12, 3.32]} stage={3} />
              <Fence p={[s * 24.5, 0.15, 0]} ry={Math.PI / 2} len={28.8} h={4} />
              {[14, -14].map((z) => (
                <group key={z}>
                  <Cyl p={[s * 23.6, 0.15, z]} r={0.15} h={12} m="ink" seg={8} stage={3} />
                  <Box p={[s * 23.6, 12.1, z * 0.97]} s={[1.2, 0.5, 0.8]} m="coral" stage={4} anim="pop" />
                </group>
              ))}
            </group>
          ))}
        </Court>
      )
    case 'minigolf':
      return (
        <>
          <Pad W={W} D={D} m="grass" h={0.2} />
          <Box p={[-4, 0.2, -8]} s={[14, 0.12, 2.4]} stage={1} anim="spread" />
          <Box p={[4.8, 0.2, -1]} s={[2.4, 0.12, 12]} stage={1} anim="spread" />
          <Box p={[-8.5, 0.2, 3]} s={[2.4, 0.12, 10]} stage={1} anim="spread" />
          <Box p={[-1, 0.2, 8.5]} s={[14, 0.12, 2.4]} stage={1} anim="spread" />
          <Water p={[0, 0.2, 1.5]} w={4} d={3} h={0.1} stage={2} />
          {([[-10, -8], [4.8, 4.5], [-8.5, 7.5], [5.5, 8.5]] as const).map(([x, z], i) => (
            <group key={i}>
              <Cyl p={[x, 0.32, z]} r={0.3} h={0.03} m="ink" seg={12} edges={false} stage={2} />
              <Box p={[x, 0.32, z]} s={[0.05, 1.5, 0.05]} m="ink" edges={false} stage={3} />
              <Box p={[x + 0.31, 1.4, z]} s={[0.6, 0.4, 0.03]} m="coral" stage={4} anim="pop" />
            </group>
          ))}
          <Box p={[8.5, 0.2, -8.5]} s={[2, 3, 2]} m="coral" stage={2} />
          <Hip p={[8.5, 3.2, -8.5]} w={2.6} d={2.6} h={1.8} stage={3} />
          <Box p={[8.5, 1.2, -7.47]} s={[0.3, 3.6, 0.08]} stage={4} anim="pop" />
          <Box p={[8.5, 2.85, -7.47]} s={[3.6, 0.3, 0.08]} stage={4} anim="pop" />
          {([[10, 2], [-10, -2], [9, 10]] as const).map(([x, z], i) => <Tree key={i} p={[x, 0.2, z]} h={3.5} stage={4} />)}
        </>
      )
    case 'gym':
      return <Building W={W} D={D} bw={12.4} bd={8} floors={1} gh={4.6} />

    // ── Gastronomia ────────────────────────────────────────────
    case 'buffet': // salão de 24×12 m com varanda de mesas
      return (
        <>
          <Building W={W} D={D} bw={24} bd={12} bz={-3} floors={1} gh={5.4} roof="gable" roofH={4} canopy={null} />
          <Box p={[0, 0.25, 6.2]} s={[24, 0.2, 5.8]} stage={2} anim="spread" />
          {[-9, -3, 3, 9].map((x) => (
            <group key={x}>
              <Table p={[x, 0.45, 6.2]} />
              <Umbrella p={[x, 0.45, 6.2]} />
            </group>
          ))}
        </>
      )
    case 'alacarte':
      return (
        <>
          <Building W={W} D={D} bw={12} bd={8.5} bz={-1.8} floors={1} gh={4.2} roof="hip" roofM="coral" roofH={3.4} canopy={null} />
          <Box p={[0, 0.25, 4.8]} s={[15, 0.2, 4.4]} stage={2} anim="spread" />
          {[-5, 0, 5].map((x) => (
            <group key={x}>
              <Table p={[x, 0.45, 4.9]} />
              <Umbrella p={[x, 0.45, 4.9]} />
            </group>
          ))}
          <Tree p={[-8, 0.25, -5]} h={5.5} />
          <Tree p={[8, 0.25, -5]} h={5} />
        </>
      )
    case 'poolbar':
      return (
        <>
          <Pad W={W} D={D} m="sand" h={0.2} />
          <Cyl p={[0, 0.2, 0]} r={2.3} h={1.15} m="coral" seg={24} stage={1} />
          <Posts x={1.5} z={1.5} y={1.35} h={2.1} stage={2} />
          <Hip p={[0, 3.45, 0]} w={6.2} d={6.2} h={2.2} m="cream" stage={3} />
          {Array.from({ length: 7 }, (_, i) => {
            const a = (i / 7) * Math.PI * 2
            return <Cyl key={i} p={[Math.cos(a) * 3.1, 0.2, Math.sin(a) * 3.1]} r={0.25} h={0.75} m="ink" seg={10} stage={4} anim="pop" />
          })}
        </>
      )
    case 'lounge': // salão envidraçado + pérgola coral sobre o deck
      return (
        <>
          <Building W={W} D={D} bx={-3} bw={8} bd={7.6} floors={1} gh={3.8} canopy={null} />
          <Box p={[4.4, 0.25, 0]} s={[5.4, 0.2, 8.6]} stage={2} anim="spread" />
          {[[2, -3.9], [6.8, -3.9], [2, 3.9], [6.8, 3.9]].map(([x, z], i) => (
            <Box key={i} p={[x, 0.45, z]} s={[0.18, 2.9, 0.18]} m="ink" edges={false} stage={3} />
          ))}
          {[-3.9, 3.9].map((z) => <Box key={z} p={[4.4, 3.35, z]} s={[5, 0.2, 0.2]} m="ink" stage={3} />)}
          {[2.2, 3.4, 4.6, 5.8].map((x) => <Box key={x} p={[x, 3.55, 0]} s={[0.2, 0.2, 8.4]} m="coral" stage={4} anim="drop" />)}
          {[-1.6, 1.6].map((z) => <Box key={z} p={[4.4, 0.45, z]} s={[3.6, 0.5, 1]} stage={4} anim="pop" />)}
        </>
      )
    case 'kiosk':
      return (
        <>
          <Pad W={W} D={D} m="sand" h={0.2} />
          <Box p={[-2, 0.2, 0]} s={[3.6, 2.6, 3]} m="coral" stage={1} />
          <Box p={[-2, 1.1, 1.52]} s={[2.4, 1, 0.1]} m="ink" edges={false} stage={2} />
          <Box p={[-2, 2.8, 0]} s={[4.6, 0.25, 3.6]} stage={2} anim="drop" />
          <Table p={[2.4, 0.2, 0]} />
          <Umbrella p={[2.4, 0.2, 0]} m="coral" />
        </>
      )

    // ── Bem-estar ──────────────────────────────────────────────
    case 'spa':
      return (
        <>
          <Pad W={W} D={D} m="sand" h={0.2} />
          <Box p={[-5, 0.2, -3]} s={[16, 3.8, 10]} stage={1} />
          <Box p={[-5, 0.5, 2.02]} s={[12, 3, 0.1]} m="glass" edges={false} stage={2} />
          <Box p={[-5, 4, -3]} s={[18, 0.35, 12]} m="ink" stage={2} anim="drop" />
          <Box p={[1.5, 0.2, 0.5]} s={[3, 5.4, 3]} m="coral" stage={3} />
          <Basin p={[9, 0.2, -4]} ow={9} od={9} ww={7} wd={7} stage={2} />
          <Tub p={[7, 0.2, 5.5]} r={1.5} stage={3} />
          <Tub p={[11, 0.2, 5.5]} r={1.5} stage={3} />
          {([[-10, 6], [-7, 7.2], [-8.6, 5]] as const).map(([x, z], i) => <Ico key={i} p={[x, 0.2, z]} r={0.6} stage={4} />)}
          <Tree p={[13, 0.2, 6.5]} h={6} stage={4} />
          <Tree p={[-13, 0.2, 6.5]} h={5} stage={4} />
        </>
      )
    case 'sauna':
      return (
        <>
          <Pad W={W} D={D} h={0.2} />
          <Box p={[-1.6, 0.2, 0]} s={[5, 2.6, 3.4]} m="ink" stage={1} />
          <Box p={[-1.6, 0.2, 1.72]} s={[0.9, 2, 0.08]} edges={false} stage={2} />
          <Gable p={[-1.6, 2.8, 0]} ry={Math.PI / 2} w={4} d={5.6} h={1.5} m="coral" stage={2} />
          <Tub p={[2.8, 0.2, 0]} r={1.1} stage={2} />
        </>
      )

    // ── Família ────────────────────────────────────────────────
    case 'kids':
      return (
        <>
          <Pad W={W} D={D} m="grass" h={0.2} />
          <Box p={[-3.5, 0.2, -2.5]} s={[10, 3.6, 8]} stage={1} />
          <Box p={[-3, 1, 1.52]} s={[6, 1.6, 0.1]} m="glass" edges={false} stage={2} />
          <Box p={[-7.4, 0.2, 1.52]} s={[1.2, 2.2, 0.1]} m="coral" edges={false} stage={2} />
          <Hip p={[-3.5, 3.8, -2.5]} w={11.2} d={9.2} h={3.4} m="coral" stage={2} />
          <Box p={[5.8, 0.2, 2.5]} s={[7.4, 0.12, 8]} m="sand" stage={1} anim="spread" />
          <Box p={[6.8, 0.32, 0.8]} s={[2, 2, 2]} stage={2} />
          <Hip p={[6.8, 2.32, 0.8]} w={2.4} d={2.4} h={1.4} m="coral" stage={3} />
          <Tube pts={[[6.8, 2.1, 1.8], [6.8, 1.3, 3.4], [6.6, 0.45, 5.2]]} r={0.3} m="cream" stage={3} />
          <Fence p={[5.8, 0.2, 6.55]} len={7.4} h={1} />
          <Fence p={[9.5, 0.2, 2.5]} ry={Math.PI / 2} len={8} h={1} />
        </>
      )
    case 'playground':
      return (
        <>
          <Pad W={W} D={D} m="sand" h={0.2} />
          <Box p={[-5.5, 0.2, -2.5]} s={[3, 2.6, 3]} m="coral" stage={1} />
          <Hip p={[-5.5, 2.8, -2.5]} w={3.6} d={3.6} h={1.8} stage={2} />
          <Tube pts={[[-4, 2.5, -2.5], [-2.2, 1.6, -2.3], [0, 0.5, -1.8]]} r={0.4} m="cream" stage={3} />
          {[2.5, 8.5].map((x) => <Box key={x} p={[x, 0.2, -4]} s={[0.18, 2.8, 0.18]} m="ink" edges={false} stage={2} />)}
          <Box p={[5.5, 3, -4]} s={[6.2, 0.18, 0.18]} m="ink" edges={false} stage={3} />
          {[4.2, 6.8].map((x) => (
            <group key={x}>
              {[-0.4, 0.4].map((dx) => <Box key={dx} p={[x + dx, 1.15, -4]} s={[0.04, 1.85, 0.04]} m="ink" edges={false} stage={4} />)}
              <Box p={[x, 1.1, -4]} s={[1, 0.1, 0.5]} m="coral" stage={4} />
            </group>
          ))}
          <Box p={[5, 0.2, 3.5]} s={[0.4, 0.6, 0.4]} m="ink" stage={2} />
          <Box p={[5, 0.8, 3.5]} s={[4.2, 0.12, 0.45]} m="coral" stage={3} />
          <Cyl p={[-4.5, 0.2, 4]} r={1.8} h={0.35} seg={20} stage={2} />
          <Cyl p={[-4.5, 0.55, 4]} r={0.12} h={1.1} m="ink" seg={8} stage={3} />
          <Cyl p={[-4.5, 1.65, 4]} r={0.6} h={0.1} m="coral" seg={12} stage={4} />
          <Box p={[0, 0.2, 6]} s={[2.4, 0.5, 0.5]} stage={3} />
          <Tree p={[8, 0.2, 5]} h={6} stage={4} />
        </>
      )
    case 'games':
      return <Building W={W} D={D} bw={12} bd={7.5} floors={1} gh={4.2} roof="gable" roofM="coral" roofH={2.8} canopy="ink" />

    // ── Serviços ───────────────────────────────────────────────
    case 'lobby': // pé-direito duplo, marquise de embarque e bandeiras
      return (
        <>
          <Building W={W} D={D} bw={20} bd={11} bz={-3.5} floors={2} gh={5.2} fh={4} canopy={null} />
          <Box p={[0, 0.25, 6.9]} s={[18, 0.06, 4.6]} m="asphalt" stage={1} anim="spread" />
          {[-4.8, 4.8].map((x) => <Box key={x} p={[x, 0.25, 7.4]} s={[0.45, 4.35, 0.45]} m="ink" stage={2} />)}
          <Box p={[0, 4.6, 5]} s={[11, 0.45, 6.2]} m="coral" stage={3} anim="drop" />
          {[9.9, 10.9, 11.8].map((x) => (
            <group key={x}>
              <Cyl p={[x, 0.25, 8.9]} r={0.07} h={9} m="ink" seg={6} stage={3} />
              <Box p={[x - 0.8, 7.6, 8.9]} s={[1.5, 1, 0.04]} m="coral" stage={4} anim="pop" />
            </group>
          ))}
        </>
      )
    case 'convention':
      return (
        <>
          <Building W={W} D={D} bw={34} bd={21} bz={-2} floors={2} gh={5.5} fh={5} roofM="coral" canopy="ink" rooftop={false} />
          {[-8, 8].map((x) => <Box key={x} p={[x, 11.15, -2]} s={[8, 1.2, 6]} m="glass" stage={5} anim="pop" />)}
        </>
      )
    case 'theater': // plateia em tambor, caixa cênica coral e marquise
      return (
        <>
          <Pad W={W} D={D} />
          <Cyl p={[-2, 0.25, -1]} r={8} h={7} seg={36} stage={1} />
          <Cyl p={[-2, 7.25, -1]} r={8.6} rt={3.4} h={3} m="ink" seg={36} stage={2} anim="drop" />
          <Box p={[7, 0.25, -1]} s={[5, 11, 9.5]} m="coral" stage={2} />
          {[-5.5, 1.5].map((x) => <Box key={x} p={[x, 0.25, 8.6]} s={[0.3, 3.35, 0.3]} stage={2} />)}
          <Box p={[-2, 3.6, 8]} s={[8, 0.3, 2.6]} m="ink" stage={3} anim="drop" />
        </>
      )
    case 'parking': { // 40 vagas de 2,5×5 m em duas fileiras
      const cars: [number, number, MatKey][] = [
        [-18.75, -7.1, 'coral'], [-13.75, -7.1, 'cream'], [-11.25, -7.1, 'coral'], [-3.75, -7.1, 'cream'],
        [1.25, -7.1, 'coral'], [8.75, -7.1, 'cream'], [13.75, -7.1, 'coral'], [-16.25, 7.1, 'cream'],
        [-8.75, 7.1, 'coral'], [-6.25, 7.1, 'cream'], [3.75, 7.1, 'cream'], [11.25, 7.1, 'coral'], [16.25, 7.1, 'cream'],
      ]
      return (
        <>
          <Box s={[W - 0.8, 0.12, D - 0.8]} m="asphalt" anim="spread" />
          {Array.from({ length: 17 }, (_, i) => [-7.1, 7.1].map((z) => (
            <Mark key={`${i}/${z}`} p={[-20 + i * 2.5, 0.12, z]} lx={0.12} lz={5} />
          )))}
          {[-4.6, 4.6].map((z) => <Mark key={z} p={[0, 0.12, z]} lx={42.5} lz={0.12} />)}
          {cars.map(([x, z, m], i) => <Car key={i} x={x} z={z} m={m} stage={2 + (i % 3)} />)}
          {[-23.4, 23.4].map((x) => <Tree key={x} p={[x, 0.12, 0]} h={6} stage={4} />)}
        </>
      )
    }
    case 'heli':
      return (
        <>
          <Pad W={W} D={D} m="grass" h={0.2} />
          <Cyl p={[0, 0.2, 0]} r={10} h={0.3} m="ink" seg={40} stage={1} anim="spread" />
          <Ring p={[0, 0.5, 0]} r={8.4} t={0.5} stage={2} />
          {[-2.1, 2.1].map((x) => <Mark key={x} p={[x, 0.5, 0]} lx={0.9} lz={6.4} m="coral" stage={3} />)}
          <Mark p={[0, 0.5, 0]} lx={3.3} lz={0.9} m="coral" stage={3} />
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2
            return <Cyl key={i} p={[Math.cos(a) * 9.5, 0.5, Math.sin(a) * 9.5]} r={0.15} h={0.3} m="coral" seg={8} stage={3} anim="pop" />
          })}
          <Cyl p={[10.5, 0.2, -10.5]} r={0.07} h={5} m="ink" seg={6} stage={3} />
          <Part p={[10.5, 4.6, -10.5]} stage={4} anim="pop">
            <mesh geometry={cylGeo(0.43, 10)} rotation-z={Math.PI / 2} scale={[0.35, 1.8, 0.35]} material={mat.coral}>
              <Edges threshold={30} />
            </mesh>
          </Part>
        </>
      )
    case 'pier': // píer de 28 m sobre estacas, com dois barcos
      return (
        <>
          <Water p={[0, 0, 0]} w={W - 0.2} d={D - 0.2} h={0.4} stage={0} />
          {[-12.5, -7.5, -2.5, 2.5, 7.5, 12.5].map((z) => [-1.4, 1.4].map((x) => (
            <Cyl key={`${x}/${z}`} p={[x, 0, z]} r={0.18} h={1.6} m="ink" seg={8} stage={1} />
          )))}
          <Box p={[0, 1.6, 0.5]} s={[3.4, 0.25, 27]} stage={2} anim="spread" />
          <Box p={[0, 1.6, -12.6]} s={[8.6, 0.25, 2.6]} stage={2} anim="spread" />
          {[-8, 0, 8].map((z, i) => (
            <group key={z}>
              <Cyl p={[i % 2 ? 1.55 : -1.55, 1.85, z]} r={0.05} h={2.2} m="ink" seg={6} edges={false} stage={3} />
              <Box p={[i % 2 ? 1.55 : -1.55, 4.05, z]} s={[0.35, 0.3, 0.35]} m="coral" stage={4} anim="pop" />
            </group>
          ))}
          <Hull p={[3.1, 0.25, 3]} m="cream" stage={3} />
          <Box p={[3.1, 0.6, 2.6]} s={[1.2, 0.8, 1.6]} m="coral" stage={4} />
          <Hull p={[-3.1, 0.25, -5]} m="ink" stage={4} />
          <Box p={[-3.1, 0.6, -5.4]} s={[1.2, 0.8, 1.6]} stage={5} />
        </>
      )

    // ── Natureza ───────────────────────────────────────────────
    case 'garden': // caminhos em cruz, chafariz, sebes e árvores
      return (
        <>
          <Pad W={W} D={D} m="grass" h={0.2} />
          {[-9, 9].map((z) => <Box key={`v${z}`} p={[0, 0.2, z]} s={[2.4, 0.08, 10]} stage={1} anim="spread" />)}
          {[-9, 9].map((x) => <Box key={`h${x}`} p={[x, 0.2, 0]} s={[10, 0.08, 2.4]} stage={1} anim="spread" />)}
          <Cyl p={[0, 0.2, 0]} r={4} h={0.08} seg={32} stage={1} anim="spread" />
          <Tub p={[0, 0.28, 0]} r={2.8} stage={2} />
          <Cyl p={[0, 0.28, 0]} r={0.35} h={2.2} seg={12} stage={3} />
          <Cyl p={[0, 2.48, 0]} r={1.1} h={0.25} m="coral" seg={16} stage={4} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Box p={[s * 9, 0.2, 2.6]} s={[9, 0.9, 0.8]} stage={2} />
              <Box p={[s * 9, 0.2, -2.6]} s={[9, 0.9, 0.8]} stage={2} />
              <Box p={[2.6, 0.2, s * 9]} s={[0.8, 0.9, 9]} stage={2} />
              <Box p={[-2.6, 0.2, s * 9]} s={[0.8, 0.9, 9]} stage={2} />
            </group>
          ))}
          {([[8.5, 8.5, 7], [-8.5, 8.5, 6], [8.5, -8.5, 6.5], [-8.5, -8.5, 7], [12, 12, 5], [-12, 12, 5], [12, -12, 5], [-12, -12, 5]] as const).map(([x, z, h], i) => (
            <Tree key={i} p={[x, 0.2, z]} h={h} stage={3 + (i % 2)} />
          ))}
        </>
      )
    case 'lake': // lago elíptico com praia, ponte de madeira e gazebo
      return (
        <>
          <Pad W={W} D={D} m="grass" h={0.2} />
          <Disc p={[0, 0.2, 0]} rx={17} rz={12} h={0.1} m="sand" stage={1} />
          <Disc p={[0, 0.2, 0]} rx={15.4} rz={10.6} h={0.4} m="water" stage={2} anim="fill" />
          <Box p={[6, 0.5, 0]} s={[2.6, 0.3, 24]} stage={3} anim="spread" />
          {[4.8, 7.2].map((x) => <Fence key={x} p={[x, 0.8, 0]} ry={Math.PI / 2} len={24} h={0.9} stage={4} />)}
          <Cyl p={[-16, 0.2, -11]} r={2.4} h={0.3} seg={16} stage={2} />
          <Posts x={1.5} z={1.5} cx={-16} cz={-11} y={0.5} h={2.5} stage={3} />
          <Hip p={[-16, 3, -11]} w={5} d={5} h={2} m="coral" stage={4} />
          {([[16, -11, 7], [-16, 10, 6], [16, 11, 6], [0, -13.2, 5]] as const).map(([x, z, h], i) => (
            <Tree key={i} p={[x, 0.2, z]} h={h} stage={4} />
          ))}
        </>
      )
    case 'veg': // canteiros elevados e estufa
      return (
        <>
          <Pad W={W} D={D} h={0.2} />
          {[-8, -5, -2, 1].map((x, b) => (
            <group key={x}>
              <Box p={[x, 0.2, 0]} s={[1.6, 0.5, 11]} m="ink" stage={1} />
              {Array.from({ length: 7 }, (_, i) => (
                <Ico key={i} p={[x, 0.6, -4.5 + i * 1.5]} r={0.45} m={i % 2 ? 'coral' : 'cream'} stage={2 + (b % 2)} />
              ))}
            </group>
          ))}
          <Box p={[6.5, 0.2, 0]} s={[5.5, 1.4, 10]} m="glass" stage={2} />
          <Gable p={[6.5, 1.6, 0]} w={5.5} d={10} h={2.2} m="glass" stage={3} />
        </>
      )
    case 'palm':
      return (
        <>
          <Pad W={W} D={D} m="sand" h={0.2} />
          <Palm p={[0, 0.2, 0]} h={9} stage={1} />
        </>
      )
  }
  return <LandscapeModel id={id} W={W} D={D} links={links} rot={rot} />
}

// `links`: vizinhos iguais (n, e, s, w) das peças de ligação; `rot` orienta o trecho isolado
export function Model({ id, w, d, links = '', rot = 0 }: { id: string; w: number; d: number; links?: string; rot?: Rot }) {
  return (
    <group scale={1 / CELL_METERS}>
      <ModelM id={id} W={w * CELL_METERS} D={d * CELL_METERS} links={links} rot={rot} />
    </group>
  )
}
