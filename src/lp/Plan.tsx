import { useId } from 'react'
import { GRID, footprint } from '../store'
import { ITEM_BY_ID } from '../data/catalog'
import type { Placed } from '../lib/valuation'

// Planta do resort vista de cima, só com planos chapados, contorno fino e meio-tom, nas três cores.
// É a imagem estática da LP enquanto o 3D carrega (ou quando ele não roda).

const INK = '#1D1D1B', CORAL = '#F97B55', CREAM = '#F1E9E7'
const STROKE = 0.1

function Patterns({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}ht`} width="1" height="1" patternUnits="userSpaceOnUse"><circle cx=".5" cy=".5" r=".2" fill={INK} /></pattern>
      <pattern id={`${id}co`} width="1" height="1" patternUnits="userSpaceOnUse"><circle cx=".5" cy=".5" r=".24" fill={CORAL} /></pattern>
    </defs>
  )
}

// Mar em retícula: pontos coral crescendo para o fundo, como no 3D
function SeaDots({ y, h }: { y: number; h: number }) {
  const dots = []
  for (let r = 0; r * 1.2 < h; r++) {
    const rad = 0.12 + 0.3 * (r / (h / 1.2))
    for (let c = 0; c * 1.2 < GRID + 6; c++) dots.push(<circle key={`${r}-${c}`} cx={-3 + c * 1.2 + (r % 2) * 0.6} cy={y + h - r * 1.2 - 0.6} r={rad} />)
  }
  return <g fill={CORAL}>{dots}</g>
}

export function Plan({ items, sea, className }: { items: Placed[]; sea?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '')
  const top = sea ? -10 : -2
  return (
    <svg className={className} viewBox={`-3 ${top} ${GRID + 6} ${GRID + 4 - top}`} role="img" aria-label="Planta do resort de exemplo, vista de cima">
      <Patterns id={id} />
      {sea && <SeaDots y={-10} h={8.4} />}
      <rect x={1.4} y={1.4} width={GRID} height={GRID} fill={CORAL} stroke={INK} strokeWidth={STROKE} />
      <rect width={GRID} height={GRID} fill={CREAM} stroke={INK} strokeWidth={STROKE} />
      {items.map((p) => {
        const it = ITEM_BY_ID[p.itemId]
        const f = footprint(p.itemId, p.rot)
        if (it.cat === 'mobiliario') return null
        if (it.cat === 'natureza') return <circle key={p.uid} cx={p.x + 0.5} cy={p.z + 0.5} r={0.38} fill={CORAL} />
        const fill = it.cat === 'hospedagem' ? INK : it.cat === 'aquatico' ? CORAL : it.cat === 'caminhos' ? 'rgba(29, 29, 27, .3)' : `url(#${id}ht)`
        return <rect key={p.uid} x={p.x} y={p.z} width={f.w} height={f.d} fill={fill} stroke={it.cat === 'caminhos' ? 'none' : INK} strokeWidth={STROKE} />
      })}
    </svg>
  )
}
