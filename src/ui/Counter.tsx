import { useEffect } from 'react'
import { AnimatePresence, motion, useSpring, useTransform } from 'motion/react'
import { investRange } from '../lib/business'

// Número que corre até o valor novo (mola do Motion fora do ciclo de render)
export function Counter({ value, format }: { value: number; format: (v: number) => string }) {
  const mv = useSpring(value, { stiffness: 90, damping: 20 })
  useEffect(() => { mv.set(value) }, [mv, value])
  const text = useTransform(mv, format)
  return <motion.span>{text}</motion.span>
}

// Faixa de investimento no lugar do valor somado; a faixa nova entra quando muda
export function InvestRange({ value }: { value: number }) {
  const text = investRange(value) ?? '—'
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={text} style={{ display: 'inline-block' }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
        {text}
      </motion.span>
    </AnimatePresence>
  )
}
