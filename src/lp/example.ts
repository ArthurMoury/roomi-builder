import { ITEM_BY_ID } from '../data/catalog'
import { MODELS, layoutOf } from '../data/models'
import { evaluate, type Placed } from '../lib/valuation'
import { EXTRAS, business } from '../lib/business'

// O resort de exemplo da LP é o primeiro modelo da galeria (all inclusive pé na areia, 300 UHs),
// montado pelo mesmo motor do Builder. Todos os números da LP saem daqui, nunca escritos à mão.

export const MODEL = MODELS[0]
const items = layoutOf(MODEL)

// Etapas da obra contada na rolagem
const ARRIVAL = new Set(['lobby', 'parking', 'road', 'gatehouse'])
function stageOf(id: string) {
  const it = ITEM_BY_ID[id]
  if (ARRIVAL.has(id)) return 0
  if (it.cat === 'hospedagem') return 1
  if (it.decor) return 3
  return 2
}

export interface ShowItem extends Placed { key: number; stage: number }
export const SHOW: ShowItem[] = items.map((it, k) => ({ key: k, uid: `s${k}`, itemId: it.id, x: it.x, z: it.z, rot: it.rot, stage: stageOf(it.id) }))

// Investimento completo: obra mais os custos fora da obra (FF&E, projetos, pré-operacional e contingência)
const all = Object.fromEntries(EXTRAS.map((e) => [e.id, true]))
const ev = evaluate(SHOW)
export const BIZ = business(ev, SHOW, MODEL.spec!, all)
export const EV = ev

// O board a cada etapa: o que já foi construído, em UHs, obra e categoria
export const STAGE_FACTS = [0, 1, 2, 3].map((s) => {
  const built = SHOW.filter((p) => p.stage <= s)
  const e = evaluate(built)
  return { items: built.length, added: SHOW.filter((p) => p.stage === s).length, keys: e.keys, cost: e.cost, tier: e.tier?.name ?? null }
})
