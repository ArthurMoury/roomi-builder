// Celular: a interface empilha (questionário em coluna, checklist embaixo do mapa). O mesmo corte do CSS.
export const isPhone = () => matchMedia('(max-width: 720px)').matches
// Tela de toque: sem cursor, o toque faz o papel do clique
export const isTouch = () => matchMedia('(pointer: coarse)').matches
