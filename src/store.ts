import { create } from 'zustand'
import { ITEM_BY_ID } from './data/catalog'
import type { Placed, Rot } from './lib/valuation'
import { EMPTY_SPEC, templateOf, type Spec } from './lib/spec'

export const GRID = 40 // células de 5 m: terreno de 200 × 200 m (4 ha)

export type Tool =
  | { type: 'build' }                              // Construir, sem item escolhido
  | { type: 'place'; itemId: string; rot: Rot }    // Construir com um item do catálogo
  | { type: 'select' }                             // Selecionar: clicar seleciona, arrastar move
  | { type: 'demolish' }

export type Theme = 'dark' | 'light'
export type Side = 'left' | 'right'

// Item sendo arrastado: (dx, dz) é a distância da célula agarrada até o canto do item
export interface Drag { uid: string; dx: number; dz: number; x: number; z: number; ok: boolean }

export interface SketchItem { id: string; x: number; z: number; rot: Rot }

// Como o catálogo constrói: no manual você posiciona; no automático o item vai direto para o mapa
export type PlaceMode = 'manual' | 'auto'
// Modelo de implantação que o posicionamento automático segue (ver lib/autoplace.ts)
export type TemplateId = 'nucleo' | 'praia' | 'vila'
// Analista: campos de negócio montam o hotel sozinho. Construtor: catálogo e ferramentas à mão
export type AppMode = 'analyst' | 'builder'
// No modo analista o relatório vem depois do checklist de escopo (painel ao lado do mapa)
export type Modal = { type: 'report' } | { type: 'models' } | { type: 'checklist' }

interface State {
  hotelName: string
  theme: Theme
  appMode: AppMode
  spec: Spec                      // campos do modo analista
  checks: Record<string, boolean> // respostas do checklist de escopo do relatório de negócios
  modal: Modal | null
  explain: boolean                // explicação dos cálculos, aberta por cima de tudo
  placeMode: PlaceMode
  autoTemplate: TemplateId
  panels: Record<Side, boolean>
  placed: Placed[]
  dying: Set<string>      // itens em animação de demolição
  delays: Record<string, number> // atraso de entrada (cascata ao abrir modelo ou esboço)
  tool: Tool
  selected: string | null
  drag: Drag | null
  thumbs: Record<string, string> // miniatura de cada item do catálogo (data URL), renderada dos próprios modelos 3D
  notice: { text: string; id: number } | null
  photo: string | null           // fachada do hotel, fotografada para o relatório (three/Thumbs.tsx)
  photoReq: number                // cada pedido de relatório tira uma foto nova
  setName: (n: string) => void
  setAppMode: (m: AppMode) => void
  setSpec: (patch: Partial<Spec>) => void
  setCheck: (id: string, on: boolean) => void
  openModal: (type: Modal['type'] | 'explain') => void
  closeModal: () => void          // fecha a janela de cima
  setTheme: (t: Theme) => void
  setPlaceMode: (m: PlaceMode) => void
  setAutoTemplate: (t: TemplateId) => void
  notify: (text: string) => void
  togglePanel: (side: Side) => void
  setTool: (t: Tool) => void
  rotate: () => boolean
  place: (itemId: string, x: number, z: number, rot: Rot) => void
  startDrag: (uid: string, dx: number, dz: number) => void
  dragTo: (cx: number, cz: number) => void
  endDrag: () => void
  demolish: (uid: string) => void
  remove: (uids: string[]) => void
  purge: (uid: string) => void
  select: (uid: string | null) => void
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

// `ignore`: o próprio item, quando ele está sendo movido ou girado
export function canPlace(placed: Placed[], dying: Set<string>, itemId: string, x: number, z: number, rot: Rot, ignore?: string) {
  const { w, d } = footprint(itemId, rot)
  if (x < 0 || z < 0 || x + w > GRID || z + d > GRID) return false
  return placed.every((p) => {
    if (p.uid === ignore || dying.has(p.uid)) return true
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
  hotelName: 'Meu Resort',
  theme: initialTheme(),
  appMode: 'analyst',
  spec: EMPTY_SPEC,
  checks: {},
  modal: null,
  explain: false,
  placeMode: 'manual',
  autoTemplate: 'nucleo',
  panels: { left: true, right: true },
  placed: [],
  dying: new Set(),
  delays: {},
  tool: { type: 'build' },
  selected: null,
  drag: null,
  thumbs: {},
  notice: null,
  photo: null,
  photoReq: 0,
  setName: (hotelName) => set({ hotelName }),
  setAppMode: (appMode) => set({ appMode, tool: { type: 'build' }, selected: null, drag: null }),
  setSpec: (patch) => set((s) => ({ spec: { ...s.spec, ...patch } })),
  setCheck: (id, on) => set((s) => ({ checks: { ...s.checks, [id]: on } })),
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
  setPlaceMode: (placeMode) => set({ placeMode, tool: { type: 'build' }, selected: null, drag: null }),
  setAutoTemplate: (autoTemplate) => set({ autoTemplate }),
  notify: (text) => set({ notice: { text, id: Date.now() } }),
  togglePanel: (side) => set((s) => ({ panels: { ...s.panels, [side]: !s.panels[side] } })),
  setTool: (tool) => set({ tool, selected: null, drag: null }),
  // R: gira um quarto de volta o item que vai ser posicionado ou, no modo Selecionar, o item
  // selecionado. O giro é em torno da célula-pivô (a mesma regra de centralizar ao posicionar),
  // então quatro giros devolvem o item ao lugar. Devolve false quando o item girado não cabe ali.
  rotate: () => {
    const { tool, selected, placed, dying } = get()
    if (tool.type === 'place') {
      set({ tool: { ...tool, rot: ((tool.rot + 1) % 4) as Rot } })
      return true
    }
    const p = tool.type === 'select' && selected ? placed.find((q) => q.uid === selected) : undefined
    if (!p) return true
    const rot = ((p.rot + 1) % 4) as Rot
    const before = footprint(p.itemId, p.rot), after = footprint(p.itemId, rot)
    const half = (n: number) => Math.floor((n - 1) / 2)
    const x = Math.min(Math.max(p.x + half(before.w) - half(after.w), 0), GRID - after.w)
    const z = Math.min(Math.max(p.z + half(before.d) - half(after.d), 0), GRID - after.d)
    if (!canPlace(placed, dying, p.itemId, x, z, rot, p.uid)) return false
    set({ placed: placed.map((q) => (q.uid === p.uid ? { ...q, x, z, rot } : q)) })
    return true
  },
  place: (itemId, x, z, rot) => {
    const { placed, dying } = get()
    if (!canPlace(placed, dying, itemId, x, z, rot)) return
    set({ placed: [...placed, { uid: uid(), itemId, x, z, rot }] })
  },
  startDrag: (u, dx, dz) => {
    const p = get().placed.find((q) => q.uid === u)
    if (p) set({ drag: { uid: u, dx, dz, x: p.x, z: p.z, ok: true }, selected: u })
  },
  dragTo: (cx, cz) => {
    const { drag, placed, dying } = get()
    const p = drag && placed.find((q) => q.uid === drag.uid)
    if (!drag || !p) return
    const { w, d } = footprint(p.itemId, p.rot)
    const x = Math.min(Math.max(cx + drag.dx, 0), GRID - w)
    const z = Math.min(Math.max(cz + drag.dz, 0), GRID - d)
    if (x === drag.x && z === drag.z) return
    set({ drag: { ...drag, x, z, ok: canPlace(placed, dying, p.itemId, x, z, p.rot, p.uid) } })
  },
  endDrag: () => {
    const { drag, placed } = get()
    if (!drag) return
    set({
      drag: null,
      placed: drag.ok ? placed.map((p) => (p.uid === drag.uid ? { ...p, x: drag.x, z: drag.z } : p)) : placed,
    })
  },
  demolish: (u) => set((s) => ({ dying: new Set(s.dying).add(u), selected: null })),
  remove: (uids) => { if (uids.length) set((s) => ({ dying: new Set([...s.dying, ...uids]), selected: null })) },
  purge: (u) =>
    set((s) => {
      const dying = new Set(s.dying)
      dying.delete(u)
      return { placed: s.placed.filter((p) => p.uid !== u), dying }
    }),
  select: (selected) => set({ selected }),
  clear: () => set((s) => ({ dying: new Set(s.placed.map((p) => p.uid)), selected: null, spec: EMPTY_SPEC, checks: {} })),
  // Substitui o mapa pelos itens dados (modelo ou esboço salvo) e devolve quantos ficaram de fora:
  // item que não existe no catálogo, fora do terreno ou em cima de outro.
  loadItems: (name, items, spec = EMPTY_SPEC, checks = {}) => {
    const placed: Placed[] = []
    let skipped = 0
    for (const it of items) {
      if (!ITEM_BY_ID[it.id] || !canPlace(placed, new Set(), it.id, it.x, it.z, it.rot)) { skipped++; continue }
      placed.push({ uid: uid(), itemId: it.id, x: it.x, z: it.z, rot: it.rot })
    }
    const step = Math.min(70, 4000 / Math.max(placed.length, 1)) // a cascada inteira dura até ~4 s
    const delays: Record<string, number> = {}
    placed.forEach((p, i) => (delays[p.uid] = Math.round(i * step)))
    set({ hotelName: name, placed, delays, dying: new Set(), selected: null, drag: null, tool: { type: 'build' }, spec, checks,
      autoTemplate: spec.destino ? templateOf(spec) : get().autoTemplate })
    return skipped
  },
  // Acrescenta itens ao mapa em cascata (`step` ms entre um e outro); devolve os que couberam
  addItems: (items, step = 90) => {
    const { placed, dying, delays } = get()
    const next = [...placed]
    const added: Placed[] = []
    for (const it of items) {
      if (!ITEM_BY_ID[it.id] || !canPlace(next, dying, it.id, it.x, it.z, it.rot)) continue
      const p = { uid: uid(), itemId: it.id, x: it.x, z: it.z, rot: it.rot }
      next.push(p)
      added.push(p)
    }
    const nextDelays = { ...delays }
    added.forEach((p, i) => (nextDelays[p.uid] = i * step))
    set({ placed: next, delays: nextDelays })
    return added
  },
}))
