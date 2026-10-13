// Rolagem da LP: o GSAP escreve e o 3D lê a cada quadro. Fica fora do pedaço 3D para a LP abrir sem
// carregar o three.js.
export const fall = {
  p: 0, // 0 → 5,6 ao longo dos passos (uma tela por unidade): o grupo g pousa perto de p = g, e de 4,6 a 5,6 as perguntas sobem por cima
}
