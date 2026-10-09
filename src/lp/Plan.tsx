import { useId } from 'react'
import { GRID, footprint, type TemplateId } from '../store'
import { ITEM_BY_ID } from '../data/catalog'
import { TEMPLATES, type Role } from '../lib/autoplace'
import type { Placed } from '../lib/valuation'

// Plantas vistas de cima, só com planos chapados, contorno fino e meio-tom, nas três cores. A do
// resort é a imagem estática da LP enquanto o 3D carrega (ou quando ele não roda); as dos modelos
// de implantação mostram como cada desenho divide o terreno.

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

const ROLE: Record<Role, { label: string; fill: (id: string) => string; text: string }> = {
  arrival: { label: 'Chegada', fill: () => CREAM, text: INK },
  core: { label: 'Lazer', fill: () => CORAL, text: INK },
  lodging: { label: 'Hospedagem', fill: () => INK, text: CREAM },
  luxury: { label: 'Luxo e spa', fill: (id) => `url(#${id}ht)`, text: INK },
  sports: { label: 'Esportes', fill: () => CREAM, text: INK },
  fun: { label: 'Diversão', fill: (id) => `url(#${id}co)`, text: INK },
}

// Zonas de um modelo de implantação, com o mar quando ele é de frente de mar (sempre ao norte aqui)
export function TemplatePlan({ t, className }: { t: TemplateId; className?: string }) {
  const id = useId().replace(/:/g, '')
  const tpl = TEMPLATES[t]
  const top = tpl.sea ? -10 : -2
  return (
    <svg className={className} viewBox={`-3 ${top} ${GRID + 6} ${GRID + 4 - top}`} role="img" aria-label={`Zonas do modelo ${tpl.name}`}>
      <Patterns id={id} />
      {tpl.sea && <SeaDots y={-10} h={8.4} />}
      <rect x={1.4} y={1.4} width={GRID} height={GRID} fill={CORAL} stroke={INK} strokeWidth={STROKE} />
      <rect width={GRID} height={GRID} fill={CREAM} stroke={INK} strokeWidth={STROKE} />
      {(Object.keys(tpl.zones) as Role[]).flatMap((role) => tpl.zones[role].map((r, k) => (
        <g key={`${role}${k}`}>
          <rect x={r.x + 0.25} y={r.z + 0.25} width={r.w - 0.5} height={r.d - 0.5} fill={ROLE[role].fill(id)} stroke={INK} strokeWidth={STROKE} />
          {k === 0 && r.w >= 6 && r.d >= 3 && (
            <text x={r.x + r.w / 2} y={r.z + r.d / 2} fill={ROLE[role].text} textAnchor="middle" dominantBaseline="central"
              fontSize="1.35" fontWeight="700" letterSpacing=".22">{ROLE[role].label.toUpperCase()}</text>
          )}
        </g>
      )))}
      <text x={GRID / 2} y={GRID + 3.2} fill={INK} textAnchor="middle" fontSize="1.2" fontWeight="700" letterSpacing=".22">CHEGADA PELO SUL</text>
    </svg>
  )
}
