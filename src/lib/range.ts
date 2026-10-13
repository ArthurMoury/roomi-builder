// Faixas: toda estimativa do Maker sai como faixa, nunca como valor cravado. Só o que a pessoa
// escolheu ou digitou aparece exato. As pontas são arredondadas para fora, em degraus redondos
// (1, 2 ou 5 vezes uma potência de 10), com a faixa ocupando uns oito degraus no máximo.

export interface Range { lo: number; hi: number; mid: number }

// faixa em torno de um valor, com a variação para baixo e para cima em fração (−0,1 e 0,2, por exemplo)
export const around = (mid: number, down: number, up: number): Range => ({ lo: mid * (1 + down), hi: mid * (1 + up), mid })
export const exact = (v: number): Range => ({ lo: v, hi: v, mid: v })
export const scale = (r: Range, k: number): Range => ({ lo: r.lo * k, hi: r.hi * k, mid: r.mid * k })

function stepFor(width: number, floor: number) {
  const raw = Math.max(width / 8, floor)
  const p = 10 ** Math.floor(Math.log10(raw) + 1e-9)
  const m = raw / p
  return (m <= 1 + 1e-9 ? 1 : m <= 2 + 1e-9 ? 2 : m <= 5 + 1e-9 ? 5 : 10) * p
}

// pontas para fora, sem o erro de ponto flutuante, e sempre com um degrau entre elas
export function snap(r: Range, floor: number) {
  const step = stepFor(Math.abs(r.hi - r.lo), floor)
  const clean = (v: number) => Math.round(v / step) * step
  const lo = clean(Math.floor(r.lo / step + 1e-6) * step)
  let hi = clean(Math.ceil(r.hi / step - 1e-6) * step)
  if (hi - lo < step / 2) hi = clean(lo + step)
  return { lo, hi, step }
}

const formats = new Map<number, Intl.NumberFormat>()
const nf = (v: number, d: number) => {
  let f = formats.get(d)
  if (!f) formats.set(d, (f = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })))
  return f.format(v)
}
const fits = (v: number, d: number) => Math.abs(v * 10 ** d - Math.round(v * 10 ** d)) < 1e-6
// as casas do degrau, sem zero sobrando no fim das duas pontas ("10 a 13", não "10,0 a 13,0"; "1,4 a 1,8",
// não "1,40 a 1,80")
function decimals(step: number, unit: number, lo = 0.5, hi = 0.5) {
  const most = Math.max(0, -Math.floor(Math.log10(step / unit) + 1e-9))
  for (let d = 0; d < most; d++) if (fits(lo / unit, d) && fits(hi / unit, d)) return d
  return most
}
const magnitude = (r: Range) => Math.max(Math.abs(r.lo), Math.abs(r.hi), 1e-9)

// R$ 150 a 210 mi · R$ 520 a 690 mil · R$ 1.480 a 1.740 · −R$ 5 mi a R$ 40 mi
export function brl(r: Range | null) {
  if (!r) return '—'
  const top = magnitude(r)
  const { lo, hi, step } = snap(r, 10 ** (Math.floor(Math.log10(top)) - 2))
  const unit = top >= 1e6 ? 1e6 : top >= 1e4 ? 1e3 : 1
  const word = unit === 1e6 ? ' mi' : unit === 1e3 ? ' mil' : ''
  const d = decimals(step, unit, lo, hi)
  const one = (v: number) => nf(Math.abs(v) / unit, d)
  if (lo >= 0) return `R$ ${one(lo)} a ${one(hi)}${word}`
  if (hi === 0) return `−R$ ${one(lo)}${word} a zero`
  if (hi < 0) return `−R$ ${one(lo)} a −R$ ${one(hi)}${word}`
  return `−R$ ${one(lo)}${word} a R$ ${one(hi)}${word}`
}

// a mesma faixa só com os números, para os numerais grandes (o rótulo leva a unidade): 150–210
export function figure(r: Range | null, unit = 1, floor = 0) {
  if (!r) return '—'
  const top = magnitude(r)
  const { lo, hi, step } = snap(r, Math.max(floor, 10 ** (Math.floor(Math.log10(top)) - 2)))
  const d = decimals(step, unit, lo, hi)
  const one = (v: number) => `${v < 0 ? '−' : ''}${nf(Math.abs(v) / unit, d)}`
  return `${one(lo)}–${one(hi)}`
}

// só a ponta de cima, para quando a de baixo fica em zero: até R$ 250 mi
export const upTo = (r: Range) => brl({ lo: 0, hi: r.hi, mid: r.mid }).replace(/^R\$ 0 a /, 'até R$ ')

// 61% a 69% · 12% a 22% (fração para porcentagem; degrau mínimo de um ponto)
export function pct(r: Range | null, floor = 0.01) {
  if (!r) return '—'
  const { lo, hi, step } = snap(r, floor)
  const d = decimals(step, 0.01, lo, hi)
  const one = (v: number) => `${v < 0 ? '−' : ''}${nf(Math.abs(v) * 100, d)}%`
  return `${one(lo)} a ${one(hi)}`
}

// 2 a 12 p.p. (diferença entre porcentagens)
export function points(r: Range | null, floor = 0.01) {
  if (!r) return '—'
  const { lo, hi, step } = snap(r, floor)
  const d = decimals(step, 0.01, lo, hi)
  const one = (v: number) => `${v < 0 ? '−' : ''}${nf(Math.abs(v) * 100, d)}`
  return `${one(lo)} a ${one(hi)} p.p.`
}

// 5,5 a 9 anos
export function years(r: Range | null) {
  if (!r) return '—'
  const { lo, hi, step } = snap(r, 0.5)
  const d = decimals(step, 1, lo, hi)
  return `${nf(lo, d)} a ${nf(hi, d)} anos`
}

// 430 a 500 (contagens)
export function count(r: Range | null) {
  if (!r) return '—'
  const { lo, hi } = snap(r, 10)
  return `${nf(lo, 0)} a ${nf(hi, 0)}`
}
