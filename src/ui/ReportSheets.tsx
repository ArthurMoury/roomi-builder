import { useState, type ReactNode } from 'react'
import { CATS } from '../data/catalog'
import { TIERS, money, type Evaluation } from '../lib/valuation'
import { DESTINOS, PUBLICOS, templateOf, type Spec, type TierId } from '../lib/spec'
import { TEMPLATES } from '../lib/autoplace'
import { ASSUME, BY_TIER, INCERTEZA, INCERTEZA_TEXTO, obraRange, type Business } from '../lib/business'
import { brl, count, figure, pct as pctR, points, snap, upTo, years as yearsR, type Range } from '../lib/range'

// Relatório de negócios em folhas A4, com os elementos dos PDFs da Roomi (RoomiVault › design ›
// Molde de deck Roomi, levado para o retrato): capa escura com o lockup e três números no pé, miolo
// creme com título em Editorial sobre régua de 2 px, wordmark coral no canto, contador de página
// no pé, quadrado coral numerado, marca-texto coral no número da conclusão, planos com contorno de
// 1 px e meio-tom, imagem com o plano de retícula deslocado atrás e contracapa coral com o chapéu.
// Só as três cores. Na tela as folhas encolhem para caber; na impressão, cada uma vira um A4.
// Nada sai cravado: toda estimativa vem em faixa (lib/range); só o que a pessoa escolheu ou digitou
// aparece exato. Este módulo só desenha as folhas: o modal do Maker e a LP cuidam da moldura.

export const PAGE_W = 794 // A4 a 96 dpi (210 × 297 mm)
export const PAGE_H = 1123
const TOTAL = 6

const num = (v: number, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (v: number, d = 0) => `${num(v * 100, d)}%`
const pad = (n: number) => String(n).padStart(2, '0')
// faixa de um ponto percentual para outro, na casa inteira: "9,5% a 10,5%"
const pp = (v: number, s: number) => `${num((v - s) * 100, 1)}% a ${num((v + s) * 100, 1)}%`

// Siglas: cada uma é explicada uma vez, numa faixa no pé da folha em que aparece pela primeira vez
// (depois do trecho em que ela aparece). As folhas listam as suas na ordem de leitura.
const SIGLAS: Record<string, string> = {
  UH: 'Unidade habitacional. O quarto, a suíte ou o chalé vendido por diária.',
  TIR: 'Taxa interna de retorno. Quanto o investimento rende por ano, já com a venda do hotel. Real, sem inflação.',
  VPL: 'Valor presente líquido. O caixa futuro trazido para hoje pela taxa de desconto, menos o investimento.',
  EBITDA: 'Lucro antes de juros, impostos, depreciação e amortização. O caixa que a operação gera.',
  RevPAR: 'Revenue per available room. A receita de hospedagem por UH disponível, por dia.',
  TRevPAR: 'Total revenue per available room. A receita total por UH disponível, por dia.',
  GOP: 'Gross operating profit. O lucro bruto da operação, antes da administração e dos encargos fixos.',
  'A&B': 'Alimentos e bebidas. Restaurantes, bares e serviço de quarto.',
  'p.p.': 'Pontos percentuais. A distância entre duas porcentagens.',
  'FF&E': 'Furniture, fixtures and equipment. Móveis, enxoval e equipamentos do hotel.',
  JLL: 'Jones Lang LaSalle, consultoria imobiliária que publica o Hotelaria em Números.',
  HVS: 'Consultoria internacional de hotelaria, referência em avaliação de hotéis.',
  IPTU: 'Imposto predial e territorial urbano, cobrado pela prefeitura.',
  FOHB: 'Fórum de Operadores Hoteleiros do Brasil.',
  'ABIH-SP': 'Associação Brasileira da Indústria de Hotéis de São Paulo.',
  CUB: 'Custo unitário básico da construção por metro quadrado, divulgado pelo Sinduscon de cada estado.',
  'Sinduscon-SP': 'Sindicato da Indústria da Construção Civil do Estado de São Paulo.',
  SINAPI: 'Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil, da Caixa e do IBGE.',
}

function Siglas({ ids }: { ids: string[] }) {
  return (
    <aside className="siglas" aria-label="Siglas desta folha">
      <span className="lb">Siglas</span>
      <dl>{ids.map((id) => <div key={id}><dt>{id}</dt><dd>{SIGLAS[id]}</dd></div>)}</dl>
    </aside>
  )
}

// Retícula: pontos coral crescendo para a direita, linhas alternadas deslocadas meia célula
function Reticula({ w, h, passo = 12, rmax = 5.1, curva = 1.6, className }: { w: number; h: number; passo?: number; rmax?: number; curva?: number; className?: string }) {
  const dots: ReactNode[] = []
  for (let y = passo / 2, l = 0; y < h; y += passo, l++)
    for (let x = passo / 2 + (l % 2 ? passo / 2 : 0); x < w; x += passo) {
      const r = rmax * (x / w) ** curva
      if (r > 0.35) dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)
    }
  return <svg className={className} viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true"><g fill="#F97B55">{dots}</g></svg>
}

function Sheet({ n, title, dark, coral, children, className = '' }: {
  n: number; title?: string; dark?: boolean; coral?: boolean; children: ReactNode; className?: string
}) {
  return (
    <section className={`sheet ${dark ? 'dark' : coral ? 'coral' : ''} ${className}`}>
      {title && (
        <header className="sh-head">
          <h2>{title}</h2>
          <span className="wm" aria-label="Roomi" />
        </header>
      )}
      {children}
      {!dark && !coral && <div className="sh-num"><b>{pad(n)}</b><i>/{pad(TOTAL)}</i></div>}
    </section>
  )
}

// segunda seção da mesma folha, com a mesma régua do título
const Sec = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="sec"><h3 className="sec-title">{title}</h3>{children}</section>
)

// Caixa acumulado ano a ano, em faixa: cada barra vai da ponta conservadora à otimista. A obra afunda
// o caixa no ano 0 e o caixa da operação o traz de volta; o payback vira uma faixa no fundo.
function Curve({ biz }: { biz: Business }) {
  const [hover, setHover] = useState<number | null>(null)
  const inv = biz.r.investment
  const pts = [{ t: 0, cum: { lo: -inv.hi, hi: -inv.lo, mid: -inv.mid } as Range, ebitda: null as Range | null }, ...biz.r.years.map((y) => ({ t: y.t, cum: y.cum, ebitda: y.ebitda }))]
  const W = 674, H = 214, top = 22, bottom = 20
  const lo = Math.min(0, ...pts.map((p) => p.cum.lo)), hi = Math.max(0, ...pts.map((p) => p.cum.hi))
  const y = (v: number) => top + ((hi - v) / (hi - lo || 1)) * (H - top - bottom)
  const band = W / pts.length
  const bw = 16
  const x = (t: number) => band * t + band / 2
  // a barra flutua de lo a hi (no SVG, y cresce para baixo); a parte acima do zero é coral e a de baixo,
  // escura; uma faixa muito estreita ganha 2 px para aparecer
  const bar = (top: number, bottom: number, cx: number) => {
    if (bottom - top < 0.01) return null
    const h = Math.max(2, bottom - top)
    return <rect x={cx - bw / 2} y={(top + bottom) / 2 - h / 2} width={bw} height={h} />
  }
  const pb = biz.r.payback
  const pbIn = pb && pb.lo <= ASSUME.years ? { a: Math.max(pb.lo, 0), b: Math.min(pb.hi, ASSUME.years + 0.45) } : null
  const h = hover != null ? pts[hover] : null
  const last = pts[pts.length - 1]
  return (
    <div className="curve">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Caixa acumulado em 10 anos, em faixa, em milhões de reais">
        {pbIn && (
          <g className="pb">
            <rect x={x(pbIn.a)} y={top - 12} width={Math.max(2, x(pbIn.b) - x(pbIn.a))} height={y(0) - top + 12} />
            <text x={x(pbIn.a) + (pbIn.a < 6 ? 6 : -6)} y={top - 4} textAnchor={pbIn.a < 6 ? 'start' : 'end'}>payback em {yearsR(pb)}</text>
          </g>
        )}
        <line className="zero" x1={0} x2={W} y1={y(0)} y2={y(0)} />
        {pts.map((p, i) => {
          const cx = x(p.t), z = y(0), yl = y(p.cum.lo), yh = y(p.cum.hi)
          return (
            <g key={p.t} tabIndex={0} className={hover === i ? 'lift' : ''} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
              <rect className="hit" x={cx - band / 2} y={0} width={band} height={H} />
              <g className="pos">{bar(Math.min(yh, z), Math.min(yl, z), cx)}</g>
              <g className="neg">{bar(Math.max(yh, z), Math.max(yl, z), cx)}</g>
              <text className="tick" x={cx} y={H - 5} textAnchor="middle">{p.t === 0 ? 'obra' : `ano ${p.t}`}</text>
            </g>
          )
        })}
        <text className="lbl" x={x(0) - bw / 2} y={y(0) - 8}>obra: −{brl(inv)}</text>
        <text className="lbl" x={x(last.t) + bw / 2} y={last.cum.hi >= 0 ? y(last.cum.hi) - 7 : y(last.cum.lo) + 15} textAnchor="end">{brl(last.cum)}</text>
      </svg>
      {h && (
        <div className="tip" style={{ left: `${(x(h.t) / W) * 100}%` }}>
          <b>{brl(h.cum)}</b><span>{h.t === 0 ? 'investimento' : `acumulado no ano ${h.t}`}</span>
          {h.ebitda && <><b>{brl(h.ebitda)}</b><span>EBITDA do ano</span></>}
        </div>
      )}
    </div>
  )
}

// numeral grande de uma faixa: as duas pontas grandes e um "a" pequeno entre elas, sem traço
export function Fig({ text }: { text: string }) {
  const [lo, hi] = text.split('–')
  return hi == null ? <>{text}</> : <>{lo}<small className="to">a</small>{hi}</>
}

function Big({ label, value, unit, children }: { label: string; value: string; unit?: string; children: ReactNode }) {
  return (
    <div className="big-num">
      <span className="lb">{label}</span>
      <div className="fig"><b><Fig text={value} /></b>{unit && <i>{unit}</i>}</div>
      <p>{children}</p>
    </div>
  )
}

function Box({ label, value, note, k }: { label: string; value: string; note?: string; k?: number }) {
  return (
    <div className="box">
      <span className="lb">{k != null && <span className="quad">{k}</span>}{label}</span>
      <b>{value}</b>
      {note && <p>{note}</p>}
    </div>
  )
}

// As seis folhas do relatório, só com os dados (o modal e a LP desenham por fora)
export function ReportSheets({ name, spec, photo, ev, biz }: { name: string; spec: Spec; photo: string | null; ev: Evaluation; biz: Business }) {
  const r = biz.r
  const title = name || 'Novo projeto'
  const tierId = ev.tier?.id as TierId | undefined
  const tier = tierId ? BY_TIER[tierId] : null
  const wanted = TIERS.find((t) => t.id === spec.categoria)
  const missing = wanted && wanted.id !== ev.tier?.id ? wanted.reqs.filter((q) => !q.ok(ev.stats)).map((q) => q.label.toLowerCase()) : []
  const destino = DESTINOS.find((d) => d.id === spec.destino)?.label
  const publico = PUBLICOS.find((p) => p.id === spec.publico)?.label
  const heat = (v: number | null) => (v == null ? undefined : `rgba(249, 123, 85, ${Math.min(0.85, Math.max(0.08, 0.08 + v * 2.2))})`)
  const maxAdr = Math.max(...biz.tiers.map((t) => t.adr.hi), r.adr?.hi ?? 0) * 1.04
  const irr = r.irr, pb = r.payback
  const goodIrr = irr != null && irr.lo >= ASSUME.discount
  const paysOp = biz.mid?.payback != null && biz.mid.payback <= ASSUME.years
  // a diária e a ocupação: exatas quando digitadas, em faixa quando estimadas
  const adrText = biz.adrOwn ? money(biz.adr) : brl(r.adr)
  const occText = biz.occOwn ? pct(biz.occ) : pctR(r.occ)
  const own = (yes: boolean) => (yes ? 'esperada' : 'estimada')
  const lede3 = biz.adrOwn && biz.occOwn ? 'A diária e a ocupação são as esperadas na simulação.'
    : biz.adrOwn ? 'A diária é a esperada na simulação, e a ocupação, a estimada para a categoria.'
      : biz.occOwn ? 'A ocupação é a esperada na simulação, e a diária, a estimada para o hotel.'
        : 'A diária e a ocupação são as estimadas para o hotel, pela categoria, pelo mix de UHs e pelo lazer.'
  // as respostas por trás dos números
  const ficha = [
    ['Destino', destino ?? '—'],
    ['Categoria do mapa', ev.tier?.name ?? '—'],
    ['UHs', num(ev.keys)],
    ['Público', publico ?? '—'],
    [`Diária ${own(biz.adrOwn)}`, adrText],
    [`Ocupação ${own(biz.occOwn)}`, occText],
    ['Faixa de orçamento', biz.budget?.label ?? 'sem faixa'],
    ['Implantação', spec.destino ? TEMPLATES[templateOf(spec)].name : '—'],
  ]

  // a faixa de orçamento só se compara com a faixa de investimento; o relatório nunca crava um valor
  const b = biz.budget
  const inv = r.investment
  const budget = !b ? null
    : inv.lo > b.max ? { bad: true, text: `O investimento estimado (${brl(inv)}) passa do teto da faixa de orçamento (${b.label}).` }
      : inv.hi > b.max ? { bad: true, text: `O investimento estimado (${brl(inv)}) pode passar do teto da faixa de orçamento (${b.label}).` }
        : inv.hi < b.min ? { bad: false, text: `O investimento estimado (${brl(inv)}) fica abaixo da faixa de orçamento (${b.label}). Há espaço para subir o padrão.` }
          : { bad: false, text: `O investimento estimado (${brl(inv)}) cabe na faixa de orçamento (${b.label}).` }

  // onde vai o investimento: obra por área do catálogo, os ajustes do checklist e o que foi confirmado
  // fora da obra. A lista cede uma linha para cada nota extra no pé, para as notas e as siglas nunca
  // saírem da folha.
  const adjust = biz.obra - ev.cost
  const spend = [
    ...CATS.map((c) => ({ label: c.label, v: ev.byCat.get(c.id) ?? 0 })),
    { label: 'Ajustes do checklist', v: adjust },
    { label: 'Fora da obra', v: biz.confirmed },
  ].filter((x) => x.v > 0).sort((a, z) => z.v - a.v).slice(0, 6 - (budget ? 1 : 0) - (missing.length ? 1 : 0))
  const spendMax = Math.max(1, ...spend.map((x) => x.v))

  const created = r.created
  const safety = r.safety
  const spread = r.yieldOnCost ? { lo: r.yieldOnCost.lo - ASSUME.capRate, hi: r.yieldOnCost.hi - ASSUME.capRate, mid: r.yieldOnCost.mid - ASSUME.capRate } : null
  const { rates, shifts, irr: grid, mid: gridMid } = biz.sensitivity()
  const shiftLabel = (d: number) => (biz.occOwn ? `Ocupação ${pct(Math.min(Math.max(biz.occ + d, 0), 1))}` : d === 0 ? 'Ocupação estimada' : `Ocupação ${d > 0 ? '+' : '−'}${num(Math.abs(d) * 100)} p.p.`)
  const rateLabel = (a: number) => (biz.adrOwn ? money(biz.adr * a) : a === 1 ? 'Diária estimada' : `Diária ${a > 1 ? '+' : '−'}10%`)
  const gopRange = tier ? pp(tier.gop, INCERTEZA.gop) : '—'
  const other = tier ? `${num(tier.other * (1 - INCERTEZA.other) * 100)}% a ${num(tier.other * (1 + INCERTEZA.other) * 100)}%` : '—'
  const staff = tier ? `${num(tier.staff * (1 - INCERTEZA.staff), 1)} a ${num(tier.staff * (1 + INCERTEZA.staff), 1)}` : '—'

  return (
    <>
      {/* 1. capa */}
      <div className="sheet-wrap"><Sheet n={1} dark className="cover">
        <div className="lockup"><span className="wm" /><i /><span>Maker</span></div>
        <div className={`cover-title ${title.length > 18 ? 'long' : ''}`}>
          <span className="t1">Simulação de negócio</span>
          <span className="t2">{title}:</span>
          <span className="t3">{ev.tier?.name ?? 'Sem categoria'}</span>
        </div>
        <p className="cover-desc">
          {[destino, `${ev.keys} UHs`, publico?.toLowerCase()].filter(Boolean).join(' · ')}. Investimento, operação e retorno em 10 anos, a partir do hotel montado no mapa, sempre em faixas.
        </p>
        <figure className="shot cover-shot">
          {photo ? <img src={photo} alt={`Fachada do ${title}`} /> : <span className="lb">Fotografando a fachada</span>}
        </figure>
        <Reticula className="cover-ret" w={420} h={132} />
        <div className="cover-nums">
          <div><b><Fig text={figure(inv, 1e6)} /></b><span>R$ mi de investimento</span></div>
          <div><b><Fig text={figure(irr, 0.01, 0.01)} /></b><span>% de TIR real</span></div>
          <div><b><Fig text={figure(pb, 1, 0.5)} /></b><span>anos de payback</span></div>
        </div>
        <Siglas ids={['UH', 'TIR']} />
      </Sheet></div>

      {/* 2. o hotel em números */}
      <div className="sheet-wrap"><Sheet n={2} title="O hotel em números">
        <p className="concl">
          {irr == null
            ? <>{brl(inv)} de investimento <span className="hl">não se pagam</span> com a diária e a ocupação desta simulação.</>
            : <>{brl(inv)} de investimento rendem <span className="hl">TIR real de {pctR(irr)}</span> em 10 anos{goodIrr ? ', acima da taxa de 12% ao ano' : ''}{paysOp ? '.' : ', com a venda do hotel no ano 10 fechando a conta.'}</>}
        </p>
        <div className="bigs">
          <Big label="Investimento" value={figure(inv, 1e6)} unit="R$ mi">
            {brl(r.perKey)} por UH, sem terreno.{r.marketPerKey ? ` A referência da categoria é de ${brl(r.marketPerKey)} por UH.` : ''}
          </Big>
          <Big label="TIR real em 10 anos" value={figure(irr, 0.01, 0.01)} unit="%">
            VPL (a {pct(ASSUME.discount)} ao ano) de {brl(r.npv)}, com a venda do hotel no ano 10. Antes de impostos.
          </Big>
          <Big label="Payback" value={figure(pb, 1, 0.5)} unit="anos">
            Só com o caixa da operação, sem a venda. A ocupação sobe nos dois primeiros anos e estabiliza no terceiro.
          </Big>
          <Big label="EBITDA por mês" value={figure(r.ebitdaMonth, 1e6, 0.1e6)} unit="R$ mi">
            Margem de {pctR(r.ebitdaMargin)} sobre a receita de {brl(r.revenueMonth)} por mês.
          </Big>
        </div>
        <div className="spend">
          <span className="lb">Onde vai o investimento</span>
          {spend.map((x, i) => (
            <div key={x.label} className={`spend-row ${i === 0 ? 'top' : ''}`}>
              <b>{x.label}</b>
              <span className="track"><i style={{ width: `${(x.v / spendMax) * 100}%` }} /></span>
              <span className="v">{brl(obraRange(x.v))}</span>
              <span className="pc">{pct(x.v / biz.investment)}</span>
            </div>
          ))}
        </div>
        <div className="ficha">
          <span className="lb">Ficha do projeto</span>
          <dl>{ficha.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </div>
        <div className="notes">
          {budget && <p className={budget.bad ? 'bad' : ''}>{budget.text}</p>}
          {missing.length > 0 && <p className="bad">O mapa fica em {ev.tier?.name ?? 'nenhuma categoria'}. Para {wanted!.name} falta: {missing.join(', ')}.</p>}
          <p>Valores reais, sem inflação, sem terreno, sem financiamento e antes de impostos. Custos fora da obra entram só quando confirmados no checklist.</p>
        </div>
        <Siglas ids={['VPL', 'EBITDA']} />
      </Sheet></div>

      {/* 3. operação e caixa */}
      <div className="sheet-wrap"><Sheet n={3} title="A operação estabilizada">
        <p className="lede">A partir do ano 3, com a ocupação estabilizada. {lede3}</p>
        <div className="boxes four">
          <Box k={1} label="Diária média" value={adrText} note={biz.adrOwn ? 'Esperada' : 'Estimada para o hotel'} />
          <Box k={2} label="Ocupação" value={occText} note={biz.occOwn ? 'Esperada' : 'Estimada para a categoria'} />
          <Box k={3} label="RevPAR" value={biz.adrOwn && biz.occOwn ? money(biz.adr * biz.occ) : brl(r.revpar)} note="Hospedagem por UH disponível" />
          <Box k={4} label="TRevPAR" value={brl(r.trevpar)} note="Receita total por UH disponível" />
          <Box k={5} label="Receita por ano" value={brl(r.revenueYear)} note={`Cerca de ${pct(biz.roomsShare)} em hospedagem`} />
          <Box k={6} label="GOP por ano" value={brl(r.gopYear)} note={`Margem de ${pctR(r.gopMargin)}`} />
          <Box k={7} label="EBITDA por ano" value={brl(r.ebitdaYear)} note={`Margem de ${pctR(r.ebitdaMargin)}`} />
          <Box k={8} label="Empregos diretos" value={count(r.jobs)} note={tier ? `De ${staff} por UH` : undefined} />
        </div>
        <div className="mix">
          <span className="lb">De onde vem a receita</span>
          <div className="mix-bar"><i style={{ width: `${biz.roomsShare * 100}%` }} /><em /></div>
          <div className="mix-legend"><span><i className="sw coral" />Hospedagem, cerca de {pct(biz.roomsShare)}</span><span><i className="sw ink" />A&B, eventos e outras, cerca de {pct(1 - biz.roomsShare)}</span></div>
        </div>
        <Sec title="Quando o investimento volta">
          <p className="lede">Caixa acumulado em faixa, da ponta conservadora à otimista. A obra abre o buraco no ano 0 e o caixa da operação, depois da reserva de reposição, o fecha.</p>
          <Curve biz={biz} />
          <table className="years">
            <tbody>
              <tr><th>EBITDA</th>{r.years.map((y) => <td key={y.t}>{figure(y.ebitda, 1e6)}</td>)}</tr>
              <tr><th>Ocupação</th>{r.years.map((y) => <td key={y.t}>{biz.occOwn ? pct(y.occ.mid) : figure(y.occ, 0.01, 0.01)}</td>)}</tr>
            </tbody>
          </table>
          <div className="notes"><p>EBITDA em R$ mi e ocupação em %. Além do caixa da operação, a venda no ano 10 pelo cap rate de {pp(ASSUME.capRate, INCERTEZA.cap)} soma {brl(r.exit)} e entra na TIR.</p></div>
        </Sec>
        <Siglas ids={['RevPAR', 'TRevPAR', 'GOP', 'A&B']} />
      </Sheet></div>

      {/* 4. valor, risco e categorias */}
      <div className="sheet-wrap"><Sheet n={4} title="Valor e risco">
        <div className="boxes four">
          <Box label="Yield on cost" value={pctR(r.yieldOnCost, 0.005)} note={spread ? (spread.lo >= 0 ? `${points(spread)} acima do cap rate de saída` : spread.hi <= 0 ? `${points({ lo: -spread.hi, hi: -spread.lo, mid: -spread.mid })} abaixo do cap rate de saída` : `Perto do cap rate de saída (${points(spread)})`) : undefined} />
          <Box label="Valor do ativo" value={brl(r.value)} note={created ? (created.lo >= 0 ? `Cria ${snap(created, 1).lo === 0 ? upTo(created) : brl(created)} sobre o investimento` : created.hi <= 0 ? `Perde ${brl({ lo: -created.hi, hi: -created.lo, mid: -created.mid })} sobre o investimento` : `Entre ${brl(created)} sobre o investimento`) : undefined} />
          <Box label="Custo por UH" value={brl(r.perKey)} note={r.marketPerKey ? `Referência da categoria: ${brl(r.marketPerKey)}` : undefined} />
          <Box label="Ocupação de equilíbrio" value={r.breakEven ? pctR(r.breakEven) : 'acima de 100%'} note={safety ? `${points(safety)} abaixo da ${own(biz.occOwn)}` : undefined} />
        </div>
        <div className="sens-wrap">
          <span className="lb">TIR conforme a diária e a ocupação</span>
          <table className="sens">
            <thead><tr><th />{shifts.map((d) => <th key={d}>{shiftLabel(d)}</th>)}</tr></thead>
            <tbody>
              {rates.map((a, i) => (
                <tr key={a}>
                  <th>{rateLabel(a)}{biz.adrOwn && <small>{a === 1 ? 'diária esperada' : `${a > 1 ? '+' : '−'}10%`}</small>}</th>
                  {grid[i].map((v, j) => {
                    const base = rates[i] === 1 && shifts[j] === 0
                    return <td key={j} className={base ? 'base' : ''} style={{ background: heat(gridMid[i][j]) }}>{v == null ? 'não se paga' : pctR(v)}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small">Cor mais forte, TIR maior. Acima de {pct(ASSUME.discount)} o projeto supera a taxa de desconto. {spread && spread.lo >= 0 ? 'O yield on cost acima do cap rate indica que o hotel pronto vale mais do que custou.' : spread && spread.hi <= 0 ? 'O yield on cost abaixo do cap rate indica que o hotel pronto vale menos do que custou.' : 'O yield on cost perto do cap rate indica que o hotel pronto vale perto do que custou.'}</p>
        </div>
        <Sec title="A diária entre as categorias">
          <p className="lede">O mesmo hotel, com o mesmo mix de UHs e o mesmo lazer, na diária e na ocupação de referência de cada categoria.</p>
          <div className="tiers">
            <div className="tier-row head"><span /><span /><span>Diária</span><span>Ocupação</span><span>RevPAR</span></div>
            {biz.tiers.map((t) => (
              <div key={t.id} className={`tier-row ${t.id === ev.tier?.id ? 'me' : ''}`}>
                <b>{t.name}</b>
                <span className="track"><i style={{ width: `${(t.mid / maxAdr) * 100}%` }} /></span>
                <span className="v">{brl(t.adr)}</span><span>{pctR(t.occ)}</span><span>{brl(t.revpar)}</span>
              </div>
            ))}
            <div className="tier-row you">
              <b>Seu hotel</b>
              <span className="track"><i style={{ width: `${((r.adr?.mid ?? 0) / maxAdr) * 100}%` }} /></span>
              <span className="v">{adrText}</span><span>{occText}</span><span>{biz.adrOwn && biz.occOwn ? money(biz.adr * biz.occ) : brl(r.revpar)}</span>
            </div>
          </div>
        </Sec>
        <Siglas ids={['p.p.']} />
      </Sheet></div>

      {/* 5. escopo e premissas */}
      <div className="sheet-wrap"><Sheet n={5} title="Escopo e premissas">
        <span className="lb">Escopo confirmado no checklist</span>
        <ul className="scope">
          {biz.scope.map((c) => (
            <li key={c.id} className={c.yes ? 'yes' : 'no'}>
              <span className="quad">{c.yes ? '✓' : '×'}</span>
              <span>{c.ask.replace('?', '').replace(/ incluso| inclusa/, '')}</span>
              <b>{c.yes ? brl(obraRange(c.onMap ? c.cost : c.delta)) : 'fora'}</b>
            </li>
          ))}
        </ul>
        <table className="money-sum"><tbody>
          <tr><td>Obra do mapa</td><td>{brl(obraRange(ev.cost))}</td></tr>
          {adjust !== 0 && <tr><td>Ajustes do checklist</td><td>{adjust > 0 ? '+' : '−'} {brl(obraRange(Math.abs(adjust)))}</td></tr>}
          <tr><td>Custos fora da obra confirmados</td><td>{biz.confirmed ? brl(r.confirmed) : 'nenhum'}</td></tr>
          <tr className="total"><td>Investimento</td><td>{brl(inv)}</td></tr>
          <tr className="muted"><td>A confirmar fora da obra</td><td>{biz.pending ? brl(r.pending) : 'nada'}</td></tr>
        </tbody></table>
        <span className="lb">Premissas</span>
        <ul className="assume">
          <li>Faixas: combinam, como incertezas independentes, {INCERTEZA_TEXTO}. O que você escolheu ou digitou não varia.</li>
          {tier && <li>Receitas além da hospedagem (A&B, eventos, spa): {other} da hospedagem.</li>}
          {tier && <li>Margem GOP de {gopRange} para {ev.tier!.name}, na operação de referência. Na JLL, resorts ficaram entre 30% e 43,5%.</li>}
          <li>Administração: {pct(ASSUME.baseFee)} da receita mais {pct(ASSUME.incentiveFee)} do GOP (HVS: 4 a 5% e 10 a 15%). IPTU e seguros, {pct(ASSUME.fixedCharges)} da receita.</li>
          <li>Reserva de FF&E de {pct(ASSUME.ffe)} da receita, abaixo do EBITDA, sai do caixa todo ano.</li>
          <li>Custos operacionais {pct(ASSUME.fixedShare)} fixos, dimensionados pela operação de referência do hotel. A diária e a ocupação esperadas mexem na margem.</li>
          <li>Investimento todo no ano 0, sem o prazo da obra. Ocupação a {pct(ASSUME.ramp[0])} da estabilizada no ano 1 e {pct(ASSUME.ramp[1])} no ano 2.</li>
          <li>Venda no ano 10 pelo cap rate de {pp(ASSUME.capRate, INCERTEZA.cap)}. Negócios recentes no Brasil ficaram entre 8,8% e 12%. VPL a {pct(ASSUME.discount)} ao ano real.</li>
        </ul>
        <p className="small sources">Fontes: Panorama da Hotelaria Brasileira 2026 (HotelInvest e FOHB), JLL Hotelaria em Números, HVS, ABIH-SP, Resorts Brasil, CUB Sinduscon-SP e SINAPI. Simulação para comparar cenários, não um estudo de viabilidade.</p>
        <Siglas ids={['FF&E', 'JLL', 'HVS', 'IPTU', 'FOHB', 'ABIH-SP', 'CUB', 'Sinduscon-SP', 'SINAPI']} />
      </Sheet></div>

      {/* 6. contracapa */}
      <div className="sheet-wrap"><Sheet n={6} coral className="back">
        <h2 className="back-title">Do terreno ao retorno,<br />num estudo só.</h2>
        <p className="back-sub">{title}, simulado no Maker da Roomi.</p>
        <img className="chapeu" src="/roomi-chapeu.png" width="583" height="370" alt="" />
        <div className="lockup ink"><span className="wm" /><i /><span>Maker</span></div>
      </Sheet></div>
    </>
  )
}
