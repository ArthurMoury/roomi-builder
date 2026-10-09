import { ITEM_BY_ID, type Cat, type Tag } from '../data/catalog'

// Categorias de mercado. ADR e ocupação 2025: Panorama da Hotelaria Brasileira 2026 (HotelInvest/FOHB)
// para econômico/midscale/upscale; Anuário BLTA 2026 para luxo; Resorts Brasil/JLL para ocupação de resort.
// ADR de resort e de resort all inclusive são estimativas (não há dado setorial aberto).
export interface Tier {
  id: string
  name: string
  adr: number
  occ: number
  costPerKey: number
  reqs: { label: string; ok: (s: Stats) => boolean }[]
}

export interface Stats {
  keys: number
  luxKeys: number
  count: (t: Tag) => number
}

const ECO: Tier['reqs'] = [{ label: 'Ao menos 1 UH', ok: (s) => s.keys > 0 }]
const MID: Tier['reqs'] = [
  ...ECO,
  { label: 'Recepção / lobby', ok: (s) => s.count('lobby') > 0 },
  { label: 'Restaurante', ok: (s) => s.count('restaurant') > 0 },
  { label: 'Academia', ok: (s) => s.count('gym') > 0 },
]
const UP: Tier['reqs'] = [
  ...MID,
  { label: 'Piscina', ok: (s) => s.count('pool') > 0 },
  { label: 'Bar ou lounge', ok: (s) => s.count('bar') > 0 },
  { label: 'Restaurante à la carte', ok: (s) => s.count('alacarte') > 0 },
  { label: 'Eventos ou spa', ok: (s) => s.count('events') + s.count('spa') > 0 },
]
const RESORT: Tier['reqs'] = [
  ...UP,
  { label: '2 ou mais piscinas', ok: (s) => s.count('pool') >= 2 },
  { label: 'Kids club', ok: (s) => s.count('kids') > 0 },
  { label: '2 ou mais quadras', ok: (s) => s.count('court') >= 2 },
  { label: 'Área verde (jardim, lago ou horta)', ok: (s) => s.count('nature') > 0 },
]
const AI: Tier['reqs'] = [
  ...RESORT,
  { label: 'Restaurante buffet', ok: (s) => s.count('buffet') > 0 },
  { label: '3 ou mais restaurantes', ok: (s) => s.count('restaurant') >= 3 },
  { label: 'Bar molhado', ok: (s) => s.count('swimup') > 0 },
  { label: 'Bar de piscina', ok: (s) => s.count('poolbar') > 0 },
  { label: 'Teatro de shows', ok: (s) => s.count('shows') > 0 },
  { label: 'Parque aquático', ok: (s) => s.count('waterpark') > 0 },
]
const LUX: Tier['reqs'] = [
  ...ECO,
  { label: 'Recepção / lobby', ok: (s) => s.count('lobby') > 0 },
  { label: 'Restaurante à la carte', ok: (s) => s.count('alacarte') > 0 },
  { label: 'Spa', ok: (s) => s.count('spa') > 0 },
  { label: 'Villa ou piscina de borda infinita', ok: (s) => s.count('villa') + s.count('infinity') > 0 },
  { label: 'Heliponto ou marina', ok: (s) => s.count('heli') + s.count('marina') > 0 },
  { label: 'Metade das UHs de alto padrão', ok: (s) => s.keys > 0 && s.luxKeys / s.keys >= 0.5 },
]

export const TIERS: Tier[] = [
  { id: 'eco', name: 'Econômico', adr: 319, occ: 0.608, costPerKey: 180_000, reqs: ECO },
  { id: 'mid', name: 'Midscale', adr: 489, occ: 0.629, costPerKey: 485_000, reqs: MID },
  { id: 'up', name: 'Upscale', adr: 807, occ: 0.616, costPerKey: 930_000, reqs: UP },
  { id: 'resort', name: 'Resort', adr: 1200, occ: 0.6, costPerKey: 800_000, reqs: RESORT },
  { id: 'ai', name: 'Resort All Inclusive', adr: 1600, occ: 0.65, costPerKey: 900_000, reqs: AI },
  { id: 'lux', name: 'Luxo', adr: 3109, occ: 0.5, costPerKey: 2_000_000, reqs: LUX },
]

// Rotação em quartos de volta: 0°, 90°, 180°, 270°
export type Rot = 0 | 1 | 2 | 3

export interface Placed { uid: string; itemId: string; x: number; z: number; rot: Rot }

export function evaluate(placed: Placed[]) {
  const counts = new Map<Tag, number>()
  let cost = 0, keys = 0, luxKeys = 0, adrWeight = 0
  const byCat = new Map<Cat, number>()
  const amenities = new Set<string>()

  for (const p of placed) {
    const it = ITEM_BY_ID[p.itemId]
    cost += it.cost
    byCat.set(it.cat, (byCat.get(it.cat) ?? 0) + it.cost)
    for (const t of it.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    if (it.keys) {
      keys += it.keys
      adrWeight += it.keys * (it.adrMult ?? 1)
      if (it.tags.includes('lux')) luxKeys += it.keys
    } else if (!it.decor) {
      amenities.add(it.id)
    }
  }

  const stats: Stats = { keys, luxKeys, count: (t) => counts.get(t) ?? 0 }
  let tierIdx = -1
  TIERS.forEach((t, i) => { if (t.reqs.every((r) => r.ok(stats))) tierIdx = i })
  const tier = tierIdx >= 0 ? TIERS[tierIdx] : null
  const next = tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1] : null

  // Diária: base da categoria × mix de UHs (amortecido) × bônus de amenidades (até +12%).
  const mix = keys ? adrWeight / keys : 1
  const mixFactor = Math.sqrt(Math.min(Math.max(mix, 0.85), 2.6))
  const bonus = 1 + Math.min(0.12, amenities.size * 0.01)
  const adr = tier ? tier.adr * mixFactor * bonus : 0
  const occ = tier?.occ ?? 0
  const revpar = adr * occ
  const revenue = keys * 365 * revpar

  return {
    cost, keys, luxKeys, byCat, tier, tierIdx, next, stats,
    adr, occ, revpar, revenue, mix, mixFactor, bonus, amenities: amenities.size,
    costPerKey: keys ? cost / keys : 0,
    nextReqs: next ? next.reqs.map((r) => ({ label: r.label, ok: r.ok(stats) })) : [],
  }
}

export type Evaluation = ReturnType<typeof evaluate>

export function money(v: number) {
  if (v >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`
  if (v >= 1e5) return `R$ ${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}
