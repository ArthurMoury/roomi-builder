import { motion } from 'motion/react'
import { CATS } from '../data/catalog'
import { money, type Evaluation } from '../lib/valuation'
import { ASSUME, BY_TIER, EXTRAS, type Business } from '../lib/business'
import type { TierId } from '../lib/spec'

const pct = (v: number, d = 0) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
const dec = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const years = (v: number | null) => (v == null ? 'não se paga' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} anos`)
const brl = (v: number) => (v ? money(v) : '—')

function Calc({ label, value }: { label: string; value: string }) {
  return <div className="calc"><span>{label}</span><b>{value}</b></div>
}

// Explica, passo a passo e com os números do hotel atual, como o mapa vira custo, categoria,
// diária, receita, EBITDA e retorno
export function CalcExplainer({ ev, biz, count, onClose }: { ev: Evaluation; biz: Business; count: number; onClose: () => void }) {
  const t = ev.tier
  const p = t ? BY_TIER[t.id as TierId] : null

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
            <p>Cada item do mapa tem um custo de obra de referência, que considera a área construída e o padrão de acabamento. O custo do hotel é a soma dos itens. O terreno não entra.</p>
            <Calc label={`Soma de ${count} itens`} value={money(ev.cost)} />
            <div className="split">
              {CATS.filter((c) => ev.byCat.get(c.id)).map((c) => <span key={c.id}>{c.label} <b>{money(ev.byCat.get(c.id)!)}</b></span>)}
            </div>
            <p className="note">Fontes: CUB Sinduscon-SP ago/2026 (custo por m² e padrão), SINAPI mai/2026, faixas de mercado de piscinas e orçamentos de quadras. Itens sem preço público são estimativas.</p>
          </li>

          <li>
            <h3>Categoria</h3>
            <p>O hotel fica na categoria mais alta cujos requisitos o mapa cumpre: Econômico, Midscale, Upscale, Resort ou Resort All Inclusive. Luxo é uma trilha à parte. {t ? <>Hoje ele é <b>{t.name}</b>.</> : 'Ainda não há UHs no mapa.'}</p>
            {t && <ul className="reqs met">{t.reqs.map((r) => <li key={r.label} className="ok"><span className="dot" />{r.label}</li>)}</ul>}
          </li>

          <li>
            <h3>Diária média (ADR) e ocupação</h3>
            <p>Parte da diária média da categoria, ajustada pelo mix de UHs e pela variedade de lazer e serviços.</p>
            <Calc label="ADR = diária da categoria × fator do mix × bônus de amenidades" value="" />
            {t && <Calc label={`${money(t.adr)} × ${dec(ev.mixFactor)} × ${dec(ev.bonus)}`} value={money(ev.adr)} />}
            <p>O <b>mix</b> é a média do peso de diária das UHs: standard 1,0, família 1,15, chalé 1,2, suíte 1,4, bangalô 1,6 e villa 2,6. Ele entra pela raiz quadrada, limitado entre 0,85 e 2,6. O <b>bônus</b> soma 1% por tipo diferente de lazer ou serviço, até 12%{ev.keys ? <> (aqui, {ev.amenities} tipos: +{pct(ev.bonus - 1)})</> : null}.</p>
            <p>A ocupação é a de referência da categoria{t ? <> ({pct(t.occ)})</> : null}. No questionário, a tarifa e a ocupação esperadas substituem as de referência quando são preenchidas{biz.adrOwn || biz.occOwn ? <> (este hotel usa {[biz.adrOwn && 'a tarifa', biz.occOwn && 'a ocupação'].filter(Boolean).join(' e ')} informada)</> : null}.</p>
          </li>

          <li>
            <h3>Receitas</h3>
            <Calc label={`RevPAR = ${biz.adr ? money(biz.adr) : 'ADR'} × ${biz.occ ? pct(biz.occ) : 'ocupação'}`} value={brl(biz.revpar)} />
            <Calc label={`Receita total = hospedagem (${ev.keys} UHs × RevPAR × 365) × (1 + ${p ? pct(p.other) : 'A&B e outras'})`} value={brl(biz.revenueYear)} />
            <Calc label="TRevPAR = receita total ÷ UHs disponíveis no ano" value={brl(biz.trevpar)} />
            <p>Além da hospedagem entram A&B, eventos, spa e outras receitas, numa proporção típica da categoria. A&B pesa 20–30% da receita num hotel full service e 35–45% em resorts; no all inclusive a comida já está na diária do pacote.</p>
          </li>

          <li>
            <h3>GOP e EBITDA</h3>
            <Calc label={`GOP = receita total × margem de ${p ? pct(p.gop) : '—'}`} value={brl(biz.gopYear)} />
            <Calc label={`EBITDA = GOP − ${pct(ASSUME.baseFee)} da receita − ${pct(ASSUME.incentiveFee)} do GOP − FF&E ${pct(ASSUME.ffe)} − IPTU e seguros ${pct(ASSUME.fixedCharges)}`} value={brl(biz.ebitdaYear)} />
            <Calc label="EBITDA por mês" value={brl(biz.ebitdaMonth)} />
            <p>A margem GOP é a da categoria. Na JLL, resorts brasileiros ficaram entre 30% (2023) e 43,5% (2024), e o segmento premium entre 28,5% e 40,1%. Do GOP saem a taxa de administração (HVS: 4–5% da receita mais 10–15% do GOP), a reserva para repor mobiliário e equipamentos (FF&E, 4–5% da receita em contratos) e IPTU e seguros.</p>
          </li>

          <li>
            <h3>Investimento</h3>
            <p>Parte da obra do mapa. Sim e Não no checklist do relatório constroem ou demolem no mapa, então o custo acompanha. Os custos fora da obra só entram quando confirmados: {EXTRAS.map((e) => `${e.ask.replace('?', '').toLowerCase()} (${pct(e.pct)})`).join(', ')}. A faixa de orçamento do questionário não entra na conta: o relatório só diz se o investimento cabe nela.</p>
            <Calc label="Investimento" value={money(biz.investment)} />
            <Calc label={`Custo por UH (mercado da categoria: ${t ? money(t.costPerKey) : '—'})`} value={brl(biz.perKey)} />
          </li>

          <li>
            <h3>Retorno e valor</h3>
            <Calc label="Yield on cost = EBITDA estabilizado ÷ investimento" value={biz.ready ? pct(biz.yieldOnCost, 1) : '—'} />
            <Calc label={`Valor do ativo = EBITDA ÷ cap rate de ${pct(ASSUME.capRate)}`} value={brl(biz.value)} />
            <Calc label={`Payback: anos até o caixa cobrir o investimento, com ocupação de ${pct(ASSUME.ramp[0])} e ${pct(ASSUME.ramp[1])} da estabilizada nos anos 1 e 2`} value={biz.ready ? years(biz.payback) : '—'} />
            <Calc label={`TIR real em 10 anos: obra no ano 0, EBITDA nos anos 1 a 10 e venda no ano 10 pelo cap rate (menos ${pct(ASSUME.sellCost)})`} value={biz.irr != null ? pct(biz.irr, 1) : '—'} />
            <Calc label={`VPL do mesmo fluxo a ${pct(ASSUME.discount)} ao ano, real`} value={biz.ready ? `${biz.npv < 0 ? '−' : ''}${money(Math.abs(biz.npv))}` : '—'} />
            <p>O cap rate de {pct(ASSUME.capRate)} fica no meio dos negócios recentes de hotéis no Brasil, de 8,8% a 12%. A rampa segue o padrão de cerca de três anos até um hotel novo estabilizar.</p>
          </li>

          <li>
            <h3>Ocupação de equilíbrio e sensibilidade</h3>
            <p>Os custos operacionais são {pct(ASSUME.fixedShare)} fixos (folha-base, manutenção) e o resto acompanha as diárias vendidas. A ocupação de equilíbrio é a que zera o EBITDA com a diária de hoje{biz.breakEven != null ? <> ({pct(biz.breakEven)})</> : null}. A sensibilidade refaz a TIR com a diária 10% menor ou maior e a ocupação 10 pontos abaixo ou acima.</p>
          </li>
        </ol>

        <p className="note">
          Diárias e ocupação de referência: Panorama da Hotelaria Brasileira 2026 (HotelInvest/FOHB) para Econômico, Midscale e Upscale,
          Anuário BLTA 2026 para Luxo e Resorts Brasil/JLL para a ocupação de resorts. Margens: JLL, Hotelaria em Números. Contratos de
          gestão: HVS. Empregos: ABIH-SP e Resorts Brasil. A diária de Resort e de All Inclusive, a parte fixa dos custos, IPTU e seguros,
          a taxa de desconto e os custos fora da obra são estimativas. Valores reais, sem inflação e sem financiamento. É uma simulação
          para comparar cenários, não um estudo de viabilidade.
        </p>
      </motion.div>
    </motion.div>
  )
}
