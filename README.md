# Roomi Resort Builder

Construtor gamificado de hotéis e resorts em 3D. Você monta o mapa e recebe o valor de construção, a categoria de mercado e a diária estimada.

Há dois modos, alternados com **Ctrl+B** ou pelo seletor da barra superior:

- **Analista** (padrão): campos de negócio numa barra inferior montam o hotel sozinho. No fim, um relatório só com a visão de negócios.
- **Construtor**: catálogo, resumo e ferramentas para montar e ajustar o mapa à mão.

```bash
npm install
npm run dev
```

## Stack

| Peça | Por quê |
|---|---|
| Vite + React + TypeScript | dev server rápido, build simples |
| three.js via @react-three/fiber + drei | volume 3D de verdade |
| anime.js v4 | coreografia da obra (anima `scale`/`position` dos objetos three.js) |
| Motion (`motion/react`) | interface: painéis, contadores, troca de categoria, relatório |
| Zustand | estado único compartilhado entre a cena e a UI |

## Escala

- Uma célula do mapa mede 5 × 5 m, e o terreno tem 40 × 40 células (200 × 200 m, cerca de 4 ha).
- Os modelos são desenhados em metros (`src/three/models.tsx`), com pegadas e alturas reais. Exemplos: o edifício de 48 quartos tem 30 × 15 m e cerca de 17 m de altura (térreo + 4 andares); a piscina adulto tem lâmina de 18 × 7,5 m; a quadra de tênis segue a medida oficial de 23,77 × 10,97 m.
- As miniaturas do catálogo são fotografadas dos próprios modelos 3D (`src/three/Thumbs.tsx`).

## Desempenho

- As peças usam geometrias unitárias compartilhadas.
- Quando a obra de um item termina, as peças dele viram poucas malhas, uma por material (`src/three/merge.ts`).
- O canvas reduz a resolução sozinho se o FPS cair (`PerformanceMonitor`).

## Design (RoomiVault › design)

- Só as três cores: `#1D1D1B`, `#F97B55`, `#F1E9E7`. Fontes Editorial New (títulos e números) e Futura New (UI).
- Planos chapados (toon em 3 degraus), contorno fino de 1px e meio-tom em espaço de tela como textura (água, grama, areia, asfalto, laje).
- Plano atrás de plano: a laje coral deslocada sob a ilha.
- Vidro só nos painéis, com camada de barreira (fundo 84% opaco), que é o uso aprovado para a Roomi.
- Temas escuro e claro. No claro, o coral fica só em preenchimentos e bordas, porque texto coral sobre creme reprova em contraste.
- Logo: o wordmark oficial (`public/roomi-wordmark.svg`, copiado de `RoomiVault/deck/marca`), aplicado por máscara CSS para seguir a cor do tema.

## Cálculo (`src/lib/valuation.ts`)

- **Custo de obra**: soma dos itens. Os valores vêm de CUB Sinduscon-SP ago/2026, SINAPI mai/2026, faixas de piscina e orçamentos de quadras. Itens marcados com `est` são estimativas. Não inclui terreno.
- **Categoria**: o nível mais alto cujos requisitos foram cumpridos (Econômico → Midscale → Upscale → Resort → Resort All Inclusive, com Luxo como trilha própria).
- **Diária**: ADR da categoria × mix de UHs (amortecido por raiz) × bônus de amenidades (até +12%).
- **ADR e ocupação de referência**: Panorama da Hotelaria Brasileira 2026 (HotelInvest/FOHB), Anuário BLTA 2026 e Resorts Brasil/JLL. A ADR de resort e de all inclusive é estimativa.
- **Retorno**: anos até o EBITDA cobrir o investimento, com rampa de ocupação (ver o modelo de negócios abaixo, `src/lib/business.ts`). No modo analista, a tarifa e a ocupação esperadas substituem as de referência quando preenchidas.

## Modo analista

- Um questionário na barra inferior monta o hotel enquanto é respondido. As perguntas aparecem uma por vez: destino, categoria, UHs, público, tarifa média esperada, ocupação esperada e orçamento.
- As escolhas são cartões com desenho próprio: praia, campo e serra; as seis categorias com a diária de referência; e os públicos.
- Os números usam um controle próprio. Ele tem o valor grande, os botões − e +, uma régua e atalhos (por exemplo 60, 120, 200, 300 e 450 UHs).
- Tarifa, ocupação e orçamento podem ficar na referência de mercado ("Usar a do mercado" ou "Sem orçamento").
- Cada resposta vira uma etiqueta acima da barra, e clicar nela volta à pergunta. Ao lado ficam o investimento e o EBITDA por mês, ao vivo.
- Destino, categoria, UHs e público mudam o que é construído. Tarifa, ocupação e orçamento só mudam as contas.
- Cada mudança gera um programa de necessidades (`src/lib/program.ts`): chegada, lazer da categoria, extras do público, o que cresce com as UHs, hospedagem e, por fim, caminhos e paisagismo.
  - O lazer de cada categoria cumpre os requisitos dela.
  - O mix de UHs depende da categoria e do público.
  - Piscinas, restaurantes, quadras e vagas crescem com as UHs.
- O programa é implantado pelo mesmo motor do posicionamento automático. O mapa vai até o layout novo sem refazer o que não mudou: o que ficou no lugar fica, o que saiu é demolido e o que entrou sobe em cascata.
- A hospedagem é implantada depois do lazer. Assim, mudar só as UHs acrescenta ou tira prédios sem mexer no resto.
- O destino praia usa o modelo de implantação "Frente de mar" e mostra o mar ao norte; na categoria Luxo, a praia vira "Vila de bangalôs". Campo e serra usam o "Núcleo central".
- Se a hospedagem não couber no terreno, um aviso diz quantas UHs couberam.

### Etapa 1: checklist de escopo

"Escopo e relatório" (ou "Ver relatório") abre o checklist num painel ao lado do mapa. Os itens entram um a um.

- **Lazer e serviços**: piscina, quadra, restaurante, bar, spa, academia, kids club, eventos, parque aquático e estacionamento. O que está no mapa já vem marcado. O interruptor Sim/Não muda o mapa na hora:
  - "Não" demole o que houver daquele grupo.
  - "Sim" constrói o item típico onde ele faz mais sentido.
  - A resposta continua valendo quando o questionário remonta o hotel.
- **Custos fora da obra**: só entram quando confirmados. São estimativas: FF&E 12%, projetos e licenças 6%, pré-operacional 3% e contingência 5% da obra.
- O investimento acompanha cada resposta. "Gerar relatório" leva à etapa 2.

### Etapa 2: relatório de negócios

O relatório segue o molde de deck da Roomi (RoomiVault › design). Ele tem páginas 16:9, só as três cores, Editorial New nos títulos e numerais e Futura New no corpo. Na tela as páginas encolhem para caber; em "Imprimir / PDF" cada página vira uma folha de 13,333 × 7,5 polegadas.

1. **Capa** (escura):
   - lockup ROOMI | Resort Builder;
   - "Simulação de negócio", o nome do hotel e a categoria em coral;
   - investimento, TIR e payback no pé;
   - a fachada do hotel com o plano de retícula atrás.
2. **O hotel em números**: investimento, TIR real em 10 anos, payback e EBITDA por mês em numerais grandes, mais onde vai o investimento (custo por área).
3. **A operação estabilizada**: diária, ocupação, RevPAR, TRevPAR, receita, GOP, EBITDA e empregos diretos, mais de onde vem a receita.
4. **Quando o investimento volta**: o caixa acumulado em 10 anos, com o ponto de payback e o EBITDA e a ocupação de cada ano.
5. **Valor e risco**:
   - yield on cost contra o cap rate;
   - valor do ativo pronto;
   - custo por UH contra o da categoria;
   - ocupação de equilíbrio;
   - sensibilidade da TIR à diária e à ocupação.
6. **A diária entre as categorias**: o mesmo hotel em cada categoria.
7. **Escopo e premissas**: o que o checklist confirmou, a conta do investimento e as premissas com as fontes.
8. **Contracapa** (coral): o chapéu da Roomi e o lockup.

A imagem do hotel não é a tela. O mapa atual é montado numa cena à parte, sem animação, sem moldura de seleção e sem a câmera de quem está usando, e fotografado de frente, pela chegada (`FrontPhoto` em `src/three/Thumbs.tsx`). O relatório do modo construtor usa a mesma foto.

### Modelo de negócios (`src/lib/business.ts`)

- **Receita total**: hospedagem × (1 + outras receitas da categoria). Outras receitas são A&B, eventos e spa: +5% no econômico, +40% no upscale e +75% a +80% em resort e luxo. No all inclusive é +15%, porque a comida já está no pacote.
- **GOP**: receita total × margem da categoria, de 32% a 38%. Na JLL, resorts brasileiros ficaram entre 30% (2023) e 43,5% (2024).
- **EBITDA**: GOP menos:
  - taxa de administração: 4% da receita e 10% do GOP (HVS: 4–5% e 10–15%);
  - reserva de FF&E: 4% da receita;
  - IPTU e seguros: 2% da receita.
- **Rampa e custos**: a ocupação é 75% da estabilizada no ano 1 e 90% no ano 2, e estabiliza no ano 3. Os custos operacionais são 60% fixos.
- **TIR e VPL**:
  - a obra entra no ano 0;
  - o EBITDA entra nos anos 1 a 10;
  - a venda no ano 10 é pelo cap rate de 10%, menos 2%. Negócios recentes no Brasil ficaram entre 8,8% e 12%.
  - O VPL usa 12% ao ano real.
  - Valores reais, sem inflação, sem terreno e sem financiamento.
- **Empregos diretos**: UHs × índice da categoria. A ABIH-SP mede 0,58 por UH na hotelaria paulista; a Resorts Brasil, cerca de 1,4 por quarto em resorts.

### Como calculamos

O botão "Como calculamos" (no resumo, na barra do analista e no relatório) explica cada passo com os números do hotel atual: custo de obra, categoria, diária e ocupação, receitas, GOP e EBITDA, investimento, retorno e valor, ocupação de equilíbrio e sensibilidade.

## Posicionamento automático (modo construtor)

- No seletor Manual/Automático, o automático faz cada clique no catálogo construir o item direto no lugar que mais faz sentido (`src/lib/autoplace.ts`).
- O terreno é dividido em papéis: chegada, lazer, hospedagem, luxo e spa, esportes e diversão. Cada modelo de implantação posiciona esses papéis de um jeito:
  - **Núcleo central**: piscina e restaurantes no meio, blocos de quartos em ferradura voltados para eles, quadras junto à entrada e ao estacionamento, luxo num lado reservado.
  - **Frente de mar**: o mar fica ao norte. A recepção fica no lado de terra, os quartos em fileiras de frente para o mar e o lazer numa faixa junto à areia. Quadras no interior do terreno, villas e spa numa ponta silenciosa.
  - **Vila de bangalôs**: núcleo compacto (recepção, restaurante, piscina) junto à chegada. Villas e bangalôs se espalham rumo ao mar por caminhos próprios, sem carros.
- Cada item tem uma leitura:
  - o papel em que fica;
  - para onde a frente aponta (núcleo, chegada, vista ou água);
  - de quem fica perto e de quem fica longe, como ruído e privacidade;
  - se encosta numa divisa;
  - quanta folga deixa para caminho.

  O aviso mostra a leitura usada.
- O ponto de partida de cada construção é a célula logo à frente da fachada principal. Quando o ponto de partida de um item novo fica a 3–7 blocos do de outro, ou de um caminho existente, o caminho é construído.
- Alguns itens têm leitura própria:
  - os caminhos ligam todos os acessos;
  - a via vai da recepção até a divisa sul;
  - a cerca viva contorna o estacionamento e a cerca contorna as quadras;
  - o muro protege a ala de luxo e o deck contorna a piscina;
  - postes, balizadores e bancos acompanham os caminhos;
  - árvores, palmeiras e canteiros ficam junto aos caminhos e prédios.
- No automático, as zonas do modelo aparecem tracejadas no chão.

## Referências de implantação

Os modelos de implantação seguem os desenhos mais comuns de resorts reais. A pesquisa usou guias de projeto, o mapa oficial de um resort e relatos de viagem, então os números valem como regra prática, não como norma.

| Modelo | Como aparece no mundo real | Exemplos |
|---|---|---|
| Núcleo central | Via → recepção com estacionamento ao lado → buffet e bar de piscina → piscina central com kids club e splash park → blocos de 2 a 3 andares em anel ou ferradura → vista ou praia. Esportes, academia e spa na borda, perto da entrada | Grand Palladium Imbassaí (BA), Club Med Trancoso (BA), Vila Galé Marés (BA) |
| Frente de mar | Recepção no lado de terra → blocos de quartos → faixa de lazer junto à praia (restaurantes, piscina, kids club) → areia. Quadras no interior, ala premium e spa numa ponta | Costão do Santinho (SC) |
| Vila de bangalôs | Núcleo compacto na chegada → villas em caminhos que se ramificam rumo à melhor borda, sem carros | Nannai (PE), Resort Eco de Bernardes+Jacobsen em Praia do Forte (BA), Club Med Rio das Pedras (RJ) |

Regras práticas usadas nas leituras:
- quadras na borda, perto da entrada e do estacionamento, longe da piscina e das villas;
- kids club e piscina infantil junto à piscina principal, com os blocos de família perto;
- spa num canto silencioso;
- estacionamento ao lado da recepção, sem ficar na frente dela;
- chalés a 15–25 m de eixo a eixo.

Outras referências, ainda sem leitura no app:
- densidade de 40–60 UHs/ha em blocos e de 15–25 UHs/ha em villas;
- 2,5–4 m² de lâmina d'água por UH.

Fontes:
- archgyan.com/how-to-design-a-resort
- studiomatrx.org (zoneamento e piscinas em hotelaria)
- watg.com
- mapa e ficha técnica do Grand Palladium Imbassaí (palladiumhotelgroup.com)
- viajenaviagem.com (Imbassaí, Club Med Trancoso, Costão do Santinho, Nannai, Costa do Sauípe)
- jacobsenarquitetura.com (Resort Eco)
- hotel-online.com (Club Med Rio das Pedras)
- panrotas.com.br (Vila Galé Marés)

## Modelos

O botão **Modelos** abre uma galeria de resorts prontos para abrir e mexer:

- all inclusive pé na areia;
- resort de campo para famílias;
- villas de luxo na praia;
- refúgio na serra;
- hotel de eventos;
- o exemplo desenhado à mão.

A imagem de cada modelo é fotografada do próprio layout 3D. Os modelos paramétricos preenchem os campos do analista e são gerados pelo mesmo programa (`src/data/models.ts`).

## Controles

- `Ctrl+B` alterna entre os modos analista e construtor. `Esc` fecha a janela aberta.
- Câmera: arraste o terreno para girar, use o botão direito para mover e a roda para dar zoom.
- Construir: escolha um item no catálogo e clique no terreno. `Esc` cancela.
  - `R` gira o item 90° por vez, passando pelos quatro lados. A prévia no ponteiro é o próprio modelo, coral se o lugar estiver livre e preto se estiver ocupado.
  - Caminhos, cercas, árvores, canteiros e balizadores podem ser desenhados: segure e arraste pelo terreno.
- Selecionar: clique num item para selecioná-lo e arraste para movê-lo. A moldura fica coral se o lugar estiver livre e preta se estiver ocupado; num lugar ocupado o item volta para onde estava. `R` gira o item selecionado no próprio lugar; se ele não couber girado, nada muda e aparece um aviso. `Del` demole o item selecionado.
- Demolir: clique num item para demolir, ou segure e arraste para demolir tudo que o ponteiro tocar.
- As barras laterais fecham pela seta do cabeçalho e reabrem pela aba que fica na borda.
- O tema padrão é o claro. O botão de sol/lua alterna, e a escolha fica salva no navegador.

## Esboços

- **Salvar esboço** baixa um arquivo `<nome-do-hotel>.roomi.json`. Ele traz o nome do hotel, a lista de itens (id do catálogo, célula e rotação), os campos do analista e as respostas do checklist.
- **Abrir** carrega esse arquivo e reconstrói o resort com a animação de obra.
- Itens fora do catálogo, fora do terreno, sobrepostos ou malformados ficam de fora, e o aviso diz quantos.

## Caminhos, cercas e mobiliário

- Caminho de pedra, calçada, via interna, cerca de madeira, cerca viva e muro são trechos de 5 m que se ligam aos vizinhos iguais. Lado a lado, eles formam linhas contínuas com curvas, tês e cruzamentos (`src/three/landscape.tsx`).
- Também há deck, poste, balizador, banco, espreguiçadeiras, fogueira, pergolado, gazebo, chafariz, redário, árvore, canteiro e guarita.
- Esses itens entram no custo de obra (valores estimados), mas não contam como amenidade na diária.
