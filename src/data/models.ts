import type { SketchItem } from '../store'
import type { Rot } from '../lib/valuation'
import type { Spec } from '../lib/spec'
import { generate } from '../lib/program'

// Modelos para começar: cada um parte de um modelo de implantação usado por resorts reais.
// Os paramétricos são gerados pelos campos do modo analista; o exemplo foi desenhado à mão.

// Trecho reto de peças 1×1, de (x0, z0) a (x1, z1) inclusive
function run(id: string, x0: number, z0: number, x1: number, z1: number, skip: [number, number][] = []): SketchItem[] {
  const out: SketchItem[] = []
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
      if (!skip.some(([sx, sz]) => sx === x && sz === z)) out.push({ id, x, z, rot: 0 })
  return out
}

const at = (id: string, x: number, z: number, rot: Rot = 0): SketchItem => ({ id, x, z, rot })

// Resort de exemplo, desenhado peça por peça
const EXAMPLE: SketchItem[] = [
  // chegada: estacionamento, recepção e jardim
  at('parking', 2, 35), at('lobby', 14, 34), at('garden', 20, 33),
  at('palm', 12, 35), at('palm', 12, 38), at('palm', 19, 38), at('palm', 13, 32),
  // hospedagem principal, de frente para o lazer
  at('std', 0, 29), at('std', 0, 24), at('std', 0, 19), at('family', 7, 29),
  at('alacarte', 7, 24), at('gym', 8, 20), at('kids', 1, 14), at('playground', 6, 14),
  // núcleo de piscinas e restaurantes
  at('pool', 13, 24), at('kidpool', 18, 25), at('swimup', 13, 21), at('poolbar', 17, 21),
  at('jacuzzi', 20, 24), at('lounge', 20, 21), at('buffet', 13, 15), at('alacarte', 20, 16),
  at('palm', 11, 23), at('palm', 19, 28), at('palm', 11, 20), at('palm', 23, 24),
  // esportes, teatro e parque aquático ao fundo
  at('tennis', 1, 1), at('multi', 1, 6), at('beach', 9, 1), at('padel', 9, 5),
  at('games', 9, 8), at('veg', 15, 2), at('theater', 21, 1), at('minigolf', 14, 8),
  at('waterpark', 29, 1), at('kiosk', 35, 10),
  // lago, píer e bangalôs
  at('lake', 30, 13), at('pier', 38, 12), at('bungalow', 27, 13), at('bungalow', 27, 16),
  at('bungalow', 33, 20), at('bungalow', 36, 20),
  // área de luxo: suítes, borda infinita, villas, chalés e spa
  at('suite', 27, 21), at('infinity', 27, 26), at('villa', 34, 26), at('villa', 34, 31),
  at('chalet', 28, 33), at('chalet', 31, 33), at('chalet', 28, 36), at('chalet', 31, 36),
  at('spa', 21, 28), at('sauna', 21, 32),
  at('palm', 26, 32), at('palm', 33, 29), at('palm', 38, 24), at('palm', 25, 20),
  // caminhos: eixo norte-sul, travessa entre os edifícios e acesso ao jardim
  ...run('path_stone', 12, 7, 12, 34),
  ...run('path_stone', 0, 27, 26, 27, [[12, 27]]),
  ...run('path_stone', 13, 33, 19, 33),
  // via de entrada com guarita, cerca viva no estacionamento, muro das villas e deck da borda infinita
  ...run('road', 0, 39, 19, 39), at('gatehouse', 0, 37),
  ...run('hedge', 2, 34, 11, 34),
  ...run('wall', 39, 27, 39, 38),
  ...run('deck', 27, 25, 31, 25),
  // iluminação e mobiliário
  ...[11, 15, 18, 22, 26, 30, 33].map((z) => at('lamp', 11, z)),
  ...[3, 8, 16, 20].map((x) => at('lamp', x, 28)),
  at('bench', 13, 30, 1), at('bench', 11, 28, 1), at('sunbeds', 20, 26), at('sunbeds', 21, 26),
  at('bollard', 15, 32), at('bollard', 17, 32),
  at('tree', 14, 19), at('tree', 16, 19), at('tree', 18, 19),
  at('flowerbed', 19, 35), at('flowerbed', 19, 36), at('flowerbed', 19, 37),
  at('pergola', 27, 30), at('gazebo', 28, 19), at('firepit', 23, 10), at('fountain', 12, 36), at('hammock', 35, 23),
]

export interface ResortModel {
  id: string
  name: string
  note: string           // como o terreno é organizado
  refs?: string          // onde esse modelo aparece no mundo real
  spec?: Spec            // modelo paramétrico: os campos do analista geram o mapa
  items?: SketchItem[]   // modelo desenhado à mão
}

const spec = (s: Partial<Spec>): Spec => ({ destino: null, categoria: null, uhs: null, publico: null, adr: null, ocupacao: null, orcamento: null, ...s })

export const MODELS: ResortModel[] = [
  {
    id: 'praia-ai',
    name: 'All inclusive pé na areia',
    note: 'Fileiras de quartos de frente para o mar, piscinas e restaurantes entre os quartos e a areia, parque aquático num canto.',
    refs: 'Frente de mar, como o Costão do Santinho (Florianópolis, SC)',
    spec: spec({ destino: 'praia', categoria: 'ai', uhs: 300, publico: 'familias' }),
  },
  {
    id: 'campo-familia',
    name: 'Resort de campo para famílias',
    note: 'Núcleo central de piscinas e restaurantes, quartos em ferradura em volta, quadras junto à entrada, lago e horta.',
    refs: 'Núcleo central, como o Grand Palladium Imbassaí e o Club Med Trancoso (BA)',
    spec: spec({ destino: 'campo', categoria: 'resort', uhs: 200, publico: 'familias' }),
  },
  {
    id: 'praia-lux',
    name: 'Villas de luxo na praia',
    note: 'Núcleo compacto na chegada, villas e bangalôs espalhados rumo ao mar com vista e privacidade, píer sobre o mar.',
    refs: 'Vila de bangalôs, como o Nannai (Muro Alto, PE) e o Club Med Rio das Pedras (RJ)',
    spec: spec({ destino: 'praia', categoria: 'lux', uhs: 50, publico: 'casais' }),
  },
  {
    id: 'serra-casais',
    name: 'Refúgio na serra',
    note: 'Prédio baixo de quartos e suítes junto ao lazer, spa, sauna e fogueira, muito verde em volta.',
    spec: spec({ destino: 'serra', categoria: 'up', uhs: 80, publico: 'casais' }),
  },
  {
    id: 'eventos',
    name: 'Hotel de eventos',
    note: 'Centro de convenções colado à recepção, estacionamento maior e lazer compacto para quem fica poucos dias.',
    spec: spec({ destino: 'campo', categoria: 'up', uhs: 180, publico: 'eventos' }),
  },
  {
    id: 'exemplo',
    name: 'Exemplo desenhado à mão',
    note: 'O resort de exemplo, peça por peça: núcleo de piscinas, alas de quartos, lago com bangalôs e villas.',
    items: EXAMPLE,
  },
]

export const layoutOf = (m: ResortModel): SketchItem[] => m.items ?? generate(m.spec!).items
