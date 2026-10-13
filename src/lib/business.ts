import { ITEM_BY_ID } from '../data/catalog'
import { TIERS, type Evaluation, type Placed } from './valuation'
import { BUDGETS, type Spec, type TierId } from './spec'
import { around, exact, type Range } from './range'

// Visão de negócios: o investimento confirmado pelo checklist e a operação do hotel projetada em
// 10 anos, com os indicadores que um investidor de hotelaria pede: TRevPAR, GOP, EBITDA, yield on
// cost, TIR, VPL, valor do ativo, ocupação de equilíbrio e sensibilidade. Valores reais (sem
// inflação), em reais de hoje, antes de impostos e sem financiamento.
//
// Nada sai cravado: cada estimativa vira uma faixa (ver INCERTEZA). Só o que a pessoa escolheu ou
// digitou (UHs, diária e ocupação esperadas, faixa de orçamento e respostas do checklist) é exato.

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

export const ASSUME = {
  baseFee: 0.04,        // taxa básica de administração, % da receita total (HVS: 4–5%)
  incentiveFee: 0.1,    // taxa de incentivo, % do GOP (HVS: 10–15%)
  ffe: 0.04,            // reserva de reposição de FF&E, % da receita total (contratos: 4–5%); sai do caixa, abaixo do EBITDA
  fixedCharges: 0.02,   // IPTU, seguros e encargos fixos, % da receita de referência (estimativa)
  fixedShare: 0.6,      // parte fixa dos custos operacionais: folha-base, manutenção (estimativa)
  capRate: 0.1,         // cap rate de saída (negócios recentes no Brasil: 8,8% a 12%)
  discount: 0.12,       // taxa de desconto real (estimativa: título IPCA+ mais prêmio de risco)
  ramp: [0.75, 0.9],    // ocupação dos anos 1 e 2 em relação à estabilizada; estabiliza no ano 3
  years: 10,
  sellCost: 0.02,       // custo de venda na saída
}

// Incerteza de cada estimativa, do lado ruim e do bom. Cada faixa combina os efeitos como
// independentes (raiz da soma dos quadrados), em vez de empilhar todos os piores casos de uma vez.
// A diária e a ocupação digitadas não variam.
export const INCERTEZA = {
  obra: [-0.08, 0.15] as const, // estimativa conceitual de obra: estouro é mais comum que economia
  adr: 0.08,                    // diária estimada, para cada lado
  occ: 0.04,                    // ocupação estimada, em pontos
  gop: 0.02,                    // estrutura de custos da categoria (margem GOP), em pontos
  other: 0.1,                   // receitas além da hospedagem, para cada lado
  cap: 0.005,                   // cap rate de saída, em pontos
  staff: 0.15,                  // empregos por UH, para cada lado
}
const U = INCERTEZA
const n1 = (v: number) => (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
export const INCERTEZA_TEXTO = `a obra (de ${n1(-U.obra[0])}% abaixo a ${n1(U.obra[1])}% acima), a diária estimada (${n1(U.adr)}% para cada lado), a ocupação estimada (${n1(U.occ)} p.p.), a margem (${n1(U.gop)} p.p.), as receitas extras (${n1(U.other)}%) e o cap rate (${n1(U.cap)} p.p.)`

// faixa de um custo de obra (itens, áreas, custos fora da obra e o investimento, que é proporcional)
export const obraRange = (v: number) => around(v, U.obra[0], U.obra[1])
// faixa das referências de mercado de diária e ocupação
export const adrRange = (v: number) => around(v, -U.adr, U.adr)
export const occRange = (v: number): Range => ({ lo: Math.max(0, v - U.occ), hi: Math.min(1, v + U.occ), mid: v })

export const DAYS_PER_MONTH = 365 / 12
const once = <T,>(make: () => T) => { let v: T | undefined; return () => (v ??= make()) }
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

interface Base {
  keys: number
  adr: number; occ: number        // diária e ocupação usadas: as digitadas ou as estimadas
  refAdr: number; refOcc: number  // a operação de referência do hotel, que dimensiona os custos
  other: number; gop: number; cap: number
}

// Um ano de operação na ocupação `occ`, com a diária multiplicada por `rate`. Os custos são os da
// operação de referência do hotel (a diária estimada e a ocupação da categoria): uma parte fixa e
// uma parte por diária vendida. Assim a diária e a ocupação esperadas mexem na margem, não no tamanho
// da folha. A&B e outras receitas acompanham a ocupação, não a diária. O EBITDA vem antes da reserva
// de FF&E, que sai do caixa.
function operate(b: Base, occ: number, rate = 1) {
  const nightsRef = b.keys * 365 * b.refOcc
  const revenueRef = nightsRef * b.refAdr * (1 + b.other)
  const costRef = revenueRef * (1 - b.gop)
  const fixed = costRef * ASSUME.fixedShare
  const perNight = nightsRef ? (costRef - fixed) / nightsRef : 0
  const nights = b.keys * 365 * occ
  const rooms = nights * b.adr * rate
  const revenue = rooms + nights * b.refAdr * b.other
  const gop = revenue - fixed - perNight * nights
  const ebitda = gop - ASSUME.baseFee * revenue - ASSUME.incentiveFee * Math.max(gop, 0) - ASSUME.fixedCharges * revenueRef
  return { occ, rooms, revenue, gop, ebitda, cash: ebitda - ASSUME.ffe * revenue }
}

// Fluxo de caixa: obra no ano 0, operação com rampa nos anos 1–10 e venda pelo cap rate no fim
function project(b: Base, investment: number, occShift = 0, rate = 1) {
  const occ = clamp(b.occ + occShift, 0, 1)
  const ys = Array.from({ length: ASSUME.years }, (_, t) => operate(b, occ * (ASSUME.ramp[t] ?? 1), rate))
  const stable = operate(b, occ, rate)
  const exit = (Math.max(stable.cash, 0) / b.cap) * (1 - ASSUME.sellCost)
  const cash = [-investment, ...ys.map((y, t) => y.cash + (t === ASSUME.years - 1 ? exit : 0))]
  return { ys, stable, exit, cash }
}

const npv = (cash: number[], r: number) => cash.reduce((v, c, t) => v + c / (1 + r) ** t, 0)

// TIR por bisseção: a taxa que zera o VPL. O teto sobe até o VPL trocar de sinal, então TIR alta não
// vira "não se paga"; null só quando nenhuma taxa zera o VPL (o caixa nunca fica positivo).
function irr(cash: number[]) {
  let lo = -0.99, hi = 1
  if (npv(cash, lo) < 0) return null
  while (npv(cash, hi) > 0 && hi < 1e3) hi *= 2
  if (npv(cash, hi) > 0) return null
  for (let k = 0; k < 60 && hi - lo > 1e-7; k++) {
    const mid = (lo + hi) / 2
    if (npv(cash, mid) > 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// Anos até o caixa da operação (sem a venda) cobrir o investimento
function paybackOf(investment: number, flows: number[], stable: number) {
  let left = investment
  for (const [t, c] of flows.entries()) {
    if (c > 0 && left <= c) return t + left / c
    left -= c
  }
  return stable > 0 ? flows.length + left / stable : null
}

// Ocupação em que o EBITDA zera, com a diária de hoje
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

// Os botões de incerteza: o cenário central e cada incerteza sozinha, no lado ruim e no bom
interface Knobs { obra: number; adr: number; occ: number; gop: number; other: number; cap: number }
const MID: Knobs = { obra: 1, adr: 1, occ: 0, gop: 0, other: 1, cap: 0 }
const SWINGS: [Knobs, Knobs][] = [
  [{ ...MID, obra: 1 + U.obra[1] }, { ...MID, obra: 1 + U.obra[0] }],
  [{ ...MID, adr: 1 - U.adr }, { ...MID, adr: 1 + U.adr }],
  [{ ...MID, occ: -U.occ }, { ...MID, occ: U.occ }],
  [{ ...MID, gop: -U.gop }, { ...MID, gop: U.gop }],
  [{ ...MID, other: 1 - U.other }, { ...MID, other: 1 + U.other }],
  [{ ...MID, cap: U.cap }, { ...MID, cap: -U.cap }],
]

// Faixa de uma medida: o valor central e, para cada incerteza, o quanto ela empurra para baixo e para
// cima; os empurrões se combinam pela raiz da soma dos quadrados. Sem valor central, sem faixa.
function spread<M>(mid: M, swings: [M, M][], get: (m: M) => number | null): Range | null {
  const c = get(mid)
  if (c == null || !Number.isFinite(c)) return null
  let down = 0, up = 0
  for (const [a, b] of swings) {
    const vs = [get(a), get(b)].map((v) => (v == null || !Number.isFinite(v) ? c : v))
    const lo = Math.min(...vs), hi = Math.max(...vs)
    if (lo < c) down += (c - lo) ** 2
    if (hi > c) up += (hi - c) ** 2
  }
  return { lo: c - Math.sqrt(down), hi: c + Math.sqrt(up), mid: c }
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

  // tarifa e ocupação: as esperadas pela pessoa, ou as estimadas para o hotel (diária da categoria ×
  // mix de UHs × lazer, e a ocupação da categoria)
  const adrOwn = !!spec.adr && spec.adr > 0
  const occOwn = !!spec.ocupacao && spec.ocupacao > 0
  const adr = adrOwn ? spec.adr! : ev.adr
  const occ = occOwn ? clamp(spec.ocupacao!, 0, 100) / 100 : ev.occ
  const tier = ev.tier ? BY_TIER[ev.tier.id as TierId] : null
  const ok = ev.keys > 0 && adr > 0 && occ > 0 && !!tier && ev.adr > 0

  // o modelo inteiro num cenário: o investimento acompanha a obra (os custos fora dela são fração dela)
  const model = (k: Knobs) => {
    const inv = investment * k.obra
    const b: Base = {
      keys: ev.keys,
      adr: adrOwn ? adr : ev.adr * k.adr,
      occ: occOwn ? occ : clamp(ev.occ + k.occ, 0.05, 1),
      refAdr: ev.adr, refOcc: ev.occ,
      other: (tier?.other ?? 0) * k.other, gop: (tier?.gop ?? 0) + k.gop, cap: ASSUME.capRate + k.cap,
    }
    const run = project(b, inv)
    const s = run.stable
    let cum = -inv
    const years = run.ys.map((y, t) => {
      cum += y.cash
      return { t: t + 1, occ: y.occ, revenue: y.revenue, ebitda: y.ebitda, cash: y.cash, cum }
    })
    const be = breakEven(b)
    const noi = s.cash
    return {
      b, inv, s, noi, years, exit: run.exit,
      irr: irr(run.cash), npv: npv(run.cash, ASSUME.discount),
      payback: paybackOf(inv, run.ys.map((y) => y.cash), noi),
      breakEven: be, value: Math.max(noi, 0) / b.cap,
      // o mesmo hotel nas faixas de diária e ocupação da grade de sensibilidade
      grid: (rate: number, shift: number) => irr(project(b, inv, shift, rate).cash),
    }
  }
  type Run = ReturnType<typeof model>
  const mid = ok ? model(MID) : null
  const swings = ok ? SWINGS.map(([a, b]) => [model(a), model(b)] as [Run, Run]) : []
  const R = (get: (m: Run) => number | null) => (mid ? spread(mid, swings, get) : null)

  const available = ev.keys * 365
  // grade de sensibilidade: diária −10%, base e +10% contra três ocupações; quando a ocupação está
  // perto do teto (ou do chão), a grade anda para não repetir coluna
  const rates = [0.9, 1, 1.1]
  const shifts = occ > 0.9 ? [-0.2, -0.1, 0] : occ < 0.1 ? [0, 0.1, 0.2] : [-0.1, 0, 0.1]
  // nas células, a diária e a ocupação são as da célula (SWINGS[1] e [2] ficam de fora); variam a
  // obra, a margem, as receitas e o cap rate
  const cellSwings = swings.filter((_, i) => i !== 1 && i !== 2)
  const cell = (a: number, d: number) => (mid ? spread(mid, cellSwings, (m) => m.grid(a, d)) : null)

  const jobsMid = ev.keys * (tier?.staff ?? 0)
  const perKeyMarket = ev.tier?.costPerKey ?? 0

  return {
    scope, extras, obra, confirmed, pending, investment,
    adr, adrOwn, occ, occOwn,
    budget: BUDGETS.find((b) => b.id === spec.orcamento) ?? null,
    ready: ok,
    // faixas do investimento: a obra é estimativa conceitual (−8% a +15%)
    r: {
      obra: obraRange(obra),
      confirmed: obraRange(confirmed),
      pending: obraRange(pending),
      investment: obraRange(investment),
      perKey: ev.keys ? obraRange(investment / ev.keys) : null,
      marketPerKey: perKeyMarket ? around(perKeyMarket, -0.15, 0.15) : null,
      // operação estabilizada (a partir do ano 3)
      adr: adrOwn ? exact(adr) : R((m) => m.b.adr),
      occ: occOwn ? exact(occ) : R((m) => m.b.occ),
      revpar: adrOwn && occOwn ? exact(adr * occ) : R((m) => m.b.adr * m.b.occ),
      trevpar: R((m) => m.s.revenue / available),
      revenueYear: R((m) => m.s.revenue),
      revenueMonth: R((m) => m.s.revenue / 12),
      gopYear: R((m) => m.s.gop),
      gopMargin: R((m) => m.s.gop / m.s.revenue),
      ebitdaYear: R((m) => m.s.ebitda),
      ebitdaMonth: R((m) => m.s.ebitda / 12),
      ebitdaMargin: R((m) => m.s.ebitda / m.s.revenue),
      noiYear: R((m) => m.noi),
      jobs: jobsMid ? around(jobsMid, -U.staff, U.staff) : null,
      // investimento, valor e retorno
      yieldOnCost: R((m) => m.noi / m.inv),
      value: R((m) => m.value),
      created: R((m) => m.value - m.inv),
      payback: R((m) => m.payback),
      irr: R((m) => m.irr),
      npv: R((m) => m.npv),
      exit: R((m) => m.exit),
      breakEven: R((m) => m.breakEven),
      safety: R((m) => (m.breakEven == null ? null : m.b.occ - m.breakEven)),
      years: mid ? mid.years.map((_, t) => ({
        t: t + 1,
        cum: R((m) => m.years[t].cum)!,
        ebitda: R((m) => m.years[t].ebitda)!,
        occ: occOwn ? exact(mid.years[t].occ) : R((m) => m.years[t].occ)!,
      })) : [],
    },
    // o cenário central, para os desenhos (curva de caixa, barras); nunca mostrado como número
    mid: mid ? { years: mid.years, payback: mid.payback, irr: mid.irr, npv: mid.npv, noi: mid.noi, revenue: mid.s.revenue, rooms: mid.s.rooms } : null,
    roomsShare: mid ? mid.s.rooms / mid.s.revenue : 0,
    gopMarginRef: tier?.gop ?? 0,
    // a grade custa dezenas de TIRs: só sai quando o relatório pede, e uma vez
    sensitivity: once(() => ({
      rates, shifts,
      irr: rates.map((a) => shifts.map((d) => cell(a, d))),
      mid: rates.map((a) => shifts.map((d) => (mid ? mid.grid(a, d) : null))),
    })),
    // o mesmo hotel (mesmo mix de UHs e lazer) em cada categoria de mercado: diária e ocupação de
    // referência, em faixa
    tiers: TIERS.map((t) => {
      const a = t.adr * ev.mixFactor * ev.bonus
      return { id: t.id, name: t.name, adr: adrRange(a), occ: occRange(t.occ), revpar: around(a * t.occ, -U.adr, U.adr), mid: a }
    }),
  }
}

export type Business = ReturnType<typeof business>

// Faixa de investimento enquanto o projeto é respondido (a mesma do relatório)
export const investRange = (v: number) => (v ? obraRange(v) : null)
