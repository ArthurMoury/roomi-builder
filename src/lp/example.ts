import { MODELS, layoutOf } from '../data/models'
import { evaluate, type Placed } from '../lib/valuation'
import { EXTRAS, business } from '../lib/business'

// O resort de exemplo da LP é o primeiro modelo da galeria (all inclusive pé na areia, 300 UHs),
// montado pelo mesmo motor do Builder. Todos os números da LP saem daqui, nunca escritos à mão.

export const MODEL = MODELS[0]
export const SHOW: Placed[] = layoutOf(MODEL).map((it, k) => ({ uid: `s${k}`, itemId: it.id, x: it.x, z: it.z, rot: it.rot }))

// Investimento completo: obra mais os custos fora da obra (FF&E, projetos, pré-operacional e contingência)
const all = Object.fromEntries(EXTRAS.map((e) => [e.id, true]))
export const EV = evaluate(SHOW)
export const BIZ = business(EV, SHOW, MODEL.spec!, all)
