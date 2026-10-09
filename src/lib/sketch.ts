import { TIERS, type Placed } from './valuation'
import type { SketchItem } from '../store'
import { DESTINOS, EMPTY_SPEC, PUBLICOS, type Spec } from './spec'

// Esboço salvo: um JSON com o nome do hotel, a lista de itens (id do catálogo, célula e rotação)
// e, quando houver, os campos do modo analista e as respostas do checklist.
const APP = 'roomi-resort-builder'

export interface Analysis { spec: Spec; checks: Record<string, boolean> }

export function downloadSketch(hotelName: string, placed: Placed[], analysis: Analysis) {
  const data = {
    app: APP,
    version: 1,
    savedAt: new Date().toISOString(),
    hotelName,
    items: placed.map((p) => ({ id: p.itemId, x: p.x, z: p.z, rot: p.rot })),
    analysis,
  }
  const slug = hotelName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  a.download = `${slug || 'esboco'}.roomi.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return a.download
}

const isItem = (v: unknown): v is SketchItem => {
  const it = v as SketchItem
  return typeof it?.id === 'string' && Number.isInteger(it.x) && Number.isInteger(it.z) && [0, 1, 2, 3].includes(it.rot)
}

const pick = <T extends string>(v: unknown, ids: { id: T }[]) => (ids.some((o) => o.id === v) ? (v as T) : null)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

// Campos do analista: o que não for válido volta vazio
function readAnalysis(v: unknown): Analysis {
  const a = v as { spec?: Record<string, unknown>; checks?: Record<string, unknown> } | undefined
  const s = a?.spec ?? {}
  const checks = Object.fromEntries(Object.entries(a?.checks ?? {}).filter(([, on]) => typeof on === 'boolean')) as Record<string, boolean>
  return {
    spec: {
      ...EMPTY_SPEC,
      destino: pick(s.destino, DESTINOS),
      categoria: pick(s.categoria, TIERS as { id: Spec['categoria'] & string }[]),
      publico: pick(s.publico, PUBLICOS),
      uhs: num(s.uhs), adr: num(s.adr), ocupacao: num(s.ocupacao), orcamento: num(s.orcamento),
    },
    checks,
  }
}

// Lê o arquivo; itens malformados ficam de fora e entram na contagem `invalid`
export function parseSketch(text: string): { hotelName: string; items: SketchItem[]; invalid: number } & Analysis {
  let data: { app?: unknown; hotelName?: unknown; items?: unknown; analysis?: unknown }
  try { data = JSON.parse(text) } catch { throw new Error('O arquivo não é um JSON válido.') }
  if (data?.app !== APP || !Array.isArray(data.items)) throw new Error('O arquivo não é um esboço do Resort Builder.')
  const items = data.items.filter(isItem)
  return {
    hotelName: typeof data.hotelName === 'string' && data.hotelName.trim() ? data.hotelName : 'Meu Resort',
    items,
    invalid: data.items.length - items.length,
    ...readAnalysis(data.analysis),
  }
}
