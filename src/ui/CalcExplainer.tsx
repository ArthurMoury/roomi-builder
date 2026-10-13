import { motion } from 'motion/react'
import { CATS } from '../data/catalog'
import { money, type Evaluation } from '../lib/valuation'
import { ASSUME, BY_TIER, EXTRAS, INCERTEZA, INCERTEZA_TEXTO, adrRange, obraRange, occRange, type Business } from '../lib/business'
import { brl, pct as pctR, years } from '../lib/range'
import type { TierId } from '../lib/spec'

const pct = (v: number, d = 0) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
const dec = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pp = (v: number, s: number) => `${pct(v - s, 1)} a ${pct(v + s, 1)}`

function Calc({ label, value }: { label: string; value: string }) {
  return <div className="calc"><span>{label}</span><b>{value}</b></div>
}

// Explica, passo a passo e com os números do hotel atual, como o mapa vira custo, categoria,
// diária, receita, EBITDA e retorno. Como no relatório, toda estimativa sai em faixa.
export function CalcExplainer({ ev, biz, count, onClose }: { ev: Evaluation; biz: Business; count: number; onClose: () => void }) {
  const t = ev.tier
  const p = t ? BY_TIER[t.id as TierId] : null
  const r = biz.r
  const ready = biz.ready

  return (
    <motion.div className="overlay top" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="explain" onClick={(e) => e.stopPropagation()}
        initial={{ y: 30, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}>
        <div className="explain-head">
          <div>
            <div className="eyebrow">Como calculamos</div>
            <h2 className="display">Do mapa ao retorno do hotel</h2>
          </div>
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>

        <ol className="steps">
          <li>
            <h3>Custo de obra</h3>
            <p>Cada item do mapa tem um custo de obra de referência, que considera a área construída e o padrão de acabamento. O custo do hotel é a soma dos itens, numa faixa de 8% abaixo a 15% acima, porque é uma estimativa conceitual. O terreno não entra.</p>
            <Calc label={`Soma de ${count} itens`} value={ev.cost ? brl(obraRange(ev.cost)) : '—'} />
            <div className="split">
              {CATS.filter((c) => ev.byCat.get(c.id)).map((c) => <span key={c.id}>{c.label} <b>{brl(obraRange(ev.byCat.get(c.id)!))}</b></span>)}
            </div>
            <p className="note">Fontes: CUB Sinduscon-SP ago/2026 (custo por m² e padrão), SINAPI mai/2026, faixas de mercado de piscinas e orçamentos de quadras. Itens sem preço público são estimativas.</p>
          </li>

          <li>
            <h3>Categoria</h3>
            <p>O hotel fica na categoria mais alta cujos requisitos o mapa cumpre: Econômico, Midscale, Upscale, Resort ou Resort All Inclusive. Luxo é uma trilha à parte. {t ? <>Hoje ele é <b>{t.name}</b>.</> : 'Ainda não há UHs no mapa.'}</p>
            {t && <ul className="reqs met">{t.reqs.map((q) => <li key={q.label} className="ok"><span className="dot" />{q.label}</li>)}</ul>}
          </li>

          <li>
            <h3>Diária média (ADR) e ocupação</h3>
            <p>Parte da diária de referência da categoria, ajustada pelo mix de UHs e pela variedade de lazer e serviços.</p>
            <Calc label="ADR = diária da categoria × fator do mix × bônus de amenidades" value="" />
            {t && <Calc label={`(${brl(adrRange(t.adr))}) × ${dec(ev.mixFactor)} × ${dec(ev.bonus)}`} value={brl(adrRange(ev.adr))} />}
            <p>O <b>mix</b> é a média do peso de diária das UHs: standard 1,0, família 1,15, chalé 1,2, suíte 1,4, bangalô 1,6 e villa 2,6. Ele entra pela raiz quadrada, limitado entre 0,85 e 2,6. O <b>bônus</b> soma 1% por tipo diferente de lazer ou serviço, até 12%{ev.keys ? <> (aqui, {ev.amenities} tipos: +{pct(ev.bonus - 1)})</> : null}.</p>
            <p>A ocupação é a de referência da categoria{t ? <> ({pctR(occRange(t.occ))})</> : null}. No questionário, a tarifa e a ocupação esperadas substituem as estimadas quando são preenchidas, e aí não variam{biz.adrOwn || biz.occOwn ? <> (este hotel usa {[biz.adrOwn && `a tarifa de ${money(biz.adr)}`, biz.occOwn && `a ocupação de ${pct(biz.occ)}`].filter(Boolean).join(' e ')})</> : null}.</p>
          </li>

          <li>
            <h3>Receitas</h3>
            <Calc label="RevPAR = ADR × ocupação" value={!ready ? '—' : biz.adrOwn && biz.occOwn ? money(biz.adr * biz.occ) : brl(r.revpar)} />
            <Calc label={`Receita total = hospedagem (${ev.keys} UHs × RevPAR × 365) + A&B e outras${p ? ` (${pct(p.other * (1 - INCERTEZA.other))} a ${pct(p.other * (1 + INCERTEZA.other))} da hospedagem)` : ''}`} value={ready ? brl(r.revenueYear) : '—'} />
            <Calc label="TRevPAR = receita total ÷ UHs disponíveis no ano" value={ready ? brl(r.trevpar) : '—'} />
            <p>Além da hospedagem entram A&B, eventos, spa e outras receitas, numa proporção típica da categoria, que acompanha a ocupação. A&B pesa 20–30% da receita num hotel full service e 35–45% em resorts; no all inclusive a comida já está na diária do pacote.</p>
          </li>

          <li>
            <h3>GOP e EBITDA</h3>
            <Calc label={`GOP = receita total − custos da operação (margem de ${p ? pp(p.gop, INCERTEZA.gop) : '—'} na operação de referência)`} value={ready ? brl(r.gopYear) : '—'} />
            <Calc label={`EBITDA = GOP − ${pct(ASSUME.baseFee)} da receita − ${pct(ASSUME.incentiveFee)} do GOP − IPTU e seguros (${pct(ASSUME.fixedCharges)})`} value={ready ? brl(r.ebitdaYear) : '—'} />
            <Calc label="EBITDA por mês" value={ready ? brl(r.ebitdaMonth) : '—'} />
            <Calc label={`Caixa da operação = EBITDA − reserva de FF&E (${pct(ASSUME.ffe)} da receita)`} value={ready ? brl(r.noiYear) : '—'} />
            <p>Os custos são os da operação de referência do hotel (a diária estimada e a ocupação da categoria): {pct(ASSUME.fixedShare)} fixos e o resto por diária vendida. Por isso a diária e a ocupação esperadas mexem na margem. Na JLL, resorts brasileiros ficaram entre 30% (2023) e 43,5% (2024) de margem GOP, e o segmento premium entre 28,5% e 40,1%. Do GOP saem a taxa de administração (HVS: 4–5% da receita mais 10–15% do GOP) e IPTU e seguros. A reserva para repor mobiliário e equipamentos (4–5% da receita em contratos) sai do caixa, abaixo do EBITDA.</p>
          </li>

          <li>
            <h3>Investimento</h3>
            <p>Parte da obra do mapa. Sim e Não no checklist do relatório constroem ou demolem no mapa, então o custo acompanha. Os custos fora da obra só entram quando confirmados: {EXTRAS.map((e) => `${e.ask.replace('?', '').toLowerCase()} (${pct(e.pct)})`).join(', ')}. A faixa de orçamento do questionário não entra na conta: o relatório só diz se o investimento cabe nela.</p>
            <Calc label="Investimento" value={biz.investment ? brl(r.investment) : '—'} />
            <Calc label={`Custo por UH (referência da categoria: ${r.marketPerKey ? brl(r.marketPerKey) : '—'})`} value={r.perKey ? brl(r.perKey) : '—'} />
          </li>

          <li>
            <h3>Retorno e valor</h3>
            <Calc label="Yield on cost = caixa da operação estabilizado ÷ investimento" value={ready ? pctR(r.yieldOnCost, 0.005) : '—'} />
            <Calc label={`Valor do ativo = caixa da operação ÷ cap rate de ${pp(ASSUME.capRate, INCERTEZA.cap)}`} value={ready ? brl(r.value) : '—'} />
            <Calc label={`Payback: anos até o caixa da operação cobrir o investimento, com ocupação de ${pct(ASSUME.ramp[0])} e ${pct(ASSUME.ramp[1])} da estabilizada nos anos 1 e 2`} value={ready ? years(r.payback) : '—'} />
            <Calc label={`TIR real em 10 anos, antes de impostos: investimento no ano 0, caixa da operação nos anos 1 a 10 e venda no ano 10 pelo cap rate (menos ${pct(ASSUME.sellCost)})`} value={ready ? (r.irr ? pctR(r.irr) : 'não se paga') : '—'} />
            <Calc label={`VPL do mesmo fluxo a ${pct(ASSUME.discount)} ao ano, real`} value={ready ? brl(r.npv) : '—'} />
            <p>O cap rate de saída fica no meio dos negócios recentes de hotéis no Brasil, de 8,8% a 12%. A rampa segue o padrão de um hotel novo, que estabiliza no terceiro ano.</p>
          </li>

          <li>
            <h3>Ocupação de equilíbrio e sensibilidade</h3>
            <p>A ocupação de equilíbrio é a que zera o EBITDA com a diária de hoje{ready && r.breakEven ? <> ({pctR(r.breakEven)})</> : null}. A sensibilidade refaz a TIR com a diária 10% menor ou maior e a ocupação 10 pontos abaixo ou acima.</p>
          </li>

          <li>
            <h3>Por que faixas</h3>
            <p>Nenhum número estimado sai cravado. Cada faixa combina, como incertezas independentes, {INCERTEZA_TEXTO}. O que você escolheu ou digitou, como as UHs, a diária e a ocupação esperadas, não varia.</p>
          </li>
        </ol>

        <p className="note">
          Diárias e ocupação de referência: Panorama da Hotelaria Brasileira 2026 (HotelInvest/FOHB) para Econômico, Midscale e Upscale,
          Anuário BLTA 2026 para Luxo e Resorts Brasil/JLL para a ocupação de resorts. Margens: JLL, Hotelaria em Números. Contratos de
          gestão: HVS. Empregos: ABIH-SP e Resorts Brasil. A diária de Resort e de All Inclusive, a parte fixa dos custos, IPTU e seguros,
          a taxa de desconto e os custos fora da obra são estimativas. Valores reais, sem inflação, sem financiamento e antes de impostos.
          É uma simulação para comparar cenários, não um estudo de viabilidade.
        </p>
      </motion.div>
    </motion.div>
  )
}
