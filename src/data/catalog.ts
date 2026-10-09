// Catálogo de itens construíveis. Custos de obra em R$ (sem terreno), pesquisa de out/2026:
// CUB Sinduscon-SP ago/2026, SINAPI mai/2026, faixas de piscina (R$ 3,5–5,5 mil/m² de lâmina),
// orçamentos de quadras e editais públicos de campo society. Itens com `est` são estimativas.
// 1 célula do mapa = 5 m × 5 m. As pegadas seguem as medidas reais de cada equipamento.

export type Cat =
  | 'hospedagem' | 'aquatico' | 'esporte' | 'gastronomia'
  | 'bemestar' | 'familia' | 'servicos' | 'natureza' | 'caminhos' | 'mobiliario'

export type Tag =
  | 'lobby' | 'restaurant' | 'buffet' | 'alacarte' | 'bar' | 'poolbar' | 'swimup'
  | 'pool' | 'infinity' | 'waterpark' | 'court' | 'gym' | 'spa' | 'kids' | 'events'
  | 'shows' | 'nature' | 'heli' | 'marina' | 'lux' | 'villa'

export interface Item {
  id: string
  name: string
  cat: Cat
  w: number          // largura em células (5 m)
  d: number          // profundidade em células (5 m)
  cost: number       // custo de obra (R$)
  area: number       // área construída de referência (m²)
  keys?: number      // UHs (unidades habitacionais)
  adrMult?: number   // peso da diária da UH em relação ao quarto standard
  tags: Tag[]
  est?: boolean
  decor?: boolean    // infraestrutura e paisagismo: não conta como amenidade na diária
  paint?: boolean    // pode ser "pintado" arrastando no terreno
  link?: boolean     // peça de 5 m que se liga às vizinhas iguais (caminhos, cercas)
}

export const CELL_METERS = 5

export const CATS: { id: Cat; label: string }[] = [
  { id: 'hospedagem', label: 'Hospedagem' },
  { id: 'aquatico', label: 'Aquático' },
  { id: 'esporte', label: 'Esporte' },
  { id: 'gastronomia', label: 'Gastronomia' },
  { id: 'bemestar', label: 'Bem-estar' },
  { id: 'familia', label: 'Família' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'natureza', label: 'Natureza' },
  { id: 'caminhos', label: 'Caminhos e cercas' },
  { id: 'mobiliario', label: 'Mobiliário' },
]

export const ITEMS: Item[] = [
  // Hospedagem — custo por UH: standard ~R$ 250 mil (≈2× CUB CSL-16), suíte ~R$ 420 mil, família ~R$ 410 mil
  { id: 'std', name: 'Edifício 48 quartos standard', cat: 'hospedagem', w: 6, d: 3, cost: 12_000_000, area: 2160, keys: 48, adrMult: 1, tags: [], est: true },
  { id: 'suite', name: 'Bloco 16 suítes luxo', cat: 'hospedagem', w: 5, d: 3, cost: 6_720_000, area: 1040, keys: 16, adrMult: 1.4, tags: ['lux'], est: true },
  { id: 'family', name: 'Bloco 12 aptos família', cat: 'hospedagem', w: 4, d: 3, cost: 4_920_000, area: 900, keys: 12, adrMult: 1.15, tags: [], est: true },
  { id: 'chalet', name: 'Chalé', cat: 'hospedagem', w: 2, d: 2, cost: 300_000, area: 50, keys: 1, adrMult: 1.2, tags: [], est: true },
  { id: 'bungalow', name: 'Bangalô sobre a água', cat: 'hospedagem', w: 2, d: 2, cost: 525_000, area: 70, keys: 1, adrMult: 1.6, tags: ['lux'], est: true },
  { id: 'villa', name: 'Villa com piscina privativa', cat: 'hospedagem', w: 3, d: 3, cost: 1_440_000, area: 170, keys: 1, adrMult: 2.6, tags: ['lux', 'villa'], est: true },

  // Aquático
  { id: 'pool', name: 'Piscina adulto', cat: 'aquatico', w: 5, d: 3, cost: 1_350_000, area: 300, tags: ['pool'] },
  { id: 'kidpool', name: 'Piscina infantil', cat: 'aquatico', w: 2, d: 2, cost: 210_000, area: 60, tags: ['pool'] },
  { id: 'infinity', name: 'Piscina borda infinita', cat: 'aquatico', w: 5, d: 3, cost: 1_400_000, area: 200, tags: ['pool', 'infinity'], est: true },
  { id: 'indoor', name: 'Piscina coberta aquecida', cat: 'aquatico', w: 4, d: 3, cost: 1_350_000, area: 150, tags: ['pool'], est: true },
  { id: 'jacuzzi', name: 'Ofurô / jacuzzi', cat: 'aquatico', w: 1, d: 1, cost: 80_000, area: 10, tags: [], est: true },
  { id: 'swimup', name: 'Bar molhado (swim-up)', cat: 'aquatico', w: 3, d: 2, cost: 350_000, area: 40, tags: ['swimup', 'bar'], est: true },
  { id: 'waterpark', name: 'Parque aquático', cat: 'aquatico', w: 9, d: 9, cost: 8_000_000, area: 2000, tags: ['waterpark', 'pool'], est: true },

  // Esporte
  { id: 'tennis', name: 'Quadra de tênis (saibro)', cat: 'esporte', w: 7, d: 4, cost: 250_000, area: 670, tags: ['court'], est: true },
  { id: 'beach', name: 'Quadra de beach tennis', cat: 'esporte', w: 4, d: 3, cost: 100_000, area: 340, tags: ['court'] },
  { id: 'padel', name: 'Quadra de padel', cat: 'esporte', w: 4, d: 2, cost: 180_000, area: 230, tags: ['court'], est: true },
  { id: 'multi', name: 'Quadra poliesportiva', cat: 'esporte', w: 6, d: 4, cost: 90_000, area: 640, tags: ['court'] },
  { id: 'society', name: 'Campo society', cat: 'esporte', w: 10, d: 6, cost: 520_000, area: 1440, tags: ['court'] },
  { id: 'minigolf', name: 'Mini golfe', cat: 'esporte', w: 5, d: 5, cost: 250_000, area: 600, tags: [], est: true },
  { id: 'gym', name: 'Academia', cat: 'esporte', w: 3, d: 2, cost: 900_000, area: 150, tags: ['gym'], est: true },

  // Gastronomia
  { id: 'buffet', name: 'Restaurante buffet', cat: 'gastronomia', w: 6, d: 4, cost: 4_200_000, area: 600, tags: ['restaurant', 'buffet'], est: true },
  { id: 'alacarte', name: 'Restaurante à la carte', cat: 'gastronomia', w: 4, d: 3, cost: 2_000_000, area: 250, tags: ['restaurant', 'alacarte'], est: true },
  { id: 'poolbar', name: 'Bar de piscina', cat: 'gastronomia', w: 2, d: 2, cost: 400_000, area: 80, tags: ['bar', 'poolbar'], est: true },
  { id: 'lounge', name: 'Lounge / bar', cat: 'gastronomia', w: 3, d: 2, cost: 1_050_000, area: 150, tags: ['bar'], est: true },
  { id: 'kiosk', name: 'Quiosque / snack bar', cat: 'gastronomia', w: 2, d: 1, cost: 160_000, area: 40, tags: [], est: true },

  // Bem-estar
  { id: 'spa', name: 'Spa', cat: 'bemestar', w: 6, d: 4, cost: 5_400_000, area: 600, tags: ['spa'], est: true },
  { id: 'sauna', name: 'Sauna seca + vapor', cat: 'bemestar', w: 2, d: 1, cost: 300_000, area: 40, tags: [], est: true },

  // Família
  { id: 'kids', name: 'Kids club', cat: 'familia', w: 4, d: 3, cost: 1_400_000, area: 250, tags: ['kids'], est: true },
  { id: 'playground', name: 'Playground', cat: 'familia', w: 4, d: 3, cost: 150_000, area: 300, tags: [], est: true },
  { id: 'games', name: 'Sala de jogos / teens', cat: 'familia', w: 3, d: 2, cost: 750_000, area: 150, tags: [], est: true },

  // Serviços e infraestrutura
  { id: 'lobby', name: 'Recepção / lobby', cat: 'servicos', w: 5, d: 4, cost: 3_000_000, area: 400, tags: ['lobby'], est: true },
  { id: 'convention', name: 'Centro de convenções', cat: 'servicos', w: 8, d: 6, cost: 9_750_000, area: 1500, tags: ['events'], est: true },
  { id: 'theater', name: 'Teatro de shows', cat: 'servicos', w: 5, d: 4, cost: 2_500_000, area: 400, tags: ['shows'], est: true },
  { id: 'parking', name: 'Estacionamento 40 vagas', cat: 'servicos', w: 10, d: 4, cost: 250_000, area: 1000, tags: [], est: true, decor: true },
  { id: 'heli', name: 'Heliponto', cat: 'servicos', w: 5, d: 5, cost: 500_000, area: 625, tags: ['heli'], est: true },
  { id: 'pier', name: 'Marina / píer', cat: 'servicos', w: 2, d: 6, cost: 1_200_000, area: 200, tags: ['marina'], est: true },
  { id: 'gatehouse', name: 'Guarita / portaria', cat: 'servicos', w: 2, d: 2, cost: 120_000, area: 15, tags: [], est: true, decor: true },

  // Natureza
  { id: 'garden', name: 'Jardim paisagístico', cat: 'natureza', w: 6, d: 6, cost: 135_000, area: 900, tags: ['nature'], est: true },
  { id: 'lake', name: 'Lago ornamental', cat: 'natureza', w: 8, d: 6, cost: 144_000, area: 1200, tags: ['nature'], est: true },
  { id: 'veg', name: 'Horta orgânica', cat: 'natureza', w: 4, d: 3, cost: 30_000, area: 300, tags: ['nature'], est: true },
  { id: 'palm', name: 'Palmeira', cat: 'natureza', w: 1, d: 1, cost: 4_000, area: 25, tags: [], est: true, decor: true, paint: true },
  { id: 'tree', name: 'Árvore', cat: 'natureza', w: 1, d: 1, cost: 1_500, area: 25, tags: [], est: true, decor: true, paint: true },
  { id: 'flowerbed', name: 'Canteiro de flores', cat: 'natureza', w: 1, d: 1, cost: 1_200, area: 6, tags: [], est: true, decor: true, paint: true },

  // Caminhos e cercas: trechos de 5 m que se ligam aos vizinhos iguais. Custos por trecho (estimativas):
  // pedra natural ~R$ 300/m², intertravado ~R$ 150/m², asfalto ~R$ 180/m², deck ~R$ 450/m², cerca ~R$ 180/m.
  { id: 'path_stone', name: 'Caminho de pedra', cat: 'caminhos', w: 1, d: 1, cost: 2_250, area: 7.5, tags: [], est: true, decor: true, paint: true, link: true },
  { id: 'path_paved', name: 'Calçada intertravada', cat: 'caminhos', w: 1, d: 1, cost: 1_500, area: 10, tags: [], est: true, decor: true, paint: true, link: true },
  { id: 'road', name: 'Via interna (asfalto)', cat: 'caminhos', w: 1, d: 1, cost: 4_500, area: 25, tags: [], est: true, decor: true, paint: true, link: true },
  { id: 'deck', name: 'Deck de madeira', cat: 'caminhos', w: 1, d: 1, cost: 11_250, area: 25, tags: [], est: true, decor: true, paint: true },
  { id: 'fence', name: 'Cerca de madeira', cat: 'caminhos', w: 1, d: 1, cost: 900, area: 5, tags: [], est: true, decor: true, paint: true, link: true },
  { id: 'hedge', name: 'Cerca viva', cat: 'caminhos', w: 1, d: 1, cost: 600, area: 5, tags: [], est: true, decor: true, paint: true, link: true },
  { id: 'wall', name: 'Muro', cat: 'caminhos', w: 1, d: 1, cost: 3_000, area: 5, tags: [], est: true, decor: true, paint: true, link: true },

  // Mobiliário externo (estimativas de mercado, instalado)
  { id: 'lamp', name: 'Poste de iluminação', cat: 'mobiliario', w: 1, d: 1, cost: 3_500, area: 1, tags: [], est: true, decor: true },
  { id: 'bollard', name: 'Balizador de jardim', cat: 'mobiliario', w: 1, d: 1, cost: 800, area: 1, tags: [], est: true, decor: true, paint: true },
  { id: 'bench', name: 'Banco de jardim', cat: 'mobiliario', w: 1, d: 1, cost: 1_500, area: 2, tags: [], est: true, decor: true },
  { id: 'sunbeds', name: 'Espreguiçadeiras com ombrelone', cat: 'mobiliario', w: 1, d: 1, cost: 4_000, area: 6, tags: [], est: true, decor: true },
  { id: 'firepit', name: 'Fogueira (fire pit)', cat: 'mobiliario', w: 2, d: 2, cost: 8_000, area: 60, tags: [], est: true, decor: true },
  { id: 'pergola', name: 'Pergolado', cat: 'mobiliario', w: 2, d: 2, cost: 45_000, area: 70, tags: [], est: true, decor: true },
  { id: 'gazebo', name: 'Gazebo', cat: 'mobiliario', w: 2, d: 2, cost: 60_000, area: 40, tags: [], est: true, decor: true },
  { id: 'fountain', name: 'Chafariz', cat: 'mobiliario', w: 2, d: 2, cost: 40_000, area: 40, tags: [], est: true, decor: true },
  { id: 'hammock', name: 'Redário', cat: 'mobiliario', w: 2, d: 2, cost: 15_000, area: 80, tags: [], est: true, decor: true },
]

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<string, Item>
