import { useEffect } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'

// Número que corre até o valor novo (mola do Motion fora do ciclo de render)
export function Counter({ value, format }: { value: number; format: (v: number) => string }) {
  const mv = useSpring(value, { stiffness: 90, damping: 20 })
  useEffect(() => { mv.set(value) }, [mv, value])
  const text = useTransform(mv, format)
  return <motion.span>{text}</motion.span>
}
