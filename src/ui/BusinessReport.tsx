import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useStore } from '../store'
import { CATS } from '../data/catalog'
import { TIERS, money, type Evaluation } from '../lib/valuation'
import { DESTINOS, PUBLICOS, templateOf, type Spec, type TierId } from '../lib/spec'
import { TEMPLATES } from '../lib/autoplace'
import { ASSUME, BY_TIER, type Business } from '../lib/business'

// Relatório de negócios em folhas A4, com os elementos dos PDFs da Roomi (RoomiVault › design ›
// Molde de deck Roomi, levado para o retrato): capa escura com o lockup e três números no pé, miolo
// creme com título em Editorial sobre régua de 2 px, wordmark coral no canto, contador de página
// no pé, quadrado coral numerado, marca-texto coral no número da conclusão, planos com contorno de
// 1 px e meio-tom, imagem com o plano de retícula deslocado atrás e contracapa coral com o chapéu.
// Só as três cores. Na tela as folhas encolhem para caber; na impressão, cada uma vira um A4.

const PAGE_W = 794 // A4 a 96 dpi (210 × 297 mm)
const TOTAL = 6

const num = (v: number, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (v: number, d = 0) => `${num(v * 100, d)}%`
const signed = (v: number) => `${v > 0 ? '+' : '−'} ${money(Math.abs(v))}`
const mi = (v: number) => num(Math.abs(v) / 1e6, Math.abs(v) >= 1e8 ? 0 : 1)
const pad = (n: number) => String(n).padStart(2, '0')

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

// Caixa acumulado ano a ano: a obra afunda o caixa no ano 0 e o EBITDA o traz de volta
function Curve({ biz }: { biz: Business }) {
  const [hover, setHover] = useState<number | null>(null)
  const pts = [{ t: 0, ebitda: -biz.investment, cum: -biz.investment }, ...biz.years.map((y) => ({ t: y.t, ebitda: y.ebitda, cum: y.cum }))]
  const W = 674, H = 214, top = 22, bottom = 20
  const lo = Math.min(0, ...pts.map((p) => p.cum)), hi = Math.max(0, ...pts.map((p) => p.cum))
  const y = (v: number) => top + ((hi - v) / (hi - lo || 1)) * (H - top - bottom)
  const band = W / pts.length
  const bw = 16
  const x = (t: number) => band * t + band / 2
  const bar = (v: number, cx: number) => {
    const y0 = y(0), y1 = y(v), r = Math.min(3, Math.abs(y1 - y0)), l = cx - bw / 2, rt = cx + bw / 2
    return v >= 0
      ? `M${l},${y0}V${y1 + r}Q${l},${y1} ${l + r},${y1}H${rt - r}Q${rt},${y1} ${rt},${y1 + r}V${y0}Z`
      : `M${l},${y0}V${y1 - r}Q${l},${y1} ${l + r},${y1}H${rt - r}Q${rt},${y1} ${rt},${y1 - r}V${y0}Z`
  }
  const pb = biz.payback != null && biz.payback <= ASSUME.years ? biz.payback : null
  const h = hover != null ? pts[hover] : null
  const last = pts[pts.length - 1]
  return (
    <div className="curve">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Caixa acumulado em 10 anos, em milhões de reais">
        <line className="zero" x1={0} x2={W} y1={y(0)} y2={y(0)} />
        {pts.map((p, i) => (
          <g key={p.t} tabIndex={0} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
            <rect className="hit" x={x(p.t) - band / 2} y={0} width={band} height={H} />
            <path className={`${p.cum >= 0 ? 'pos' : 'neg'} ${hover === i ? 'lift' : ''}`} d={bar(p.cum, x(p.t))} />
            <text className="tick" x={x(p.t)} y={H - 5} textAnchor="middle">{p.t === 0 ? 'obra' : `ano ${p.t}`}</text>
          </g>
        ))}
        {pb != null && (
          <g className="pb">
            <line x1={x(pb)} x2={x(pb)} y1={top - 12} y2={y(0)} />
            <text x={x(pb) + (pb < 8 ? 6 : -6)} y={top - 4} textAnchor={pb < 8 ? 'start' : 'end'}>payback em {num(pb, 1)} anos</text>
          </g>
        )}
        <text className="lbl" x={x(0) - bw / 2} y={y(0) - 7}>− R$ {mi(pts[0].cum)} mi</text>
        <text className="lbl" x={x(last.t)} y={y(last.cum) + (last.cum >= 0 ? -7 : 15)} textAnchor="middle">{last.cum < 0 ? '−' : '+'} R$ {mi(last.cum)} mi</text>
      </svg>
      {h && (
        <div className="tip" style={{ left: `${(x(h.t) / W) * 100}%` }}>
          <b>{h.cum < 0 ? '−' : ''}R$ {mi(h.cum)} mi</b><span>{h.t === 0 ? 'investimento' : `acumulado no ano ${h.t}`}</span>
          {h.t > 0 && <><b>R$ {mi(h.ebitda)} mi</b><span>EBITDA do ano</span></>}
        </div>
      )}
    </div>
  )
}

function Big({ label, value, unit, children }: { label: string; value: string; unit?: string; children: ReactNode }) {
  return (
    <div className="big-num">
      <span className="lb">{label}</span>
      <div className="fig"><b>{value}</b>{unit && <i>{unit}</i>}</div>
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
  const title = name || 'Novo projeto'
  const tierId = ev.tier?.id as TierId | undefined
  const wanted = TIERS.find((t) => t.id === spec.categoria)
  const missing = wanted && wanted.id !== ev.tier?.id ? wanted.reqs.filter((r) => !r.ok(ev.stats)).map((r) => r.label.toLowerCase()) : []
  const destino = DESTINOS.find((d) => d.id === spec.destino)?.label
  const publico = PUBLICOS.find((p) => p.id === spec.publico)?.label
  const spread = biz.yieldOnCost - ASSUME.capRate
  const created = biz.value - biz.investment
  const perKeyDiff = biz.marketPerKey ? biz.perKey / biz.marketPerKey - 1 : 0
  const safety = biz.breakEven != null ? biz.occ - biz.breakEven : null
  const { rates, shifts, irr: grid } = biz.sensitivity
  const heat = (v: number | null) => (v == null ? undefined : `rgba(249, 123, 85, ${Math.min(0.85, Math.max(0.08, 0.08 + v * 2.2))})`)
  const maxAdr = Math.max(...TIERS.map((t) => t.adr), biz.adr) * 1.04
  const pays = biz.irr != null && biz.payback != null && biz.payback <= ASSUME.years
  // as respostas por trás dos números
  const ficha = [
    ['Destino', destino ?? '—'],
    ['Categoria do mapa', ev.tier?.name ?? '—'],
    ['UHs', num(ev.keys)],
    ['Público', publico ?? '—'],
    ['Diária', `${money(biz.adr)}, ${biz.adrOwn ? 'esperada' : 'de mercado'}`],
    ['Ocupação', `${pct(biz.occ)}, ${biz.occOwn ? 'esperada' : 'de mercado'}`],
    ['Faixa de orçamento', biz.budget?.label ?? 'sem faixa'],
    ['Implantação', spec.destino ? TEMPLATES[templateOf(spec)].name : '—'],
  ]

  // onde vai o investimento: obra por área do catálogo, mais o que foi confirmado fora da obra
  const spend = [
    ...CATS.map((c) => ({ label: c.label, v: ev.byCat.get(c.id) ?? 0 })),
    { label: 'Fora da obra', v: biz.confirmed },
  ].filter((r) => r.v > 0).sort((a, b) => b.v - a.v).slice(0, 6)
  const spendMax = Math.max(1, ...spend.map((r) => r.v))

  // a faixa de orçamento só se compara com o investimento; o relatório nunca crava um valor
  const b = biz.budget
  const budget = !b ? null
    : biz.investment > b.max ? { bad: true, text: `O investimento passa ${money(biz.investment - b.max)} do teto da faixa de orçamento (${b.label}).` }
      : biz.investment < b.min ? { bad: false, text: `O investimento fica abaixo da faixa de orçamento (${b.label}). Há espaço para subir o padrão.` }
        : { bad: false, text: `O investimento cabe na faixa de orçamento (${b.label}).` }

  return (
    <>
      {/* 1. capa */}
      <div className="sheet-wrap"><Sheet n={1} dark className="cover">
        <div className="lockup"><span className="wm" /><i /><span>Builder</span></div>
        <div className={`cover-title ${title.length > 18 ? 'long' : ''}`}>
          <span className="t1">Simulação de negócio</span>
          <span className="t2">{title}:</span>
          <span className="t3">{ev.tier?.name ?? 'Sem categoria'}</span>
        </div>
        <p className="cover-desc">
          {[destino, `${ev.keys} UHs`, publico?.toLowerCase()].filter(Boolean).join(' · ')}. Investimento, operação e retorno em 10 anos, a partir do hotel montado no mapa.
        </p>
        <figure className="shot cover-shot">
          {photo ? <img src={photo} alt={`Fachada do ${title}`} /> : <span className="lb">Fotografando a fachada</span>}
        </figure>
        <Reticula className="cover-ret" w={420} h={132} />
        <div className="cover-nums">
          <div><b>{mi(biz.investment)}</b><span>R$ mi de investimento</span></div>
          <div><b>{biz.irr != null ? num(biz.irr * 100, 1) : '—'}</b><span>% de TIR real</span></div>
          <div><b>{biz.payback != null ? num(biz.payback, 1) : '—'}</b><span>anos de payback</span></div>
        </div>
      </Sheet></div>

      {/* 2. o hotel em números */}
      <div className="sheet-wrap"><Sheet n={2} title="O hotel em números">
        <p className="concl">
          {pays
            ? <>{money(biz.investment)} de investimento voltam em {num(biz.payback!, 1)} anos, com <span className="hl">TIR real de {pct(biz.irr!, 1)}</span> em 10 anos.</>
            : <>{money(biz.investment)} de investimento <span className="hl">não voltam em {ASSUME.years} anos</span> com a diária e a ocupação desta simulação.</>}
        </p>
        <div className="bigs">
          <Big label="Investimento" value={mi(biz.investment)} unit="R$ mi">
            {money(biz.perKey)} por UH, sem terreno. {biz.marketPerKey ? `A categoria custa ${money(biz.marketPerKey)} por UH.` : ''}
          </Big>
          <Big label="TIR real em 10 anos" value={biz.irr != null ? num(biz.irr * 100, 1) : '—'} unit="%">
            VPL de {signed(biz.npv)} a {pct(ASSUME.discount)} ao ano, com a venda do hotel no ano 10.
          </Big>
          <Big label="Payback" value={biz.payback != null ? num(biz.payback, 1) : '—'} unit="anos">
            Com a ocupação subindo por três anos até estabilizar.
          </Big>
          <Big label="EBITDA por mês" value={mi(biz.ebitdaMonth)} unit="R$ mi">
            Margem de {pct(biz.ebitdaMargin)} sobre a receita de {money(biz.revenueMonth)} por mês.
          </Big>
        </div>
        <div className="spend">
          <span className="lb">Onde vai o investimento</span>
          {spend.map((r, i) => (
            <div key={r.label} className={`spend-row ${i === 0 ? 'top' : ''}`}>
              <b>{r.label}</b>
              <span className="track"><i style={{ width: `${(r.v / spendMax) * 100}%` }} /></span>
              <span className="v">{money(r.v)}</span>
              <span className="pc">{pct(r.v / biz.investment)}</span>
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
          <p>Valores reais, sem inflação, sem terreno e sem financiamento. Custos fora da obra entram só quando confirmados no checklist.</p>
        </div>
      </Sheet></div>

      {/* 3. operação e caixa */}
      <div className="sheet-wrap"><Sheet n={3} title="A operação estabilizada">
        <p className="lede">A partir do ano 3, com a ocupação estabilizada. A diária e a ocupação são {biz.adrOwn || biz.occOwn ? 'as esperadas na simulação' : 'as de referência da categoria'}.</p>
        <div className="boxes four">
          <Box k={1} label="Diária média" value={money(biz.adr)} note={biz.adrOwn ? 'Esperada' : 'Referência de mercado'} />
          <Box k={2} label="Ocupação" value={pct(biz.occ)} note={biz.occOwn ? 'Esperada' : 'Referência de mercado'} />
          <Box k={3} label="RevPAR" value={money(biz.revpar)} note="Hospedagem por UH disponível" />
          <Box k={4} label="TRevPAR" value={money(biz.trevpar)} note="Receita total por UH disponível" />
          <Box k={5} label="Receita por ano" value={money(biz.revenueYear)} note={`${pct(biz.roomsShare)} hospedagem`} />
          <Box k={6} label="GOP por ano" value={money(biz.gopYear)} note={`Margem de ${pct(biz.gopMargin)}`} />
          <Box k={7} label="EBITDA por ano" value={money(biz.ebitdaYear)} note={`Margem de ${pct(biz.ebitdaMargin)}`} />
          <Box k={8} label="Empregos diretos" value={num(biz.jobs)} note={tierId ? `${num(BY_TIER[tierId].staff, 2)} por UH` : undefined} />
        </div>
        <div className="mix">
          <span className="lb">De onde vem a receita</span>
          <div className="mix-bar"><i style={{ width: `${biz.roomsShare * 100}%` }} /><em /></div>
          <div className="mix-legend"><span><i className="sw coral" />Hospedagem {pct(biz.roomsShare)}</span><span><i className="sw ink" />A&B, eventos e outras {pct(1 - biz.roomsShare)}</span></div>
        </div>
        <Sec title="Quando o investimento volta">
          <p className="lede">Caixa acumulado em milhões de reais. A obra abre o buraco no ano 0 e o EBITDA de cada ano o fecha.</p>
          <Curve biz={biz} />
          <table className="years">
            <tbody>
              <tr><th>EBITDA</th>{biz.years.map((r) => <td key={r.t}>{mi(r.ebitda)}</td>)}</tr>
              <tr><th>Ocupação</th>{biz.years.map((r) => <td key={r.t}>{pct(r.occ)}</td>)}</tr>
            </tbody>
          </table>
          <div className="notes"><p>Além do caixa da operação, a venda no ano 10 pelo cap rate de {pct(ASSUME.capRate)} soma {money(biz.exit)} e entra na TIR.</p></div>
        </Sec>
      </Sheet></div>

      {/* 4. valor, risco e categorias */}
      <div className="sheet-wrap"><Sheet n={4} title="Valor e risco">
        <div className="boxes four">
          <Box label="Yield on cost" value={pct(biz.yieldOnCost, 1)} note={`${spread >= 0 ? '+' : '−'}${num(Math.abs(spread) * 100, 1)} p.p. sobre o cap rate de ${pct(ASSUME.capRate)}`} />
          <Box label="Valor do ativo" value={money(biz.value)} note={`${created >= 0 ? 'Cria' : 'Perde'} ${money(Math.abs(created))} sobre o investimento`} />
          <Box label="Custo por UH" value={money(biz.perKey)} note={biz.marketPerKey ? `${perKeyDiff >= 0 ? '+' : '−'}${pct(Math.abs(perKeyDiff))} contra a categoria` : undefined} />
          <Box label="Ocupação de equilíbrio" value={biz.breakEven != null ? pct(biz.breakEven) : 'acima de 100%'} note={safety != null ? `${num(safety * 100)} p.p. abaixo da prevista` : undefined} />
        </div>
        <div className="sens-wrap">
          <span className="lb">TIR conforme a diária e a ocupação</span>
          <table className="sens">
            <thead><tr><th />{shifts.map((d) => <th key={d}>Ocupação {pct(Math.min(Math.max(biz.occ + d, 0), 1))}{d === 0 ? ' (base)' : ''}</th>)}</tr></thead>
            <tbody>
              {rates.map((a, i) => (
                <tr key={a}>
                  <th>{money(biz.adr * a)}<small>{a === 1 ? 'diária base' : `diária ${a > 1 ? '+' : '−'}10%`}</small></th>
                  {grid[i].map((v, j) => <td key={j} className={i === 1 && j === 1 ? 'base' : ''} style={{ background: heat(v) }}>{v == null ? 'não se paga' : pct(v, 1)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small">Cor mais forte, TIR maior. Acima de {pct(ASSUME.discount)} o projeto supera a taxa de desconto. {spread >= 0 ? 'O yield on cost acima do cap rate indica que o hotel pronto vale mais do que custou.' : 'O yield on cost abaixo do cap rate indica que o hotel pronto vale menos do que custou.'}</p>
        </div>
        <Sec title="A diária entre as categorias">
          <p className="lede">O mesmo hotel, com as mesmas {ev.keys} UHs, na diária e na ocupação de referência de cada categoria.</p>
          <div className="tiers">
            <div className="tier-row head"><span /><span /><span>Diária</span><span>Ocupação</span><span>RevPAR</span><span>Contra o seu</span></div>
            {biz.tiers.map((t) => (
              <div key={t.id} className={`tier-row ${t.id === ev.tier?.id ? 'me' : ''}`}>
                <b>{t.name}</b>
                <span className="track"><i style={{ width: `${(t.adr / maxAdr) * 100}%` }} /></span>
                <span className="v">{money(t.adr)}</span><span>{pct(t.occ)}</span><span>{money(t.adr * t.occ)}</span>
                <span>{Math.abs(t.diff) < 1 ? 'igual' : `${t.diff > 0 ? '+' : '−'}${pct(Math.abs(t.diff) / biz.adr)}`}</span>
              </div>
            ))}
            <div className="tier-row you">
              <b>Seu hotel</b>
              <span className="track"><i style={{ width: `${(biz.adr / maxAdr) * 100}%` }} /></span>
              <span className="v">{money(biz.adr)}</span><span>{pct(biz.occ)}</span><span>{money(biz.revpar)}</span><span />
            </div>
          </div>
        </Sec>
      </Sheet></div>

      {/* 5. escopo e premissas */}
      <div className="sheet-wrap"><Sheet n={5} title="Escopo e premissas">
        <span className="lb">Escopo confirmado no checklist</span>
        <ul className="scope">
          {biz.scope.map((c) => (
            <li key={c.id} className={c.yes ? 'yes' : 'no'}>
              <span className="quad">{c.yes ? '✓' : '×'}</span>
              <span>{c.ask.replace('?', '').replace(/ incluso| inclusa/, '')}</span>
              <b>{c.yes ? money(c.onMap ? c.cost : c.delta) : 'fora'}</b>
            </li>
          ))}
        </ul>
        <table className="money-sum"><tbody>
          <tr><td>Obra do mapa</td><td>{money(ev.cost)}</td></tr>
          {biz.obra !== ev.cost && <tr><td>Ajustes do checklist</td><td>{signed(biz.obra - ev.cost)}</td></tr>}
          <tr><td>Custos fora da obra confirmados</td><td>{money(biz.confirmed)}</td></tr>
          <tr className="total"><td>Investimento</td><td>{money(biz.investment)}</td></tr>
          <tr className="muted"><td>A confirmar fora da obra</td><td>{money(biz.pending)}</td></tr>
        </tbody></table>
        <span className="lb">Premissas</span>
        <ul className="assume">
          {tierId && <li>Receitas além da hospedagem (A&B, eventos, spa): +{pct(BY_TIER[tierId].other)} da hospedagem.</li>}
          {tierId && <li>Margem GOP de {pct(BY_TIER[tierId].gop)} para {ev.tier!.name}. Na JLL, resorts ficaram entre 30% e 43,5%.</li>}
          <li>Administração: {pct(ASSUME.baseFee)} da receita mais {pct(ASSUME.incentiveFee)} do GOP (HVS: 4 a 5% e 10 a 15%).</li>
          <li>Reserva de FF&E de {pct(ASSUME.ffe)} da receita. IPTU e seguros, {pct(ASSUME.fixedCharges)}.</li>
          <li>Ocupação a {pct(ASSUME.ramp[0])} da estabilizada no ano 1 e {pct(ASSUME.ramp[1])} no ano 2.</li>
          <li>Venda no ano 10 pelo cap rate de {pct(ASSUME.capRate)}. Negócios recentes no Brasil ficaram entre 8,8% e 12%.</li>
          <li>VPL a {pct(ASSUME.discount)} ao ano real. Custos operacionais {pct(ASSUME.fixedShare)} fixos.</li>
        </ul>
        <p className="small sources">Fontes: Panorama da Hotelaria Brasileira 2026 (HotelInvest e FOHB), JLL Hotelaria em Números, HVS, ABIH-SP, Resorts Brasil, CUB Sinduscon-SP e SINAPI. Simulação para comparar cenários, não um estudo de viabilidade.</p>
      </Sheet></div>

      {/* 6. contracapa */}
      <div className="sheet-wrap"><Sheet n={6} coral className="back">
        <h2 className="back-title">Do terreno ao retorno,<br />num estudo só.</h2>
        <p className="back-sub">{title}, simulado no Builder da Roomi.</p>
        <img className="chapeu" src="/roomi-chapeu.svg" alt="" />
        <div className="lockup ink"><span className="wm" /><i /><span>Builder</span></div>
      </Sheet></div>
    </>
  )
}

export function BusinessReport({ ev, biz, onClose }: { ev: Evaluation; biz: Business; onClose: () => void }) {
  const name = useStore((s) => s.hotelName)
  const spec = useStore((s) => s.spec)
  const photo = useStore((s) => s.photo)
  const scroller = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = scroller.current!
    const fit = () => setScale(Math.min(1, (el.clientWidth - 48) / PAGE_W))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <motion.div className="overlay deck-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="deck-tools" onClick={(e) => e.stopPropagation()}>
        <button className="btn" onClick={() => useStore.getState().openModal('checklist')}>Voltar ao checklist</button>
        <button className="btn" onClick={() => useStore.getState().openModal('explain')}>Como calculamos</button>
        <button className="btn" onClick={() => window.print()}>Imprimir / PDF</button>
        <button className="btn primary" onClick={onClose}>Fechar</button>
      </div>
      <div className="deck-scroll" ref={scroller} onClick={(e) => e.stopPropagation()}>
        <motion.div className="sheets" style={{ '--s': scale } as CSSProperties}
          initial={{ y: 40 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 26 }}>
          <ReportSheets name={name} spec={spec} photo={photo} ev={ev} biz={biz} />
        </motion.div>
      </div>
    </motion.div>
  )
}
