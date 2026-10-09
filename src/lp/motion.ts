// Queda dos elementos na LP: o GSAP escreve (a abertura no carregamento, o resto com a rolagem) e
// o 3D lê a cada quadro. Fica fora do pedaço 3D para a LP abrir sem carregar o three.js.
export const fall = {
  intro: 0, // 0 → 1: o grupo da abertura cai do céu
  p: 0,     // 0 → 4,6 ao longo das etapas do negócio; o grupo g fica pousado perto de p = g
}
