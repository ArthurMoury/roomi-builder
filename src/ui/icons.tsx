// Seta fina para abrir e fechar as barras laterais
export const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d={dir === 'left' ? 'M8.5 3 4.5 7l4 4' : 'M5.5 3l4 4-4 4'} />
  </svg>
)

// "i" de informação: abre a explicação dos cálculos
export const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <circle cx="8" cy="8" r="6.4" />
    <path d="M8 7.2v4M8 4.6v.9" strokeLinecap="round" />
  </svg>
)

// Seta para baixo dos seletores
export const Caret = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M2 3.5 5 6.5l3-3" />
  </svg>
)
