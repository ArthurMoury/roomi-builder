import { ITEM_BY_ID } from '../data/catalog'
import { TIERS, type Evaluation, type Placed } from './valuation'
import { BUDGETS, type Spec, type TierId } from './spec'

// Visão de negócios: o investimento confirmado pelo checklist e a operação do hotel projetada em
// 10 anos, com os indicadores que um investidor de hotelaria pede: TRevPAR, GOP, EBITDA, yield on
// cost, TIR, VPL, valor do ativo, ocupação de equilíbrio e sensibilidade. Valores reais (sem
// inflação), em reais de hoje.

export interface ScopeItem {
  id: string
  ask: string                        // pergunta do checklist
  ids: string[]                      // itens do catálogo que respondem por ela no mapa
  place: string                      // item construído quando a resposta é "sim"
  units?: (keys: number) => number   // quantas unidades construir (padrão: uma)
}

export const lotsFor = (keys: number) => Math.max(1, Math.ceil((keys * 0.6) / 40))

// Lazer e serviços: vêm marcados quando aparecem no mapa, e a resposta muda o mapa
export const SCOPE: ScopeItem[] = [
  { id: 'piscina', ask: 'Piscina inclusa?', ids: ['pool', 'kidpool', 'infinity', 'indoor'], place: 'pool' },
  { id: 'quadra', ask: 'Quadra esportiva inclusa?', ids: ['tennis', 'beach', 'padel', 'multi', 'society'], place: 'tennis' },
  { id: 'restaurante', ask: 'Restaurante incluso?', ids: ['buffet', 'alacarte'], place: 'alacarte' },
  { id: 'bar', ask: 'Bar incluso?', ids: ['lounge', 'poolbar', 'swimup', 'kiosk'], place: 'lounge' },
  { id: 'spa', ask: 'Spa incluso?', ids: ['spa', 'sauna'], place: 'spa' },
  { id: 'academia', ask: 'Academia inclusa?', ids: ['gym'], place: 'gym' },
  { id: 'kids', ask: 'Kids club incluso?', ids: ['kids', 'playground'], place: 'kids' },
  { id: 'eventos', ask: 'Espaço para eventos incluso?', ids: ['convention'], place: 'convention' },
  { id: 'parque', ask: 'Parque aquático incluso?', ids: ['waterpark'], place: 'waterpark' },
  { id: 'estacionamento', ask: 'Estacionamento incluso?', ids: ['parking'], place: 'parking', units: lotsFor },
]

// Custos fora da obra, em fração da obra. Só entram no investimento quando confirmados.
// Faixas usuais de desenvolvimento hoteleiro (estimativas, não orçamento).
export const EXTRAS = [
  { id: 'ffe', ask: 'Mobiliário, enxoval e equipamentos (FF&E)?', pct: 0.12 },
  { id: 'projetos', ask: 'Projetos, aprovações e licenças?', pct: 0.06 },
  { id: 'preop', ask: 'Pré-operacional (equipe, treinamento, lançamento)?', pct: 0.03 },
  { id: 'contingencia', ask: 'Reserva de contingência?', pct: 0.05 },
]

// Premissas por categoria:
// - other: receitas além da hospedagem (A&B, eventos, spa), em fração da receita de hospedagem.
//   A&B pesa 20–30% da receita num hotel full service e 35–45% em resorts; no all inclusive a
//   comida já está na diária do pacote.
// - gop: margem GOP estabilizada sobre a receita total. JLL (Hotelaria em Números): resorts entre
//   30% (2023) e 43,5% (2024), segmento premium entre 28,5% e 40,1%.
// - staff: empregos diretos por UH. ABIH-SP: 0,58 por UH na hotelaria paulista; Resorts Brasil:
//   cerca de 1,4 por quarto nos resorts.
export const BY_TIER: Record<TierId, { other: number; gop: number; staff: number }> = {
  eco: { other: 0.05, gop: 0.38, staff: 0.3 },
  mid: { other: 0.18, gop: 0.37, staff: 0.55 },
  up: { other: 0.4, gop: 0.36, staff: 0.8 },
  resort: { other: 0.75, gop: 0.35, staff: 1.3 },
  ai: { other: 0.15, gop: 0.32, staff: 1.5 },
  lux: { other: 0.8, gop: 0.33, staff: 1.8 },
}

// Faixa de investimento para mostrar enquanto o projeto é respondido: a estimativa com 10% para
// cada lado, arredondada em degraus redondos. O valor exato só aparece no relatório.
export function investRange(v: number) {
  if (!v) return null
  const step = v < 2e6 ? 0.1e6 : v < 20e6 ? 1e6 : v < 100e6 ? 5e6 : v < 500e6 ? 10e6 : 50e6
  const mi = (x: number) => (x / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: x < 2e6 ? 1 : 0 })
  const lo = Math.max(step, Math.floor((v * 0.9) / step) * step)
  const hi = Math.max(lo + step, Math.ceil((v * 1.1) / step) * step)
  return `R$ ${mi(lo)} a ${mi(hi)} mi`
}

export const ASSUME = {
  baseFee: 0.04,        // taxa básica de administração, % da receita total (HVS: 4–5%)
  incentiveFee: 0.1,    // taxa de incentivo, % do GOP (HVS: 10–15%)
  ffe: 0.04,            // reserva de reposição de FF&E, % da receita total (contratos: 4–5%)
  fixedCharges: 0.02,   // IPTU, seguros e encargos fixos, % da receita estabilizada (estimativa)
  fixedShare: 0.6,      // parte fixa dos custos operacionais: folha-base, manutenção (estimativa)
  capRate: 0.1,         // cap rate de saída (negócios recentes no Brasil: 8,8% a 12%)
  discount: 0.12,       // taxa de desconto real (estimativa: título IPCA+ mais prêmio de risco)
  ramp: [0.75, 0.9],    // ocupação dos anos 1 e 2 em relação à estabilizada; estabiliza no ano 3
  years: 10,
  sellCost: 0.02,       // custo de venda na saída
}

export const DAYS_PER_MONTH = 365 / 12

interface Base { keys: number; adr: number; occ: number; other: number; gop: number }

// Um ano de operação na ocupação `occ`, com a diária multiplicada por `rate`. Os custos têm uma
// parte fixa (medida na operação estabilizada) e uma parte por diária vendida; A&B e outras
// receitas acompanham a ocupação, não a diária.
function operate(b: Base, occ: number, rate = 1) {
  const nightsS = b.keys * 365 * b.occ
  const revenueS = nightsS * b.adr * (1 + b.other)
  const costS = revenueS * (1 - b.gop)
  const fixed = costS * ASSUME.fixedShare
  const perNight = nightsS ? (costS - fixed) / nightsS : 0
  const nights = b.keys * 365 * occ
  const rooms = nights * b.adr * rate
  const revenue = rooms + nights * b.adr * b.other
  const gop = revenue - fixed - perNight * nights
  const ebitda = gop - (ASSUME.baseFee + ASSUME.ffe) * revenue - ASSUME.incentiveFee * Math.max(gop, 0) - ASSUME.fixedCharges * revenueS
  return { occ, rooms, revenue, gop, ebitda }
}

// Fluxo de caixa: obra no ano 0, operação com rampa nos anos 1–10 e venda pelo cap rate no fim
function project(b: Base, investment: number, occShift = 0, rate = 1) {
  const occ = Math.min(Math.max(b.occ + occShift, 0), 1)
  const ys = Array.from({ length: ASSUME.years }, (_, t) => operate(b, occ * (ASSUME.ramp[t] ?? 1), rate))
  const exit = (operate(b, occ, rate).ebitda / ASSUME.capRate) * (1 - ASSUME.sellCost)
  const cash = [-investment, ...ys.map((y, t) => y.ebitda + (t === ASSUME.years - 1 ? Math.max(exit, 0) : 0))]
  return { ys, exit, cash }
}

const npv = (cash: number[], r: number) => cash.reduce((v, c, t) => v + c / (1 + r) ** t, 0)

// TIR por bisseção: a taxa que zera o VPL; null quando o projeto não se paga nem com a venda
function irr(cash: number[]) {
  let lo = -0.99, hi = 1.5
  if (npv(cash, lo) * npv(cash, hi) > 0) return null
  for (let k = 0; k < 90; k++) {
    const mid = (lo + hi) / 2
    if (npv(cash, lo) * npv(cash, mid) <= 0) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

// Anos até o caixa da operação (sem a venda) cobrir o investimento
function paybackOf(investment: number, ebitdas: number[], stable: number) {
  let left = investment
  for (const [t, e] of ebitdas.entries()) {
    if (e > 0 && left <= e) return t + left / e
    left -= e
  }
  return stable > 0 ? ebitdas.length + left / stable : null
}

// Ocupação em que o EBITDA zera (com a diária de hoje)
function breakEven(b: Base) {
  if (operate(b, 1).ebitda < 0) return null
  let lo = 0, hi = 1
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2
    if (operate(b, mid).ebitda < 0) lo = mid
    else hi = mid
  }
  return hi
}

export function business(ev: Evaluation, live: Placed[], spec: Spec, checks: Record<string, boolean>) {
  // escopo: o mapa responde por si; se a resposta e o mapa divergirem (sem espaço para construir,
  // ou mapa editado à mão), o investimento segue a resposta
  const scope = SCOPE.map((c) => {
    const on = live.filter((p) => c.ids.includes(p.itemId))
    const onMap = on.length > 0
    const yes = checks[c.id] ?? onMap
    const cost = on.reduce((n, p) => n + ITEM_BY_ID[p.itemId].cost, 0)
    const delta = onMap && !yes ? -cost : !onMap && yes ? (c.units?.(ev.keys) ?? 1) * ITEM_BY_ID[c.place].cost : 0
    return { ...c, onMap, yes, cost, delta }
  })
  const obra = ev.cost + scope.reduce((n, c) => n + c.delta, 0)
  const extras = EXTRAS.map((e) => ({ ...e, yes: checks[e.id] ?? false, value: obra * e.pct }))
  const confirmed = extras.reduce((n, e) => n + (e.yes ? e.value : 0), 0)
  const pending = extras.reduce((n, e) => n + (e.yes ? 0 : e.value), 0)
  const investment = obra + confirmed

  // tarifa e ocupação: as esperadas pela pessoa, ou as de referência da categoria do mapa
  const adrOwn = !!spec.adr && spec.adr > 0
  const occOwn = !!spec.ocupacao && spec.ocupacao > 0
  const adr = adrOwn ? spec.adr! : ev.adr
  const occ = occOwn ? Math.min(spec.ocupacao!, 100) / 100 : ev.occ
  const tier = ev.tier ? BY_TIER[ev.tier.id as TierId] : null
  const b: Base = { keys: ev.keys, adr, occ, other: tier?.other ?? 0, gop: tier?.gop ?? 0 }
  const ok = ev.keys > 0 && adr > 0 && occ > 0 && !!tier

  const stable = operate(b, occ)
  const run = project(b, investment)
  const ebitdas = run.ys.map((y) => y.ebitda)
  let cum = -investment
  const years = run.ys.map((y, t) => {
    cum += y.ebitda
    return { t: t + 1, occ: y.occ, revenue: y.revenue, ebitda: y.ebitda, cum }
  })
  const rates = [0.9, 1, 1.1]
  const shifts = [-0.1, 0, 0.1]
  const be = ok ? breakEven(b) : null
  const available = ev.keys * 365

  return {
    scope, extras, obra, confirmed, pending, investment,
    adr, adrOwn, occ, occOwn,
    budget: BUDGETS.find((b) => b.id === spec.orcamento) ?? null,
    ready: ok,
    // operação estabilizada (a partir do ano 3)
    revpar: adr * occ,
    trevpar: ok ? stable.revenue / available : 0,
    revenueYear: ok ? stable.revenue : 0,
    revenueMonth: ok ? stable.revenue / 12 : 0,
    roomsShare: ok ? stable.rooms / stable.revenue : 0,
    gopYear: ok ? stable.gop : 0,
    gopMargin: tier?.gop ?? 0,
    goppar: ok ? stable.gop / available : 0,
    ebitdaYear: ok ? stable.ebitda : 0,
    ebitdaMonth: ok ? stable.ebitda / 12 : 0,
    ebitdaMargin: ok ? stable.ebitda / stable.revenue : 0,
    jobs: Math.round(ev.keys * (tier?.staff ?? 0)),
    // investimento, valor e retorno
    perKey: ev.keys ? investment / ev.keys : 0,
    marketPerKey: ev.tier?.costPerKey ?? 0,
    yieldOnCost: ok && investment ? stable.ebitda / investment : 0,
    value: ok ? Math.max(stable.ebitda, 0) / ASSUME.capRate : 0,
    payback: ok ? paybackOf(investment, ebitdas, stable.ebitda) : null,
    irr: ok ? irr(run.cash) : null,
    npv: ok ? npv(run.cash, ASSUME.discount) : 0,
    exit: ok ? run.exit : 0,
    breakEven: be,
    years: ok ? years : [],
    sensitivity: {
      rates, shifts,
      irr: rates.map((a) => shifts.map((d) => (ok ? irr(project(b, investment, d, a).cash) : null))),
    },
    // o mesmo hotel em cada categoria de mercado: diária, ocupação e receita de hospedagem
    tiers: TIERS.map((t) => ({
      id: t.id, name: t.name, adr: t.adr, occ: t.occ,
      revenueMonth: ev.keys * t.adr * t.occ * DAYS_PER_MONTH,
      diff: adr ? t.adr - adr : 0,
    })),
  }
}

export type Business = ReturnType<typeof business>
