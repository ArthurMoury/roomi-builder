import { ITEM_BY_ID } from '../data/catalog'
import { useStore, type SketchItem } from '../store'
import { autoAdd, emptySite, placeOn, siteItems } from './autoplace'
import { SCOPE } from './business'
import { MAX_UHS, templateOf, type Destino, type Publico, type Spec, type TierId } from './spec'

// Modo analista: os campos de negócio viram um programa de necessidades (a lista do que o hotel
// precisa ter) e o motor de posicionamento automático implanta o programa no terreno, nesta ordem:
// chegada, lazer da categoria, extras do público, o que cresce com as UHs, hospedagem e, por
// fim, caminhos e paisagismo. A hospedagem vem depois do lazer para que mudar só as UHs acrescente
// ou tire prédios sem mexer no resto.

const RANK: Record<TierId, number> = { eco: 0, mid: 1, up: 2, resort: 3, ai: 4, lux: 3 }
const COURTS = ['tennis', 'beach', 'padel', 'multi', 'society']

// Lazer e serviços de cada categoria; cumprem os requisitos dela (TIERS em valuation.ts)
const BASE: Record<TierId, string[]> = {
  eco: [],
  mid: ['buffet', 'gym'],
  up: ['pool', 'buffet', 'alacarte', 'lounge', 'gym', 'spa'],
  resort: ['pool', 'kidpool', 'poolbar', 'buffet', 'alacarte', 'lounge', 'gym', 'spa', 'kids', 'playground', 'tennis', 'beach', 'garden'],
  ai: ['pool', 'kidpool', 'swimup', 'poolbar', 'buffet', 'alacarte', 'alacarte', 'lounge', 'gym', 'spa', 'kids', 'playground', 'theater', 'waterpark', 'tennis', 'beach', 'garden'],
  lux: ['infinity', 'alacarte', 'lounge', 'spa', 'sauna', 'gym', 'garden'],
}

// Fatia das UHs pedidas que vai para cada tipo de hospedagem
const MIX: Record<TierId, Record<string, number>> = {
  eco: { std: 0.9, family: 0.1 },
  mid: { std: 0.85, family: 0.15 },
  up: { std: 0.7, suite: 0.3 },
  resort: { std: 0.6, family: 0.25, suite: 0.15 },
  ai: { std: 0.7, family: 0.3 },
  lux: { suite: 0.5, villa: 0.3, bungalow: 0.2 },
}

function mixOf(c: TierId | null, d: Destino | null, p: Publico | null) {
  const mix = { ...MIX[c ?? 'eco'] }
  const move = (from: string, to: string, v: number) => {
    if (!(from in mix)) return
    const k = Math.min(v, mix[from])
    mix[from] -= k
    mix[to] = (mix[to] ?? 0) + k
  }
  if (c === 'lux' && d !== 'praia') move('bungalow', 'chalet', 1)  // bangalô sobre a água só na praia
  if (c === 'resort' && (d === 'campo' || d === 'serra')) move('std', 'chalet', 0.1)
  if (p === 'familias' && 'family' in mix) move('std', 'family', 0.1)
  if (p === 'casais' && 'suite' in mix) move('family', 'suite', 0.1)
  return mix
}

// Prédios e unidades para chegar perto das UHs pedidas: cada tipo recebe as unidades inteiras da
// sua fatia; o que falta vai, uma unidade por vez, para o tipo mais atrasado que ainda caiba; uma
// sobra maior que meia unidade do menor tipo ganha mais uma unidade dele
function lodgingFor(mix: Record<string, number>, U: number) {
  const keys = (id: string) => ITEM_BY_ID[id].keys!
  const types = Object.keys(mix).filter((t) => mix[t] > 0).sort((a, b) => keys(b) - keys(a))
  const n: Record<string, number> = {}
  const behind = (t: string) => U * mix[t] - n[t] * keys(t)
  let total = 0
  for (const t of types) { n[t] = Math.floor((U * mix[t]) / keys(t)); total += n[t] * keys(t) }
  for (;;) {
    const fit = types.filter((t) => keys(t) <= U - total)
    if (!fit.length) break
    const t = fit.reduce((a, b) => (behind(b) > behind(a) ? b : a))
    n[t]++
    total += keys(t)
  }
  const small = types[types.length - 1]
  if (U - total >= keys(small) / 2 || (U > 0 && !total)) n[small]++
  return types.flatMap((t) => Array<string>(n[t]).fill(t))
}

export function program(spec: Spec, checks: Record<string, boolean> = {}): string[] {
  const { destino: d, categoria: c, publico: p } = spec
  const U = Math.min(Math.max(Math.round(spec.uhs ?? 0), 0), MAX_UHS)
  if (!d && !c && !U && !p) return []
  const r = c ? RANK[c] : -1
  const list: string[] = []
  const add = (id: string, n = 1) => { for (let i = 0; i < n; i++) list.push(id) }
  const once = (id: string) => { if (!list.includes(id)) list.push(id) }

  // chegada
  add('lobby')
  add('parking')
  // lazer e serviços da categoria
  if (c) BASE[c].forEach((id) => add(id))
  if (c === 'lux') add(d === 'praia' ? 'pier' : 'heli')
  // extras do público
  if (p === 'familias') {
    once('playground')
    if (r >= 1) once('kidpool')
    if (r >= 2) { once('kids'); once('games') }
    if (r >= 3) once('minigolf')
    if (r >= 3 && U >= 200) once('waterpark')
  }
  if (p === 'casais') {
    if (r >= 1) once('lounge')
    if (r >= 2) { once('jacuzzi'); once('sauna') }
    once('gazebo'); once('hammock'); once('firepit')
  }
  if (p === 'eventos' && r >= 1) { once('convention'); once('lounge'); if (r >= 2) once('garden') }
  if (p === 'misto') { once('playground'); if (r >= 1) once('lounge'); if (r >= 2) once('kids') }
  // destino
  if (d === 'campo' && r >= 3) { once('lake'); once('veg') }
  if (d === 'serra' && r >= 2) { once('firepit'); once('sauna') }
  // o que cresce com as UHs
  if (r >= 2 && c !== 'lux') add('pool', Math.max(0, Math.round(U / 150) - 1))
  if (r >= 1) add('buffet', Math.floor(U / 400))
  if (c === 'ai') add('alacarte', Math.max(0, Math.round(U / 150) - 2))
  else if (r >= 2) add('alacarte', Math.floor(U / 300))
  if (r >= 3 && c !== 'lux') {
    add('poolbar', Math.floor(U / 300))
    for (let i = 0; i < Math.floor(U / 200); i++) add(['padel', 'multi', 'society'][i % 3])
  }
  // vagas por UH: eventos pedem mais, praia menos (muita gente chega de transfer)
  const vagas = p === 'eventos' ? 0.8 : d === 'praia' ? 0.5 : 0.6
  add('parking', Math.max(0, Math.ceil((U * vagas) / 40) - 1))
  // respostas do checklist do relatório: "não" tira o grupo do programa, "sim" garante um item
  for (const c of SCOPE) {
    const answer = checks[c.id]
    if (answer === false) for (let k = list.length - 1; k >= 0; k--) if (c.ids.includes(list[k])) list.splice(k, 1)
    if (answer === true && !list.some((id) => c.ids.includes(id))) add(c.place, c.units?.(U) ?? 1)
  }
  // hospedagem
  list.push(...lodgingFor(mixOf(c, d, p), U))
  // caminhos, cercas e paisagismo
  add('road')
  if (r >= 2) add('gatehouse')
  add('path_stone')
  if (r >= 1 && list.filter((id) => id === 'parking').length <= 2) add('hedge')
  if (list.some((id) => COURTS.includes(id))) add('fence')
  if (r >= 3) add('deck')
  if (c === 'lux') add('wall')
  add('sunbeds', 2 * list.filter((id) => id === 'pool' || id === 'infinity').length)
  if (r >= 2) once('fountain')
  if (r >= 3) once('pergola')
  if (r >= 1) { add('lamp'); add('bench') }
  if (r >= 2) add('bollard')
  add(d === 'praia' ? 'palm' : 'tree', Math.min(18, 4 + Math.round(U / 25)))
  if (r >= 1) add('flowerbed', 3)
  return list
}

export interface Layout { items: SketchItem[]; keys: number; planned: number }

const cache = new Map<string, Layout>()

// Implanta o programa num terreno vazio. O resultado só depende dos campos e das respostas do
// checklist, então se repete igual para as mesmas entradas (e fica guardado)
export function generate(spec: Spec, checks: Record<string, boolean> = {}): Layout {
  const key = JSON.stringify([spec.destino, spec.categoria, spec.uhs, spec.publico, SCOPE.map((c) => checks[c.id] ?? null)])
  const hit = cache.get(key)
  if (hit) return hit
  const s = emptySite(templateOf(spec))
  const list = program(spec, checks)
  for (const id of list) placeOn(s, id, false)
  const items = siteItems(s)
  const keys = (ids: string[]) => ids.reduce((n, id) => n + (ITEM_BY_ID[id].keys ?? 0), 0)
  const out = { items, keys: keys(items.map((i) => i.id)), planned: keys(list) }
  cache.set(key, out)
  if (cache.size > 24) cache.delete(cache.keys().next().value!)
  return out
}

// Leva o mapa até o layout novo sem refazer o que não mudou: o que já está no lugar fica, o que
// saiu é demolido e o que entrou sobe em cascata, na ordem do programa
export function applyLayout(items: SketchItem[]) {
  const st = useStore.getState()
  const key = (id: string, x: number, z: number, rot: number) => `${id}@${x},${z},${rot}`
  const want = new Set(items.map((i) => key(i.id, i.x, i.z, i.rot)))
  const kept = new Set<string>()
  const gone: string[] = []
  for (const p of st.placed) {
    if (st.dying.has(p.uid)) continue
    const k = key(p.itemId, p.x, p.z, p.rot)
    if (want.has(k) && !kept.has(k)) kept.add(k)
    else gone.push(p.uid)
  }
  const fresh = items.filter((i) => !kept.has(key(i.id, i.x, i.z, i.rot)))
  st.remove(gone)
  st.addItems(fresh, Math.min(110, Math.max(14, 4500 / Math.max(fresh.length, 1)))) // cascata de até ~4,5 s
}

// Refaz o hotel a partir dos campos atuais do modo analista
export function rebuild() {
  const st = useStore.getState()
  st.setAutoTemplate(templateOf(st.spec))
  const layout = generate(st.spec, st.checks)
  applyLayout(layout.items)
  if (layout.keys < layout.planned) st.notify(`Neste terreno couberam ${layout.keys} das ${layout.planned} UHs do programa`)
}

// Resposta do checklist no relatório, levada ao mapa na hora: "não" demole o que houver daquele
// grupo; "sim" constrói o item típico onde ele faz mais sentido. A resposta fica guardada e vale
// também quando os campos remontarem o hotel.
export function answerScope(id: string, yes: boolean) {
  const st = useStore.getState()
  const c = SCOPE.find((x) => x.id === id)!
  st.setCheck(id, yes)
  const on = st.placed.filter((p) => !st.dying.has(p.uid) && c.ids.includes(p.itemId))
  if (!yes) st.remove(on.map((p) => p.uid))
  else if (!on.length) {
    const keys = st.placed.reduce((n, p) => n + (st.dying.has(p.uid) ? 0 : ITEM_BY_ID[p.itemId].keys ?? 0), 0)
    autoAdd(c.place, c.units?.(keys) ?? 1)
  }
}
