import type { TemplateId } from '../store'

// Campos do modo analista: o que a visão de negócios define antes de existir um projeto

export type Destino = 'praia' | 'campo' | 'serra'
export type Publico = 'familias' | 'casais' | 'eventos' | 'misto'
export type TierId = 'eco' | 'mid' | 'up' | 'resort' | 'ai' | 'lux'

export interface Spec {
  destino: Destino | null
  categoria: TierId | null
  uhs: number | null
  publico: Publico | null
  adr: number | null        // tarifa média esperada (R$)
  ocupacao: number | null   // ocupação esperada (%)
  orcamento: number | null  // investimento disponível (R$)
}

export const EMPTY_SPEC: Spec = { destino: null, categoria: null, uhs: null, publico: null, adr: null, ocupacao: null, orcamento: null }

// Campos que mudam o que é construído (os demais só mudam as contas)
export const LAYOUT_FIELDS = ['destino', 'categoria', 'uhs', 'publico'] as const

export const DESTINOS: { id: Destino; label: string; template: TemplateId }[] = [
  { id: 'praia', label: 'Praia', template: 'praia' },
  { id: 'campo', label: 'Campo', template: 'nucleo' },
  { id: 'serra', label: 'Serra', template: 'nucleo' },
]

export const PUBLICOS: { id: Publico; label: string }[] = [
  { id: 'familias', label: 'Famílias' },
  { id: 'casais', label: 'Casais' },
  { id: 'eventos', label: 'Eventos' },
  { id: 'misto', label: 'Misto' },
]

export const MAX_UHS = 600

// O modelo de implantação vem do destino; luxo na praia vira vila de bangalôs
export const templateOf = (spec: Spec): TemplateId =>
  spec.destino === 'praia' && spec.categoria === 'lux' ? 'vila' : DESTINOS.find((d) => d.id === spec.destino)?.template ?? 'nucleo'
