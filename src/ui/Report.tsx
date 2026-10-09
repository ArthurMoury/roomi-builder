import { motion } from 'motion/react'
import { CATS, ITEM_BY_ID } from '../data/catalog'
import { money, type Evaluation, type Placed } from '../lib/valuation'
import type { Business } from '../lib/business'
import { AdrBars } from './Summary'
import { useStore } from '../store'

export function Report({ ev, biz, placed, name, onClose }: {
  ev: Evaluation; biz: Business; placed: Placed[]; name: string; onClose: () => void
}) {
  const photo = useStore((s) => s.photo)
  const qty = new Map<string, number>()
  for (const p of placed) qty.set(p.itemId, (qty.get(p.itemId) ?? 0) + 1)
  const rows = [...qty].map(([id, n]) => ({ it: ITEM_BY_ID[id], n }))
    .sort((a, b) => b.it.cost * b.n - a.it.cost * a.n)

  return (
    <motion.div className="overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="report" onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}>
        <div>
          <div className="eyebrow">Mapa construído</div>
          <h1 style={{ margin: '8px 0 20px' }}>{name}</h1>
          {photo ? <img src={photo} alt={`Fachada do ${name}`} /> : <div className="photo-wait">Fotografando a fachada</div>}
          <div className="kpis">
            <div><div className="eyebrow">Construção</div><div className="v o">{money(ev.cost)}</div></div>
            <div><div className="eyebrow">Categoria</div><div className="v">{ev.tier?.name ?? '—'}</div></div>
            <div><div className="eyebrow">Diária (ADR)</div><div className="v o">{ev.adr ? money(ev.adr) : '—'}</div></div>
            <div><div className="eyebrow">UHs</div><div className="v">{ev.keys}</div></div>
            <div><div className="eyebrow">Receita/ano</div><div className="v">{ev.revenue ? money(ev.revenue) : '—'}</div></div>
            <div><div className="eyebrow">Retorno</div><div className="v">{biz.payback ? `${biz.payback.toFixed(1).replace('.', ',')} anos` : '—'}</div></div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div className="actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => window.print()}>Imprimir / PDF</button>
            <button className="btn primary" onClick={onClose}>Voltar a construir</button>
          </div>

          <section>
            <div className="eyebrow">Custo por área</div>
            <table><tbody>
              {CATS.filter((c) => ev.byCat.get(c.id)).map((c) => (
                <tr key={c.id}><td>{c.label}</td><td>{money(ev.byCat.get(c.id)!)}</td></tr>
              ))}
            </tbody></table>
          </section>

          <section>
            <div className="eyebrow">Itens</div>
            <table>
              <thead><tr><th>Item</th><th>Qtd.</th><th>Subtotal</th></tr></thead>
              <tbody>
                {rows.map(({ it, n }) => (
                  <tr key={it.id}><td>{it.name}{it.est ? ' *' : ''}</td><td>{n}</td><td>{money(it.cost * n)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <div className="eyebrow">Diária vs. categorias de mercado</div>
            <AdrBars ev={ev} />
          </section>

          <p className="note">
            * Estimativa a partir do CUB/m² e de multiplicadores de padrão. Custos de obra sem terreno, com acabamento e
            equipamentos básicos. Diária = média da categoria × mix de UHs × bônus de amenidades (até +12%).
            Fontes: CUB Sinduscon-SP ago/2026, SINAPI mai/2026, Panorama da Hotelaria Brasileira 2026 (HotelInvest/FOHB),
            Anuário BLTA 2026, Radar Resorts Brasil (JLL/STR). ADR de resort e de all inclusive são estimativas.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
