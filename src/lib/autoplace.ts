import { ITEM_BY_ID } from '../data/catalog'
import { GRID, footprint, useStore, type SketchItem, type TemplateId } from '../store'
import type { Placed, Rot } from './valuation'

// Posicionamento automático: ao clicar num item do catálogo, ele vai para o lugar que mais faz
// sentido no terreno, seguindo leituras de implantação de resorts (zonas, vizinhanças, ruído,
// orientação) e ligado aos vizinhos por caminho quando estão a 3–7 blocos de distância.

type Cell = { x: number; z: number }
type Rect = { x: number; z: number; w: number; d: number }
type Side = 'n' | 's' | 'e' | 'w'
// Papéis do terreno; cada modelo de implantação decide onde fica cada um
export type Role = 'arrival' | 'core' | 'lodging' | 'luxury' | 'sports' | 'fun'
export const ROLE_LABEL: Record<Role, string> = {
  arrival: 'Chegada', core: 'Lazer', lodging: 'Hospedagem', luxury: 'Luxo e spa', sports: 'Esportes', fun: 'Diversão',
}
// Para onde a frente aponta: núcleo, chegada (sul), vista do modelo, água, ou o que o modelo
// define para as alas de hospedagem ('lodge')
type Face = 'core' | 'arrival' | 'view' | 'water' | 'lodge'

interface Rule {
  zone: Role
  why: string                           // leitura mostrada no aviso
  face?: Face                           // para onde a frente (entrada) deve apontar
  near?: [string[], number, number][]   // [itens, folga mínima, folga máxima] em blocos
  avoid?: [string[], number][]          // [itens, folga mínima] (ruído, privacidade)
  edge?: Side | 'water' | 'back'        // encostar nesta divisa (água e fundos dependem do modelo)
  gap?: number                          // folga livre em volta, para caminhos (padrão 1)
}

export const PATH_MIN = 3
export const PATH_MAX = 7

interface Template {
  name: string
  short: string           // rótulo curto do seletor
  note: string            // resumo mostrado no catálogo
  zones: Record<Role, Rect[]>  // um papel pode ocupar mais de um retângulo (quartos em ferradura)
  view: Cell | null       // direção da vista; null = para fora do núcleo
  lodge: 'core' | 'view'  // para onde as alas de hospedagem se voltam
  water: Side             // divisa com água (píer)
  sea: boolean            // a divisa com água é o mar
  back: Side              // fundos do terreno (campo society)
  why?: Record<string, string> // leituras que mudam neste modelo
}

// Terreno de 40×40 blocos de 5 m, dividido sem sobras entre os papéis. Nos três modelos a
// chegada fica ao sul, onde entra a via. Os modelos seguem os desenhos mais comuns de resorts
// reais (pesquisa em README.md › Referências de implantação).
export const TEMPLATES: Record<TemplateId, Template> = {
  // Núcleo central, o desenho dos all inclusive brasileiros (Grand Palladium Imbassaí, Club Med
  // Trancoso): recepção na via, piscina e restaurantes no meio, blocos de quartos em ferradura
  // voltados para a piscina, quadras junto à entrada e ao estacionamento, luxo num lado reservado.
  nucleo: {
    name: 'Núcleo central',
    short: 'Núcleo',
    note: 'Piscina e restaurantes no meio, quartos em ferradura voltados para eles, quadras junto à entrada e luxo num lado reservado.',
    zones: {
      arrival: [{ x: 10, z: 32, w: 18, d: 8 }],
      core: [{ x: 10, z: 9, w: 18, d: 23 }],
      lodging: [{ x: 0, z: 0, w: 10, d: 26 }, { x: 10, z: 0, w: 18, d: 9 }],
      luxury: [{ x: 28, z: 10, w: 12, d: 30 }],
      sports: [{ x: 0, z: 26, w: 10, d: 14 }],
      fun: [{ x: 28, z: 0, w: 12, d: 10 }],
    },
    view: null,
    lodge: 'core',
    water: 'e',
    sea: false,
    back: 'w',
  },
  // Frente de mar (o mar fica ao norte), como o Costão do Santinho: recepção no lado de terra,
  // fileiras de quartos de frente para o mar, piscinas e restaurantes numa faixa junto à areia,
  // quadras no interior do terreno, villas e spa numa ponta silenciosa.
  praia: {
    name: 'Frente de mar',
    short: 'Frente de mar',
    note: 'Mar ao fundo: quartos em fileiras de frente para a praia, lazer entre eles e a areia, villas na ponta.',
    zones: {
      arrival: [{ x: 10, z: 32, w: 30, d: 8 }],
      core: [{ x: 10, z: 0, w: 20, d: 13 }],
      lodging: [{ x: 10, z: 13, w: 20, d: 19 }],
      luxury: [{ x: 30, z: 0, w: 10, d: 32 }],
      sports: [{ x: 0, z: 18, w: 10, d: 22 }],
      fun: [{ x: 0, z: 0, w: 10, d: 18 }],
    },
    view: { x: 0, z: -1 },
    lodge: 'view',
    water: 'n',
    sea: true,
    back: 'w',
    why: {
      pool: 'entre os quartos e a praia, no eixo da vista',
      std: 'em fileira paralela à praia, de frente para o mar',
      family: 'em fileira paralela à praia, perto do lazer infantil',
      suite: 'na ala de luxo, de frente para o mar',
      chalet: 'em vila na ala de luxo, voltado para o mar',
      bungalow: 'pé na areia, voltado para o mar',
      villa: 'na ponta da praia, com vista e privacidade',
      spa: 'na ponta silenciosa da praia, perto das villas',
      infinity: 'na borda, voltada para o mar',
      pier: 'na praia, avançando sobre o mar',
      society: 'no interior do terreno, junto às quadras',
    },
  },
  // Vila de bangalôs (o mar fica ao norte), como o Nannai e o Club Med Rio das Pedras: núcleo
  // compacto (recepção, restaurante, piscina) junto à chegada, villas e bangalôs espalhados rumo
  // ao mar por caminhos próprios, sem carros; o estacionamento fica na chegada.
  vila: {
    name: 'Vila de bangalôs',
    short: 'Vila',
    note: 'Núcleo compacto junto à chegada; villas e bangalôs espalhados rumo ao mar por caminhos próprios, sem carros.',
    zones: {
      arrival: [{ x: 0, z: 34, w: 30, d: 6 }],
      core: [{ x: 10, z: 24, w: 20, d: 10 }],
      lodging: [{ x: 0, z: 24, w: 10, d: 10 }],
      luxury: [{ x: 0, z: 0, w: 40, d: 24 }],
      sports: [{ x: 30, z: 24, w: 10, d: 10 }],
      fun: [{ x: 30, z: 34, w: 10, d: 6 }],
    },
    view: { x: 0, z: -1 },
    lodge: 'view',
    water: 'n',
    sea: true,
    back: 'e',
    why: {
      pool: 'no núcleo compacto, junto à chegada',
      std: 'no bloco de apartamentos, ao lado do núcleo',
      family: 'no bloco de apartamentos, perto do lazer',
      suite: 'na vila, de frente para o mar',
      chalet: 'na vila, voltado para o mar',
      bungalow: 'pé na areia, voltado para o mar',
      villa: 'espalhada rumo ao mar, com caminho próprio e sem carros',
      spa: 'num canto silencioso da vila, perto das villas',
      infinity: 'na borda, voltada para o mar',
      pier: 'na praia, avançando sobre o mar',
      society: 'na lateral do terreno, junto às quadras',
    },
  },
}

const LODGING = ['std', 'suite', 'family']
const UNITS = ['chalet', 'bungalow', 'villa']
const POOLS = ['pool', 'kidpool', 'infinity', 'indoor', 'swimup']
const FOOD = ['buffet', 'alacarte', 'poolbar', 'lounge']
const COURTS = ['tennis', 'beach', 'padel', 'multi', 'society']
const NOISY = [...COURTS, 'waterpark', 'kids', 'playground', 'theater', 'parking', 'heli']
const QUIET = ['spa', 'sauna', 'villa', 'suite', 'bungalow', 'chalet']
const PATHS = new Set(['path_stone', 'path_paved'])

const RULES: Record<string, Rule> = {
  // chegada
  lobby: { zone: 'arrival', face: 'arrival', near: [[['parking'], 1, 3]], why: 'na chegada, de frente para o acesso' },
  parking: { zone: 'arrival', near: [[['lobby'], 1, 3]], avoid: [[QUIET, 6]], why: 'ao lado da recepção, longe das áreas de descanso' },
  gatehouse: { zone: 'arrival', face: 'arrival', edge: 's', near: [[['road'], 0, 1], [['parking', 'lobby'], 1, 8]], why: 'na divisa sul, junto à via, controlando a entrada' },
  convention: { zone: 'arrival', face: 'arrival', near: [[['lobby'], 1, 4]], avoid: [[QUIET, 6]], why: 'perto da recepção, com acesso próprio para eventos' },
  garden: { zone: 'arrival', near: [[['lobby'], 1, 3]], why: 'em frente à recepção, como praça de chegada' },
  fountain: { zone: 'arrival', near: [[['lobby'], 1, 3]], why: 'na praça de chegada' },
  // núcleo de lazer
  pool: { zone: 'core', near: [[LODGING, 2, 6], [FOOD, 1, 4]], why: 'no centro, cercada pelas acomodações e restaurantes' },
  kidpool: { zone: 'core', near: [[['pool'], 1, 2], [['kids'], 1, 3]], why: 'junto à piscina principal e ao kids club' },
  swimup: { zone: 'core', near: [[['pool'], 0, 1]], gap: 0, why: 'colado à piscina principal' },
  jacuzzi: { zone: 'core', near: [[['pool', 'spa'], 0, 2]], gap: 0, why: 'ao lado da piscina' },
  buffet: { zone: 'core', face: 'core', near: [[['pool'], 2, 4], [LODGING, 2, 8]], why: 'entre a piscina e as acomodações' },
  alacarte: { zone: 'core', face: 'core', near: [[['pool', 'lounge', 'buffet'], 1, 5]], why: 'perto da piscina e dos bares' },
  poolbar: { zone: 'core', near: [[['pool'], 0, 1]], gap: 0, why: 'na borda da piscina' },
  lounge: { zone: 'core', face: 'core', near: [[['pool', 'lobby'], 1, 3]], why: 'entre a piscina e a recepção' },
  sunbeds: { zone: 'core', near: [[POOLS, 0, 1]], gap: 0, why: 'na borda da piscina' },
  pergola: { zone: 'core', near: [[['pool', 'spa'], 1, 3]], why: 'à sombra, perto da piscina' },
  kids: { zone: 'core', face: 'core', near: [[['kidpool', 'pool'], 1, 3], [['family'], 1, 6]], avoid: [[QUIET, 6]], why: 'perto da piscina infantil e das famílias' },
  playground: { zone: 'core', near: [[['kids'], 0, 2]], gap: 0, why: 'ao lado do kids club' },
  theater: { zone: 'core', face: 'core', near: [[POOLS, 2, 8]], avoid: [[QUIET, 6]], why: 'no núcleo de lazer, longe das acomodações silenciosas' },
  // hospedagem
  std: { zone: 'lodging', face: 'lodge', near: [[['std', 'family'], 2, 2], [['pool'], 3, 24]], avoid: [[NOISY, 4]], why: 'na ala de hospedagem, em fileira e de frente para a piscina' },
  family: { zone: 'lodging', face: 'lodge', near: [[['std', 'family'], 2, 2], [['kids', 'kidpool', 'pool'], 2, 12]], why: 'na ala de hospedagem, perto do lazer infantil' },
  gym: { zone: 'lodging', face: 'core', near: [[LODGING, 1, 3]], why: 'junto às acomodações' },
  games: { zone: 'lodging', face: 'core', near: [[LODGING, 1, 3], [['kids'], 1, 6]], why: 'perto das acomodações e do kids club' },
  suite: { zone: 'luxury', face: 'lodge', near: [[['suite'], 2, 2], [['infinity', 'spa', 'pool'], 2, 8]], avoid: [[NOISY, 6]], why: 'na ala de luxo, longe do barulho' },
  chalet: { zone: 'luxury', face: 'lodge', near: [[UNITS, 1, 1], [['garden', 'lake'], 0, 4]], avoid: [[NOISY, 6]], why: 'em vila, junto à natureza' },
  bungalow: { zone: 'luxury', face: 'water', near: [[['bungalow'], 1, 1], [['lake', 'pier'], 0, 3]], avoid: [[NOISY, 6]], why: 'junto à água' },
  villa: { zone: 'luxury', face: 'view', near: [[['villa'], 1, 2]], avoid: [[NOISY, 8]], why: 'num canto reservado, com vista e privacidade' },
  // bem-estar e luxo
  spa: { zone: 'luxury', face: 'view', near: [[['villa', 'suite', 'infinity'], 1, 5]], avoid: [[NOISY, 6]], why: 'num canto silencioso, perto das villas' },
  sauna: { zone: 'luxury', near: [[['spa'], 0, 1]], gap: 0, why: 'colada ao spa' },
  infinity: { zone: 'luxury', face: 'view', near: [[['suite', 'villa', 'spa'], 1, 4]], why: 'na borda, voltada para a vista' },
  indoor: { zone: 'luxury', near: [[['spa'], 1, 3]], why: 'junto ao spa' },
  lake: { zone: 'luxury', near: [[['bungalow', 'villa', 'pier'], 0, 4]], why: 'no setor de natureza da ala de luxo' },
  pier: { zone: 'luxury', edge: 'water', face: 'water', near: [[['lake', 'bungalow'], 0, 6]], why: 'na margem, junto à água' },
  gazebo: { zone: 'luxury', near: [[['lake', 'garden'], 1, 3]], why: 'junto ao lago' },
  hammock: { zone: 'luxury', near: [[['lake', 'pier', 'bungalow'], 1, 4]], why: 'à beira d’água' },
  firepit: { zone: 'luxury', near: [[[...LODGING, ...UNITS], 2, 5]], why: 'perto das acomodações, para o fim de tarde' },
  // esportes e lazer barulhento, ao fundo
  tennis: { zone: 'sports', near: [[COURTS, 1, 1]], avoid: [[QUIET, 6]], why: 'no setor esportivo, afastado das acomodações' },
  beach: { zone: 'sports', near: [[COURTS, 1, 1]], avoid: [[QUIET, 6]], why: 'no setor esportivo, afastado das acomodações' },
  padel: { zone: 'sports', near: [[COURTS, 1, 1]], avoid: [[QUIET, 6]], why: 'no setor esportivo, afastado das acomodações' },
  multi: { zone: 'sports', near: [[COURTS, 1, 1]], avoid: [[QUIET, 6]], why: 'no setor esportivo, afastado das acomodações' },
  society: { zone: 'sports', edge: 'back', near: [[COURTS, 1, 1]], avoid: [[QUIET, 8]], why: 'no fundo do terreno, junto às quadras' },
  minigolf: { zone: 'sports', near: [[['kids', 'playground', ...COURTS], 1, 4]], why: 'no lazer familiar, junto às quadras' },
  waterpark: { zone: 'fun', avoid: [[QUIET, 8]], near: [[['kids', 'kidpool'], 2, 12]], why: 'num canto do terreno, longe das áreas silenciosas' },
  kiosk: { zone: 'fun', near: [[['waterpark', 'beach', ...COURTS], 0, 2]], gap: 0, why: 'junto ao lazer' },
  heli: { zone: 'sports', avoid: [[[...LODGING, ...UNITS, 'spa'], 8]], why: 'afastado das acomodações' },
  veg: { zone: 'sports', near: [[['buffet', 'alacarte'], 2, 14]], why: 'nos fundos, perto da cozinha' },
}

// ── leitura do terreno ─────────────────────────────────────────────────────

export interface Site { t: Template; live: Placed[]; rect: Rect[]; occ: Int32Array; hub?: Cell }

const at = (x: number, z: number) => z * GRID + x
const inside = (c: Cell) => c.x >= 0 && c.z >= 0 && c.x < GRID && c.z < GRID

export function emptySite(t: TemplateId): Site {
  return { t: TEMPLATES[t], live: [], rect: [], occ: new Int32Array(GRID * GRID).fill(-1) }
}

function readSite(): Site {
  const { placed, dying, autoTemplate } = useStore.getState()
  const s = emptySite(autoTemplate)
  for (const p of placed) if (!dying.has(p.uid)) addToSite(s, p)
  return s
}

let seq = 0

function addToSite(s: Site, p: Placed) {
  const f = footprint(p.itemId, p.rot)
  const r = { x: p.x, z: p.z, w: f.w, d: f.d }
  const i = s.live.push(p) - 1
  s.rect.push(r)
  if (p.itemId === 'pool') s.hub = undefined
  for (let z = r.z; z < r.z + r.d; z++) for (let x = r.x; x < r.x + r.w; x++) s.occ[at(x, z)] = i
}

// Registra no terreno os itens planejados que couberem, na ordem dada
function commit(s: Site, items: SketchItem[]) {
  for (const it of items) {
    const f = footprint(it.id, it.rot)
    if (fits(s, { x: it.x, z: it.z, w: f.w, d: f.d })) addToSite(s, { uid: `a${++seq}`, itemId: it.id, x: it.x, z: it.z, rot: it.rot })
  }
}

export const siteItems = (s: Site): SketchItem[] => s.live.map((p) => ({ id: p.itemId, x: p.x, z: p.z, rot: p.rot }))

const itemAt = (s: Site, c: Cell) => (inside(c) ? s.occ[at(c.x, c.z)] : -2)
const isFree = (s: Site, c: Cell) => itemAt(s, c) === -1
const isPath = (s: Site, c: Cell) => { const i = itemAt(s, c); return i >= 0 && PATHS.has(s.live[i].itemId) }
// construção de verdade (bloqueia caminho e pede folga); caminhos, cercas e mobiliário não contam
const isSolid = (s: Site, c: Cell) => { const i = itemAt(s, c); return i >= 0 && !ITEM_BY_ID[s.live[i].itemId].decor }

function gap(a: Rect, b: Rect) {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w))
  const dz = Math.max(0, b.z - (a.z + a.d), a.z - (b.z + b.d))
  return dx + dz
}

const rectsOf = (s: Site, ids: string[]) => s.rect.filter((_, i) => ids.includes(s.live[i].itemId))
const nearest = (r: Rect, rects: Rect[]) => rects.reduce((m, o) => Math.min(m, gap(r, o)), Infinity)

const center = (r: Rect) => ({ x: r.x + r.w / 2, z: r.z + r.d / 2 })

// Frente do item: o lado +z do modelo, girado. 0 = sul, 1 = leste, 2 = norte, 3 = oeste
const FRONT: Record<Rot, Cell> = { 0: { x: 0, z: 1 }, 1: { x: 1, z: 0 }, 2: { x: 0, z: -1 }, 3: { x: -1, z: 0 } }
const OUTWARD: Record<Side, Cell> = { n: { x: 0, z: -1 }, s: { x: 0, z: 1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } }

// Ponto de partida do item: a célula logo à frente do meio da fachada principal
function entryOf(r: Rect, rot: Rot): Cell {
  switch (rot) {
    case 0: return { x: r.x + Math.floor(r.w / 2), z: r.z + r.d }
    case 1: return { x: r.x + r.w, z: r.z + Math.floor(r.d / 2) }
    case 2: return { x: r.x + Math.floor(r.w / 2), z: r.z - 1 }
    default: return { x: r.x - 1, z: r.z + Math.floor(r.d / 2) }
  }
}

// Centro do lazer: a piscina principal (ou o meio do núcleo, enquanto não há piscina)
function coreHub(s: Site) {
  if (!s.hub) {
    const i = s.live.findIndex((p) => p.itemId === 'pool')
    s.hub = i >= 0 ? center(s.rect[i]) : center(s.t.zones.core[0])
  }
  return s.hub
}

// Para onde a frente deve apontar: uma direção fixa, ou um ponto (de frente para ele ou de costas)
type Aim = { dir: Cell } | { to: Cell; away: boolean }

function aim(s: Site, face: Face): Aim {
  if (face === 'lodge') face = s.t.lodge
  if (face === 'arrival') return { dir: OUTWARD.s }
  if (face === 'view' && s.t.view) return { dir: s.t.view }
  if (face === 'water') {
    const i = s.live.findIndex((p) => p.itemId === 'lake' || p.itemId === 'pier')
    return i < 0 ? { dir: OUTWARD[s.t.water] } : { to: center(s.rect[i]), away: false }
  }
  return { to: coreHub(s), away: face === 'view' }
}

function edgeDist(r: Rect, e: Side) {
  return e === 'n' ? r.z : e === 's' ? GRID - (r.z + r.d) : e === 'w' ? r.x : GRID - (r.x + r.w)
}

function overflow(r: Rect, z: Rect) {
  return Math.max(0, z.x - r.x) + Math.max(0, r.x + r.w - (z.x + z.w)) + Math.max(0, z.z - r.z) + Math.max(0, r.z + r.d - (z.z + z.d))
}

function fits(s: Site, r: Rect) {
  if (r.x < 0 || r.z < 0 || r.x + r.w > GRID || r.z + r.d > GRID) return false
  for (let z = r.z; z < r.z + r.d; z++) for (let x = r.x; x < r.x + r.w; x++) if (s.occ[at(x, z)] !== -1) return false
  return true
}

// Tabela de somas acumuladas: quantas células marcadas há num retângulo [x0, x1) × [z0, z1),
// recortado no terreno, em tempo constante
type Count = (x0: number, z0: number, x1: number, z1: number) => number

function counter(mark: (k: number) => boolean): Count {
  const N = GRID + 1, t = new Int32Array(N * N)
  for (let z = 0; z < GRID; z++)
    for (let x = 0, row = 0; x < GRID; x++) {
      if (mark(at(x, z))) row++
      t[(z + 1) * N + x + 1] = t[z * N + x + 1] + row
    }
  return (x0, z0, x1, z1) => {
    x0 = Math.max(0, x0); z0 = Math.max(0, z0); x1 = Math.min(GRID, x1); z1 = Math.min(GRID, z1)
    return x0 >= x1 || z0 >= z1 ? 0 : t[z1 * N + x1] - t[z0 * N + x1] - t[z1 * N + x0] + t[z0 * N + x0]
  }
}

// Tudo o que a nota de uma posição consulta, calculado uma vez por busca
interface Ctx {
  zones: Rect[]
  edge: Side | null
  near: [Rect[], number, number][]
  avoid: [Rect[], number][]
  rowX: Set<number>
  rowZ: Set<number>
  aim: Aim | null
  hub: Cell
  gap: number
  used: Count
  solid: Count
  doors: Count
}

// Nota de uma posição: quanto menor, melhor
function score(c: Ctx, r: Rect, rot: Rot) {
  let out = Infinity
  for (const z of c.zones) out = Math.min(out, overflow(r, z))
  let v = 3 * out
  if (c.edge) v += 4 * edgeDist(r, c.edge)
  for (const [rects, lo, hi] of c.near) {
    const d = nearest(r, rects)
    if (d !== Infinity) v += 2 * (d < lo ? lo - d : d > hi ? d - hi : 0)
  }
  for (const [rects, min] of c.avoid) {
    const d = nearest(r, rects)
    if (d < min) v += 3 * (min - d)
  }
  // fileiras: alinhar com itens iguais
  if (c.rowX.has(r.x) || c.rowZ.has(r.z)) v -= 2
  const m = center(r)
  if (c.aim) {
    let t = 'dir' in c.aim ? c.aim.dir : { x: c.aim.to.x - m.x, z: c.aim.to.z - m.z }
    if ('to' in c.aim) {
      const len = Math.hypot(t.x, t.z) || 1
      t = { x: (c.aim.away ? -t.x : t.x) / len, z: (c.aim.away ? -t.z : t.z) / len }
    }
    const f = FRONT[rot]
    v -= 2.5 * (f.x * t.x + f.z * t.z)
  }
  const e = entryOf(r, rot)
  if (!inside(e) || c.solid(e.x, e.z, e.x + 1, e.z + 1)) v += 3
  // nunca em cima da porta de outro item
  if (c.doors(r.x, r.z, r.x + r.w, r.z + r.d)) v += 8
  // folga: nenhuma construção a menos de `gap` blocos (sobra espaço para caminho entre os prédios)
  if (c.solid(r.x - c.gap, r.z - c.gap, r.x + r.w + c.gap, r.z + r.d + c.gap)) v += 6
  return v + 0.04 * Math.hypot(m.x - c.hub.x, m.z - c.hub.z)
}

function bestSpot(s: Site, id: string, rule: Rule) {
  // portas das construções (caminhos, cercas e mobiliário não têm porta)
  const doorCells = new Uint8Array(GRID * GRID)
  s.live.forEach((p, i) => {
    if (ITEM_BY_ID[p.itemId].decor) return
    const e = entryOf(s.rect[i], p.rot)
    if (inside(e)) doorCells[at(e.x, e.z)] = 1
  })
  const same = rectsOf(s, [id])
  const c: Ctx = {
    zones: s.t.zones[rule.zone],
    edge: rule.edge === 'water' ? s.t.water : rule.edge === 'back' ? s.t.back : rule.edge ?? null,
    near: (rule.near ?? []).map(([ids, lo, hi]) => [rectsOf(s, ids), lo, hi]),
    avoid: (rule.avoid ?? []).map(([ids, min]) => [rectsOf(s, ids), min]),
    rowX: new Set(same.map((r) => r.x)),
    rowZ: new Set(same.map((r) => r.z)),
    aim: rule.face ? aim(s, rule.face) : null,
    hub: coreHub(s),
    gap: rule.gap ?? 1,
    used: counter((k) => s.occ[k] !== -1),
    solid: counter((k) => s.occ[k] >= 0 && !ITEM_BY_ID[s.live[s.occ[k]].itemId].decor),
    doors: counter((k) => doorCells[k] === 1),
  }
  let best: SketchItem | null = null, bestV = Infinity
  for (const rot of [0, 1, 2, 3] as Rot[]) {
    const { w, d } = footprint(id, rot)
    for (let z = 0; z + d <= GRID; z++)
      for (let x = 0; x + w <= GRID; x++) {
        if (c.used(x, z, x + w, z + d)) continue
        const v = score(c, { x, z, w, d }, rot)
        if (v < bestV) { bestV = v; best = { id, x, z, rot } }
      }
  }
  return best
}

// ── caminhos ───────────────────────────────────────────────────────────────

const STEPS: Cell[] = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]

// Busca em largura até o alvo mais próximo; devolve as células do trajeto (início e alvo inclusos).
// `isTarget` recebe também a distância percorrida até a célula.
function bfs(start: Cell, isTarget: (c: Cell, dist: number) => boolean, walkable: (c: Cell) => boolean, max: number) {
  if (!inside(start) || !walkable(start)) return null
  const prev = new Int32Array(GRID * GRID).fill(-2)
  const dist = new Int32Array(GRID * GRID).fill(-1)
  const q: Cell[] = [start]
  prev[at(start.x, start.z)] = -1
  dist[at(start.x, start.z)] = 0
  for (let h = 0; h < q.length; h++) {
    const c = q[h], dc = dist[at(c.x, c.z)]
    if (isTarget(c, dc)) {
      const out: Cell[] = []
      for (let k = at(c.x, c.z); k !== -1; k = prev[k]) out.unshift({ x: k % GRID, z: Math.floor(k / GRID) })
      return out
    }
    if (dc >= max) continue
    for (const st of STEPS) {
      const n = { x: c.x + st.x, z: c.z + st.z }
      if (!inside(n) || prev[at(n.x, n.z)] !== -2 || !walkable(n)) continue
      prev[at(n.x, n.z)] = at(c.x, c.z)
      dist[at(n.x, n.z)] = dc + 1
      q.push(n)
    }
  }
  return null
}

// Pontos de partida dos outros itens (construções, não mobiliário) que estão livres para receber caminho
function entries(s: Site, except: number) {
  const set = new Set<number>()
  s.live.forEach((p, i) => {
    if (i === except || ITEM_BY_ID[p.itemId].decor) return
    const e = entryOf(s.rect[i], p.rot)
    if (inside(e) && (isFree(s, e) || isPath(s, e))) set.add(at(e.x, e.z))
  })
  return set
}

const walkPath = (s: Site) => (c: Cell) => isFree(s, c) || isPath(s, c)

// Liga o ponto de partida do item `i` ao vizinho mais próximo. Se o vizinho é outro elemento, só
// constrói quando o trajeto entre os pontos de partida tem de `min` a `max` blocos (mais perto que
// isso eles já são vizinhos de porta). Se é um caminho existente, só fecha o trecho que falta.
function linkItem(s: Site, i: number, pathId: string, min: number, max: number) {
  const start = entryOf(s.rect[i], s.live[i].rot)
  const targets = entries(s, i)
  // pontos de partida a menos de `min` blocos não contam (são vizinhos de porta): a busca segue adiante
  const route = bfs(start, (c, d) => d > 0 && (isPath(s, c) || (targets.has(at(c.x, c.z)) && d >= min)), walkPath(s), max)
  if (!route) return []
  const out: SketchItem[] = []
  for (const c of route) {
    if (!isFree(s, c)) continue
    const tile = { id: pathId, x: c.x, z: c.z, rot: 0 as Rot }
    addToSite(s, { uid: `a${++seq}`, itemId: pathId, x: c.x, z: c.z, rot: 0 })
    out.push(tile)
  }
  return out
}

// ── itens com leitura própria (caminhos, cercas, mobiliário de apoio) ──────

export type Plan = { items: SketchItem[]; note: string }

function connectAll(s: Site, id: string): Plan {
  const name = ITEM_BY_ID[id].name.toLowerCase()
  const order = s.live.map((_, i) => i).filter((i) => !ITEM_BY_ID[s.live[i].itemId].decor)
  const h = coreHub(s)
  order.sort((a, b) => Math.hypot(center(s.rect[a]).x - h.x, center(s.rect[a]).z - h.z) - Math.hypot(center(s.rect[b]).x - h.x, center(s.rect[b]).z - h.z))
  const items: SketchItem[] = []
  let linked = 0
  for (const i of order) {
    const e = entryOf(s.rect[i], s.live[i].rot)
    if (!inside(e) || isSolid(s, e)) continue
    if (isPath(s, e) || STEPS.some((st) => isPath(s, { x: e.x + st.x, z: e.z + st.z }))) continue
    const tiles = linkItem(s, i, id, 1, 24)
    if (tiles.length) { items.push(...tiles); linked++ }
  }
  return { items, note: items.length ? `${items.length} trechos de ${name} ligando ${linked} acessos` : 'Todos os acessos já estão ligados' }
}

function accessRoad(s: Site): Plan {
  const i = s.live.findIndex((p) => p.itemId === 'lobby')
  const j = i >= 0 ? i : s.live.findIndex((p) => p.itemId === 'parking')
  if (j < 0) return { items: [], note: 'Coloque a recepção ou o estacionamento antes da via de acesso' }
  const isRoad = (c: Cell) => { const k = itemAt(s, c); return k >= 0 && s.live[k].itemId === 'road' }
  // parte de qualquer célula livre na frente do prédio (a porta pode já ter caminho) até a divisa sul
  const r = s.rect[j], rot = s.live[j].rot, f = FRONT[rot], e = entryOf(r, rot)
  const span = f.x ? r.d : r.w
  let route: Cell[] | null = null
  for (let k = 0; k < span; k++) {
    const c = f.x ? { x: e.x, z: r.z + k } : { x: r.x + k, z: e.z }
    const t = bfs(c, (q) => q.z === GRID - 1, (q) => isFree(s, q) || isRoad(q), 40)
    if (t && (!route || t.length < route.length)) route = t
  }
  if (!route) return { items: [], note: 'Não há passagem livre até a divisa sul' }
  const items = route.filter((c) => isFree(s, c)).map((c) => ({ id: 'road', x: c.x, z: c.z, rot: 0 as Rot }))
  return { items, note: `Via de acesso com ${items.length} trechos, da divisa sul até a ${i >= 0 ? 'recepção' : 'entrada do estacionamento'}` }
}

// Anel de peças em volta de um conjunto de itens, deixando livre a frente de cada um
function ring(s: Site, targets: string[], id: string, label: string): Plan {
  const idx = s.live.map((_, i) => i).filter((i) => targets.includes(s.live[i].itemId))
  if (!idx.length) return { items: [], note: `Não há ${label} para cercar` }
  const box = idx.map((i) => s.rect[i]).reduce((a, r) => {
    const x = Math.min(a.x, r.x), z = Math.min(a.z, r.z)
    return { x, z, w: Math.max(a.x + a.w, r.x + r.w) - x, d: Math.max(a.z + a.d, r.z + r.d) - z }
  })
  const openings = new Set(idx.map((i) => { const e = entryOf(s.rect[i], s.live[i].rot); return at(e.x, e.z) }))
  const items: SketchItem[] = []
  for (let z = box.z - 1; z <= box.z + box.d; z++)
    for (let x = box.x - 1; x <= box.x + box.w; x++) {
      const onRing = x === box.x - 1 || x === box.x + box.w || z === box.z - 1 || z === box.z + box.d
      if (onRing && isFree(s, { x, z }) && !openings.has(at(x, z))) items.push({ id, x, z, rot: 0 })
    }
  return { items, note: `${ITEM_BY_ID[id].name} em volta ${label === 'o estacionamento' ? 'do estacionamento' : `das ${label}`}, com passagem na entrada` }
}

function eastWall(s: Site): Plan {
  const lux = s.t.zones.luxury[0]
  const items: SketchItem[] = []
  for (let z = lux.z; z < lux.z + lux.d; z++) if (isFree(s, { x: GRID - 1, z })) items.push({ id: 'wall', x: GRID - 1, z, rot: 0 })
  return { items, note: 'Muro na divisa leste, protegendo a ala de luxo' }
}

function poolDeck(s: Site): Plan {
  const i = s.live.findIndex((p) => POOLS.includes(p.itemId))
  if (i < 0) return { items: [], note: 'Coloque uma piscina antes do deck' }
  const r = s.rect[i], e = entryOf(r, s.live[i].rot)
  const items: SketchItem[] = []
  for (let z = r.z - 1; z <= r.z + r.d; z++)
    for (let x = r.x - 1; x <= r.x + r.w; x++) {
      const onRing = x === r.x - 1 || x === r.x + r.w || z === r.z - 1 || z === r.z + r.d
      const corner = (x === r.x - 1 || x === r.x + r.w) && (z === r.z - 1 || z === r.z + r.d)
      if (onRing && !corner && isFree(s, { x, z }) && !(x === e.x && z === e.z)) items.push({ id: 'deck', x, z, rot: 0 })
    }
  return { items, note: `Deck de madeira em volta da ${ITEM_BY_ID[s.live[i].itemId].name.toLowerCase()}` }
}

// Postes e balizadores: um a cada `every` trechos de caminho, numa célula livre ao lado
function alongPaths(s: Site, id: string, every: number, max: number, nearIds?: string[]): Plan {
  const tiles: Cell[] = []
  s.live.forEach((p) => { if (PATHS.has(p.itemId)) tiles.push({ x: p.x, z: p.z }) })
  if (!tiles.length) return { items: [], note: 'Construa caminhos antes da iluminação' }
  const near = nearIds && rectsOf(s, nearIds)
  const items: SketchItem[] = []
  const taken = (c: Cell) => s.live.some((p) => p.itemId === id && Math.max(Math.abs(p.x - c.x), Math.abs(p.z - c.z)) < every - 1)
    || items.some((q) => Math.max(Math.abs(q.x - c.x), Math.abs(q.z - c.z)) < every - 1)
  for (const t of tiles.sort((a, b) => a.z - b.z || a.x - b.x)) {
    if (items.length >= max) break
    if (near && nearest({ x: t.x, z: t.z, w: 1, d: 1 }, near) > 6) continue
    const side = STEPS.map((st) => ({ x: t.x + st.x, z: t.z + st.z })).find((c) => isFree(s, c) && !taken(c))
    if (!side) continue
    items.push({ id, x: side.x, z: side.z, rot: 0 })
  }
  const name = ITEM_BY_ID[id].name.toLowerCase()
  return { items, note: items.length ? `${items.length} × ${name} ao longo dos caminhos` : `Os caminhos já têm ${name}` }
}

function benches(s: Site): Plan {
  const items: SketchItem[] = []
  const tiles = s.live.filter((p) => PATHS.has(p.itemId))
  if (!tiles.length) return { items, note: 'Construa caminhos antes dos bancos' }
  const views = rectsOf(s, [...POOLS, 'garden', 'lake', 'fountain'])
  const scored = tiles
    .map((t) => ({ t, d: nearest({ x: t.x, z: t.z, w: 1, d: 1 }, views) }))
    .sort((a, b) => a.d - b.d)
  for (const { t } of scored) {
    if (items.length >= 2) break
    for (const [k, st] of STEPS.entries()) {
      const c = { x: t.x + st.x, z: t.z + st.z }
      if (!isFree(s, c) || items.some((q) => Math.abs(q.x - c.x) + Math.abs(q.z - c.z) < 3)) continue
      // a frente do banco aponta para o caminho
      const rot = ([3, 1, 2, 0] as Rot[])[k]
      items.push({ id: 'bench', x: c.x, z: c.z, rot })
      break
    }
  }
  return { items, note: items.length ? 'Bancos à beira do caminho, perto do lazer' : 'Não há lugar livre à beira dos caminhos' }
}

// Paisagismo pontual: uma peça por clique, ao lado de caminho ou construção e longe das iguais
function plant(s: Site, id: string): Plan {
  const prefer = rectsOf(s, id === 'palm' ? POOLS : id === 'flowerbed' ? ['lobby', 'fountain', 'garden'] : [...LODGING, ...UNITS, 'garden'])
  // âncora: construção ou caminho a até 1 bloco de folga; vizinho igual a menos de 2 blocos não vale
  const anchor = counter((k) => { const i = s.occ[k]; return i >= 0 && (!ITEM_BY_ID[s.live[i].itemId].decor || PATHS.has(s.live[i].itemId)) })
  const same = counter((k) => { const i = s.occ[k]; return i >= 0 && s.live[i].itemId === id })
  const within1 = (q: Count, x: number, z: number) => q(x - 2, z - 1, x + 3, z + 2) + q(x - 1, z - 2, x + 2, z + 3) > 0
  const sameRects = rectsOf(s, [id])
  let best: Cell | null = null, bestV = Infinity
  const h = coreHub(s)
  for (let z = 0; z < GRID; z++)
    for (let x = 0; x < GRID; x++) {
      if (s.occ[at(x, z)] !== -1 || !within1(anchor, x, z) || within1(same, x, z)) continue
      const r = { x, z, w: 1, d: 1 }
      const v = 0.5 * Math.min(nearest(r, prefer), 12) + 0.03 * Math.hypot(x + 0.5 - h.x, z + 0.5 - h.z) - Math.min(nearest(r, sameRects), 6) * 0.1
      if (v < bestV) { bestV = v; best = { x, z } }
    }
  if (!best) return { items: [], note: `Não há lugar livre para ${ITEM_BY_ID[id].name.toLowerCase()}` }
  return { items: [{ id, x: best.x, z: best.z, rot: 0 }], note: `${ITEM_BY_ID[id].name} ao lado do caminho, junto ao lazer` }
}

const SPECIAL: Record<string, (s: Site, id: string) => Plan> = {
  path_stone: connectAll,
  path_paved: connectAll,
  road: (s) => accessRoad(s),
  deck: (s) => poolDeck(s),
  hedge: (s) => ring(s, ['parking'], 'hedge', 'o estacionamento'),
  fence: (s) => ring(s, COURTS, 'fence', 'quadras'),
  wall: (s) => eastWall(s),
  lamp: (s) => alongPaths(s, 'lamp', 4, 16),
  bollard: (s) => alongPaths(s, 'bollard', 3, 12, [...LODGING, ...UNITS]),
  bench: (s) => benches(s),
  tree: plant,
  palm: plant,
  flowerbed: plant,
}

// ── entrada ────────────────────────────────────────────────────────────────

const DEFAULT_RULE: Rule = { zone: 'core', why: 'no espaço livre mais perto do núcleo' }

// Planeja um item no terreno e já o registra nele, para o próximo item enxergar. Com `link`, liga a
// construção nova ao vizinho por caminho quando os pontos de partida ficam a 3–7 blocos.
export function placeOn(s: Site, id: string, link = true): Plan {
  const item = ITEM_BY_ID[id]
  const special = SPECIAL[id]
  if (special) {
    const plan = special(s, id)
    commit(s, plan.items)
    return plan
  }
  const rule = RULES[id] ?? DEFAULT_RULE
  const spot = bestSpot(s, id, rule)
  if (!spot) return { items: [], note: `Não há espaço livre para ${item.name.toLowerCase()}` }
  addToSite(s, { uid: `a${++seq}`, itemId: id, x: spot.x, z: spot.z, rot: spot.rot })
  const paths = link && !item.decor ? linkItem(s, s.live.length - 1, 'path_stone', PATH_MIN, PATH_MAX) : []
  const n = paths.length
  return {
    items: [spot, ...paths],
    note: `${item.name}: ${s.t.why?.[id] ?? rule.why}${n ? ` · ${n} ${n === 1 ? 'trecho' : 'trechos'} de caminho até o vizinho` : ''}`,
  }
}

// Constrói `n` unidades do item onde fazem mais sentido, sem selecionar (respostas do checklist);
// devolve quantas couberam
export function autoAdd(id: string, n = 1) {
  const s = readSite()
  const items: SketchItem[] = []
  for (let k = 0; k < n; k++) items.push(...placeOn(s, id).items)
  return useStore.getState().addItems(items, 110).filter((p) => p.itemId === id).length
}

export function autoPlace(id: string) {
  const store = useStore.getState()
  const special = !!SPECIAL[id]
  const plan = placeOn(readSite(), id)
  const added = store.addItems(plan.items, special ? 45 : 110)
  if (plan.items.length && !added.length) { store.notify(`Não há espaço livre para ${ITEM_BY_ID[id].name.toLowerCase()}`); return }
  if (!special && added.length) store.select(added[0].uid)
  store.notify(plan.note)
}
