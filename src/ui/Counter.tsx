import { AnimatePresence, motion } from 'motion/react'
import { investRange } from '../lib/business'
import { brl } from '../lib/range'

// Texto de uma faixa: a faixa nova entra quando muda (nada sai cravado, então não há número correndo)
export function RangeText({ text }: { text: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={text} style={{ display: 'inline-block' }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
        {text}
      </motion.span>
    </AnimatePresence>
  )
}

// Faixa de investimento no lugar do valor somado, a mesma do relatório
export const InvestRange = ({ value }: { value: number }) => <RangeText text={value ? brl(investRange(value)) : '—'} />
