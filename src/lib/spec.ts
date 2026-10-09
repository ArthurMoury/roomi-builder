import type { TemplateId } from '../store'

// Respostas do questionário: o que a visão de negócios define antes de existir um projeto

export type Destino = 'praia' | 'campo' | 'serra'
export type Publico = 'familias' | 'casais' | 'eventos' | 'misto'
export type TierId = 'eco' | 'mid' | 'up' | 'resort' | 'ai' | 'lux'
export type BudgetId = 'ate50' | '50a100' | '100a200' | '200a400' | 'acima400'

export interface Spec {
  destino: Destino | null
  categoria: TierId | null
  uhs: number | null
  publico: Publico | null
  adr: number | null        // tarifa média esperada (R$)
  ocupacao: number | null   // ocupação esperada (%)
  orcamento: BudgetId | null // faixa de investimento disponível (nunca um valor exato)
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

// Faixas de orçamento, em reais
export const BUDGETS: { id: BudgetId; label: string; min: number; max: number }[] = [
  { id: 'ate50', label: 'Até R$ 50 mi', min: 0, max: 50e6 },
  { id: '50a100', label: 'R$ 50 a 100 mi', min: 50e6, max: 100e6 },
  { id: '100a200', label: 'R$ 100 a 200 mi', min: 100e6, max: 200e6 },
  { id: '200a400', label: 'R$ 200 a 400 mi', min: 200e6, max: 400e6 },
  { id: 'acima400', label: 'Acima de R$ 400 mi', min: 400e6, max: Infinity },
]

// O modelo de implantação vem do destino; luxo na praia vira vila de bangalôs
export const templateOf = (spec: Spec): TemplateId =>
  spec.destino === 'praia' && spec.categoria === 'lux' ? 'vila' : DESTINOS.find((d) => d.id === spec.destino)?.template ?? 'nucleo'
