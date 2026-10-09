import { create } from 'zustand'
import { ITEM_BY_ID } from './data/catalog'
import type { Placed, Rot } from './lib/valuation'
import { EMPTY_SPEC, templateOf, type Spec } from './lib/spec'

export const GRID = 40 // células de 5 m: terreno de 200 × 200 m (4 ha)

export type Theme = 'dark' | 'light'

export interface SketchItem { id: string; x: number; z: number; rot: Rot }

// Modelo de implantação que o motor de posicionamento segue (ver lib/autoplace.ts)
export type TemplateId = 'nucleo' | 'praia' | 'vila'
// O relatório vem depois do checklist de escopo (painel ao lado do mapa)
export type Modal = { type: 'report' } | { type: 'models' } | { type: 'checklist' }

interface State {
  hotelName: string              // nome do projeto, o primeiro passo do questionário
  theme: Theme
  spec: Spec                      // respostas do questionário
  checks: Record<string, boolean> // respostas do checklist de escopo
  skipped: string[]               // perguntas puladas (tarifa e ocupação do mercado, sem orçamento)
  modal: Modal | null
  explain: boolean                // explicação dos cálculos, aberta por cima de tudo
  autoTemplate: TemplateId
  placed: Placed[]
  dying: Set<string>              // itens em animação de demolição
  delays: Record<string, number>  // atraso de entrada dos itens que acabaram de chegar (cascata)
  thumbs: Record<string, string>  // imagem de cada modelo da galeria (data URL), fotografada do próprio layout
  notice: { text: string; id: number } | null
  photo: string | null            // fachada do hotel, fotografada para o relatório (three/Thumbs.tsx)
  photoReq: number                // cada pedido de relatório tira uma foto nova
  setName: (n: string) => void
  setSpec: (patch: Partial<Spec>) => void
  setCheck: (id: string, on: boolean) => void
  skip: (key: string) => void
  openModal: (type: Modal['type'] | 'explain') => void
  closeModal: () => void          // fecha a janela de cima
  setTheme: (t: Theme) => void
  setAutoTemplate: (t: TemplateId) => void
  notify: (text: string) => void
  remove: (uids: string[]) => void
  purge: (uid: string) => void
  clear: () => void
  loadItems: (name: string, items: SketchItem[], spec?: Spec, checks?: Record<string, boolean>) => number
  addItems: (items: SketchItem[], step?: number) => Placed[]
}

let seq = 0
const uid = () => `p${++seq}`

// Pegada no terreno: quartos de volta ímpares (90° e 270°) trocam largura e profundidade
export function footprint(itemId: string, rot: Rot) {
  const it = ITEM_BY_ID[itemId]
  return rot % 2 ? { w: it.d, d: it.w } : { w: it.w, d: it.d }
}

export function canPlace(placed: Placed[], dying: Set<string>, itemId: string, x: number, z: number, rot: Rot) {
  const { w, d } = footprint(itemId, rot)
  if (x < 0 || z < 0 || x + w > GRID || z + d > GRID) return false
  return placed.every((p) => {
    if (dying.has(p.uid)) return true
    const f = footprint(p.itemId, p.rot)
    return x + w <= p.x || p.x + f.w <= x || z + d <= p.z || p.z + f.d <= z
  })
}

// Vizinhos iguais de uma peça de ligação (caminho, cerca...), como 'nesw'. O índice por célula
// é montado uma vez por versão da lista, para não varrer o mapa inteiro a cada peça.
const NEIGHBORS = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]] as const
const cellIndex = new WeakMap<Placed[], Map<number, Placed>>()

export function linksOf(placed: Placed[], dying: Set<string>, p: Placed) {
  let idx = cellIndex.get(placed)
  if (!idx) {
    idx = new Map()
    for (const q of placed) if (ITEM_BY_ID[q.itemId].link) idx.set(q.x * 1000 + q.z, q)
    cellIndex.set(placed, idx)
  }
  let s = ''
  for (const [dir, dx, dz] of NEIGHBORS) {
    const q = idx.get((p.x + dx) * 1000 + p.z + dz)
    if (q && q.itemId === p.itemId && !dying.has(q.uid)) s += dir
  }
  return s
}

// Tema claro por padrão; vale a última escolha da pessoa
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('roomi-theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* armazenamento indisponível */ }
  return 'light'
}

export const useStore = create<State>((set, get) => ({
  hotelName: '',
  theme: initialTheme(),
  spec: EMPTY_SPEC,
  checks: {},
  skipped: [],
  modal: null,
  explain: false,
  autoTemplate: 'nucleo',
  placed: [],
  dying: new Set(),
  delays: {},
  thumbs: {},
  notice: null,
  photo: null,
  photoReq: 0,
  setName: (hotelName) => set({ hotelName }),
  setSpec: (patch) => set((s) => ({ spec: { ...s.spec, ...patch } })),
  setCheck: (id, on) => set((s) => ({ checks: { ...s.checks, [id]: on } })),
  skip: (key) => set((s) => (s.skipped.includes(key) ? {} : { skipped: [...s.skipped, key] })),
  openModal: (type) => {
    if (type === 'explain') return set({ explain: true })
    if (type !== 'report') return set({ modal: { type } })
    set((s) => ({ modal: { type }, photo: null, photoReq: s.photoReq + 1 }))
  },
  closeModal: () => set((s) => (s.explain ? { explain: false } : { modal: null })),
  setTheme: (theme) => {
    try { localStorage.setItem('roomi-theme', theme) } catch { /* armazenamento indisponível */ }
    set({ theme })
  },
  setAutoTemplate: (autoTemplate) => set({ autoTemplate }),
  notify: (text) => set({ notice: { text, id: Date.now() } }),
  remove: (uids) => { if (uids.length) set((s) => ({ dying: new Set([...s.dying, ...uids]) })) },
  purge: (u) =>
    set((s) => {
      const dying = new Set(s.dying)
      dying.delete(u)
      return { placed: s.placed.filter((p) => p.uid !== u), dying }
    }),
  // começa um projeto novo: demole o mapa e volta o questionário ao primeiro passo
  clear: () => set((s) => ({ dying: new Set(s.placed.map((p) => p.uid)), hotelName: '', spec: { ...EMPTY_SPEC }, checks: {}, skipped: [] })),
  // Substitui o mapa pelos itens dados (modelo ou esboço salvo) e devolve quantos ficaram de fora:
  // item que não existe no catálogo, fora do terreno ou em cima de outro.
  loadItems: (name, items, spec = EMPTY_SPEC, checks = {}) => {
    const placed: Placed[] = []
    let skipped = 0
    for (const it of items) {
      if (!ITEM_BY_ID[it.id] || !canPlace(placed, new Set(), it.id, it.x, it.z, it.rot)) { skipped++; continue }
      placed.push({ uid: uid(), itemId: it.id, x: it.x, z: it.z, rot: it.rot })
    }
    const step = Math.min(70, 4000 / Math.max(placed.length, 1)) // a cascata inteira dura até ~4 s
    const delays: Record<string, number> = {}
    placed.forEach((p, i) => (delays[p.uid] = Math.round(i * step)))
    set({ hotelName: name, placed, delays, dying: new Set(), spec, checks, skipped: [], autoTemplate: spec.destino ? templateOf(spec) : get().autoTemplate })
    return skipped
  },
  // Acrescenta itens ao mapa em cascata (`step` ms entre um e outro); devolve os que couberam.
  // Só os recém-chegados precisam de atraso: cada item lê o dele uma vez, ao montar.
  addItems: (items, step = 90) => {
    const { placed, dying } = get()
    const next = [...placed]
    const added: Placed[] = []
    for (const it of items) {
      if (!ITEM_BY_ID[it.id] || !canPlace(next, dying, it.id, it.x, it.z, it.rot)) continue
      const p = { uid: uid(), itemId: it.id, x: it.x, z: it.z, rot: it.rot }
      next.push(p)
      added.push(p)
    }
    const delays: Record<string, number> = {}
    added.forEach((p, i) => (delays[p.uid] = i * step))
    set({ placed: next, delays })
    return added
  },
}))
