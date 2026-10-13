# Roomi Maker

Simulador de resorts em 3D para a visão de negócios. Uma LP apresenta o produto; no Maker, um questionário monta o hotel sozinho num terreno de 4 hectares, um checklist confirma o escopo e o relatório sai em folhas A4 (para imprimir em PDF ou baixar em HTML) com investimento, operação e retorno em 10 anos. Nenhuma estimativa sai cravada: tudo vem em faixa, e só o que a pessoa escolheu ou digitou aparece exato.

```bash
npm install
npm run dev
```

A LP abre em `/` e o Maker em `/#builder` (cada um carrega à parte). O nome ao lado do logo é Maker; o repositório e a pasta continuam `roomi-builder`. O modo construtor, de montar o mapa à mão, saiu do app em 09/10/2026: o código está na tag `backup-construtor` e a explicação no cofre, em `RoomiVault/projetos/Roomi Builder/Modo construtor.md`.

## Stack

| Peça | Por quê |
|---|---|
| Vite + React + TypeScript | dev server rápido, build simples, LP e Maker em pedaços separados |
| three.js via @react-three/fiber | volume 3D de verdade |
| anime.js v4 | coreografia da obra (anima `scale`/`position` dos objetos three.js) |
| Motion (`motion/react`) | interface do Maker: painéis, contadores, troca de pergunta |
| GSAP + ScrollTrigger | rolagem da LP (nunca na mesma tela que o Motion) |
| Zustand | estado único compartilhado entre a cena e a UI |

## Escala

- Uma célula do mapa mede 5 × 5 m, e o terreno tem 40 × 40 células (200 × 200 m, cerca de 4 ha).
- Os modelos são desenhados em metros (`src/three/models.tsx`), com pegadas e alturas reais. Exemplos: o edifício de 48 quartos tem 30 × 15 m e cerca de 17 m de altura (térreo + 4 andares); a piscina adulto tem lâmina de 18 × 7,5 m; a quadra de tênis segue a medida oficial de 23,77 × 10,97 m.

## Câmera

- O board abre reto e de frente, com a chegada (sul) embaixo (`src/three/view.ts`).
- Um clique numa das laterais gira o board 90°: a lateral clicada vem para a frente. Passar o mouse sobre ela mostra o realce e a seta do giro.
- A roda do mouse aproxima ou afasta. Não há órbita livre nem arrasto com o botão direito.
- O enquadramento cabe o board na área que a interface deixa livre: acima do questionário (que muda de altura) e, com o checklist aberto, à esquerda dele.

## Desempenho

- As peças usam geometrias unitárias compartilhadas.
- Quando a obra de um item termina, as peças dele viram poucas malhas, uma por material (`src/three/merge.ts`).
- Nenhum item roda código por quadro, e o ponteiro só testa o terreno, não as centenas de peças.
- O mapa para de desenhar enquanto o relatório, a galeria ou a explicação o cobrem. Na LP, o 3D para quando as seções claras o cobrem.
- A resolução do canvas é fixa: a da tela, até 2×. Baixá-la quando a obra pesa deixava o mapa borrado depois de escolher a categoria.
- A abertura da LP é a porta em Canvas 2D, que não depende do three.js. O 3D dos passos carrega no primeiro respiro do navegador (ou na primeira rolagem) e só desenha depois que a abertura começa a sair. Sem WebGL, a planta estática fica.
- Fontes em WOFF2 só com o latim (fontTools): 479 kB viraram 142 kB. O chapéu da contracapa e da LP virou PNG de 51 kB (o SVG tinha 683 kB e 844 caminhos).
- Na LP, em rede 4G e CPU de celular, com cache frio: de 1.086 kB para 614 kB transferidos, LCP de 2,7–3,2 s para 2,5 s e tarefas longas de 3,1–3,8 s para 2,2 s.
- Na troca grande de elementos (Resort para All Inclusive com 300 UHs), as tarefas longas caíram de 86 (9,8 s) para 8 (1 s):
  - o mapa vivo é comparado item a item, então cada demolição que termina não refaz a avaliação nem o negócio;
  - só o item que mudou re-renderiza (memo);
  - as demolições que terminam no mesmo quadro saem do mapa numa mudança só;
  - a junção das peças em poucas malhas entra numa fila de no máximo 6 ms por quadro;
  - a grade de sensibilidade (dezenas de TIRs) só é calculada quando o relatório pede.
- Comparado à versão com construtor (tag `backup-construtor`), o Maker carrega 1.446 kB (415 kB em gzip) em vez de 1.591 kB (462 kB). Saíram o drei, o troika e as 59 fotos de catálogo tiradas na abertura.

## Design (RoomiVault › design)

- Só as três cores: `#1D1D1B`, `#F97B55`, `#F1E9E7`. Fontes Editorial New (títulos e números) e Futura New (UI).
- Planos chapados (toon em 3 degraus), contorno fino de 1px e meio-tom em espaço de tela como textura (água, grama, areia, asfalto, laje).
- Plano atrás de plano: a laje coral deslocada sob a ilha.
- Os campos de preencher (questionário, etiquetas e checklist) são sempre o inverso do fundo: no tema claro, grafite sobre o bege; no escuro, bege sobre o grafite.
- Temas escuro e claro (o claro é o padrão). No claro, o coral fica só em preenchimentos e bordas, porque texto coral sobre creme reprova em contraste.
- Logo: o wordmark oficial (`public/roomi-wordmark.svg`, copiado de `RoomiVault/deck/marca`), aplicado por máscara CSS para seguir a cor do tema.
- Favicon: a porta da marca em miniatura (sala escura, porta creme entreaberta e a luz coral), em SVG, `.ico` de 16 a 48 px e o ícone de 180 px para o iPhone.
- A exceção ao "sem degradê" é a abertura da LP: a luz coral da porta tinge a sala, e o vidro (cofre: design › estilos › Glassmorphism, com camada de barreira) fica na barra do topo e no cartão dos números, onde há cor atrás para desfocar.

## O mar

No destino praia, o mar é um bloco de maquete encostado na divisa de água do modelo de implantação (`src/three/Sea.tsx`):

- a mesma laje em meio-tom do terreno, um degrau abaixo dele, com contorno fino;
- o tampo de água coral chapada;
- junto ao terreno, a faixa de areia em pontos miúdos;
- na linha d'água, a espuma creme vai e volta, com borda ondulada e contorno;
- no mar, traços de onda creme correm para a praia;
- o enquadramento da câmera passa a incluir o bloco, em qualquer giro.

## LP (`src/lp`)

Segue as notas do cofre sobre rolagem e GSAP: a rolagem é de quem lê, cada passo muda uma coisa visível, o palco fica preso com `position: sticky` e o ScrollTrigger só mede o progresso. Texto só se move antes de ser lido.

1. **Abertura**: "Simulador de resorts / Comece seu sonho / com a Roomi", no título em três linhas da capa dos PDFs, e a porta da Roomi com o fundo (RoomiVault › design › Formas geométricas da marca, "Porta que abre"), em Canvas 2D (`src/lp/Door.tsx`).
   - Parede escura, porta creme, a luz coral do quarto, a bandeira e o piso em meio-tom, redesenhados nas coordenadas da arte. Tema escuro do molde: ponto creme e contorno creme a 55%.
   - Ao carregar, a porta sai fechada e abre numa mola, e a luz coral cresce com o vão. Parada, balança devagar (ciclo de 9 s).
   - Com o mouse em cima, a porta segue o mouse (para a direita abre), e um clique a empurra: ela escancara e volta balançando. Cada vértice anda com o mouse em paralaxe; a retícula do chão engrossa perto da soleira quando entra luz e corre mais quando a porta mexe; a bandeira pega o vento dela.
   - Com a rolagem, a porta abre de vez. A abertura é opaca e sobe como uma cortina sobre o 3D dos passos.
   - O fundo deixou de ser preto chapado: um respiro creme no alto, coral embaixo e um brilho coral atrás da porta, que fica mais forte quanto mais ela abre (só opacidade, sem repintar).
2. **Como funciona**, em quatro passos que levam às perguntas: defina seus critérios, confira as restrições, entenda os cálculos (com o caixa em 10 anos desenhado na rolagem) e organize seu relatório. Cada passo traz um exemplo do resort de exemplo.
   - A cada passo, um grupo novo de oito ou nove elementos desce do céu enquanto o anterior segue descendo até sumir, sem quique e quase sem giro. A posição é função da rolagem (scrub com inércia), então voltar desfaz. Cada peça vira poucas malhas ao montar.
   - Na última tela da seção, as perguntas sobem por cima, com o texto e os elementos parados.
3. **Perguntas que visam o futuro**: as sete perguntas de negócio do questionário e o que cada uma muda.
4. **O relatório**: as seis folhas A4 do exemplo, com a fachada fotografada pelo próprio 3D, saem da pilha e abrem em leque com a rolagem (no celular, uma fila para deslizar). O leque lê as medidas uma vez e só escreve transform, que a placa de vídeo compõe. Um clique numa folha abre o leitor nela.
5. **Chamada final** no coral da contracapa, com o chapéu.

Todos os números da LP saem do motor, em faixa, para o primeiro modelo da galeria (all inclusive pé na areia, 300 UHs), com o investimento completo (`src/lp/example.ts`). Com movimento reduzido, a porta aparece parada, como na arte, cada passo mostra o seu grupo já pousado e nada anima.

## Cálculo (`src/lib/valuation.ts`)

- **Custo de obra**: soma dos itens. Os valores vêm de CUB Sinduscon-SP ago/2026, SINAPI mai/2026, faixas de piscina e orçamentos de quadras. Itens marcados com `est` são estimativas. Não inclui terreno.
- **Categoria**: o nível mais alto cujos requisitos foram cumpridos (Econômico → Midscale → Upscale → Resort → Resort All Inclusive, com Luxo como trilha própria).
- **Diária**: ADR da categoria × mix de UHs (amortecido por raiz) × bônus de amenidades (até +12%).
- **ADR e ocupação de referência**: Panorama da Hotelaria Brasileira 2026 (HotelInvest/FOHB), Anuário BLTA 2026 e Resorts Brasil/JLL. A ADR de resort e de all inclusive é estimativa.
- **Retorno**: anos até o caixa da operação cobrir o investimento, com rampa de ocupação (ver o modelo de negócios abaixo, `src/lib/business.ts`). A tarifa e a ocupação esperadas do questionário substituem as estimadas quando preenchidas.

## Questionário

- Um questionário na barra inferior monta o hotel enquanto é respondido. As perguntas aparecem uma por vez: nome do projeto, destino, categoria, UHs, público, tarifa média esperada, ocupação esperada e faixa de orçamento.
- O nome vai na capa do relatório e no arquivo salvo.
- As escolhas são cartões com desenho próprio: praia, campo e serra; as seis categorias com a faixa de diária de referência; os públicos; e as faixas de orçamento.
- O orçamento nunca é um valor exato: são faixas (até R$ 50 mi, 50 a 100, 100 a 200, 200 a 400 e acima de 400 mi). O relatório só diz se o investimento cabe na faixa, passa do teto ou fica abaixo dela.
- Os números usam um controle próprio. Ele tem o valor grande, os botões − e +, uma régua e atalhos (por exemplo 60, 120, 200, 300 e 450 UHs).
- Ao lado, aparecem a faixa de investimento (de 8% abaixo a 15% acima da obra estimada, em degraus redondos, como "R$ 160 a 210 mi") e a faixa de EBITDA por mês, nunca o valor somado. O checklist mostra os custos de cada item também em faixa.
- Tarifa, ocupação e orçamento podem ficar de fora ("Usar a do mercado" ou "Sem orçamento"). Seguir sem mexer no controle da tarifa ou da ocupação também usa a estimada, que acompanha a categoria. As puladas ficam guardadas mesmo com o checklist aberto e fechado.
- Cada resposta vira uma etiqueta acima da barra, e clicar nela volta à pergunta. Ao lado ficam as faixas de investimento e de EBITDA por mês, ao vivo.
- Destino, categoria, UHs e público mudam o que é construído. Nome, tarifa, ocupação e orçamento só mudam o relatório.
- Cada mudança gera um programa de necessidades (`src/lib/program.ts`): chegada, lazer da categoria, extras do público, o que cresce com as UHs, hospedagem e, por fim, caminhos e paisagismo.
  - O lazer de cada categoria cumpre os requisitos dela.
  - O mix de UHs depende da categoria e do público.
  - Piscinas, restaurantes, quadras e vagas crescem com as UHs.
- O programa é implantado pelo motor de posicionamento automático. O mapa vai até o layout novo sem refazer o que não mudou: o que ficou no lugar fica, o que saiu é demolido e o que entrou sobe em cascata.
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

### Etapa 2: relatório de negócios em A4

São seis folhas A4 em retrato com os elementos dos PDFs da Roomi (RoomiVault › design › Molde de deck Roomi, levado ao retrato): só as três cores, Editorial New nos títulos e numerais, Futura New no corpo, título sobre régua de 2 px com o wordmark coral no canto, contador de página no pé, quadrado coral numerado, marca-texto coral no número da conclusão e planos com contorno e meio-tom. Margens de 16 mm nas laterais, 15 em cima e 14 embaixo. Na tela as folhas encolhem para caber; em "Imprimir / PDF" cada uma vira uma folha A4.

Toda estimativa sai em faixa (`src/lib/range.ts`), com as pontas arredondadas para fora em degraus redondos: "R$ 160 a 210 mi", "8% a 24%", "5 a 11 anos". Nos numerais grandes, as duas pontas ficam grandes, com um "a" pequeno entre elas. Só o que a pessoa escolheu ou digitou aparece exato: UHs, diária e ocupação esperadas, faixa de orçamento e respostas do checklist. O caixa acumulado vira barras de faixa (da ponta conservadora à otimista) e o payback, uma faixa no fundo do gráfico.

"Baixar HTML" gera um arquivo único (cofre: tecnologia › Desenvolvimento › HTMLs únicos e autocontidos): as seis folhas com só o CSS que elas usam, as fontes, o chapéu e a foto embutidos, e um bloco JSON com as entradas. Abre sem internet, encolhe para caber na tela e imprime em seis folhas A4 (`src/ui/exportHtml.ts`).

1. **Capa** (escura):
   - lockup ROOMI | Maker;
   - "Simulação de negócio", o nome do projeto e a categoria em coral;
   - a fachada do hotel com o plano de retícula atrás;
   - investimento, TIR e payback no pé.
2. **O hotel em números**: a conclusão numa frase, investimento, TIR real em 10 anos, payback e EBITDA por mês em numerais grandes, onde vai o investimento e as notas (faixa de orçamento, categoria pedida, premissas). A lista de onde vai o investimento mostra seis áreas e cede uma linha para cada nota extra, para as notas e as siglas caberem na folha.
3. **A operação estabilizada** (diária, ocupação, RevPAR, TRevPAR, receita, GOP, EBITDA, empregos e de onde vem a receita) e **Quando o investimento volta** (caixa acumulado em 10 anos com o payback, EBITDA e ocupação de cada ano).
4. **Valor e risco** (yield on cost, valor do ativo, custo por UH, ocupação de equilíbrio e sensibilidade da TIR) e **A diária entre as categorias**.
5. **Escopo e premissas**: o que o checklist confirmou, a conta do investimento, as premissas e as fontes.
6. **Contracapa** (coral): o chapéu da Roomi e o lockup.

Cada sigla é explicada uma vez, numa faixa "Siglas" no pé da folha em que ela aparece pela primeira vez, depois do trecho em que aparece. A faixa traz a sigla por extenso e uma frase curta:

- capa: UH e TIR;
- folha 2: VPL e EBITDA;
- folha 3: RevPAR, TRevPAR, GOP e A&B;
- folha 4: p.p.;
- folha 5: FF&E, JLL, HVS, IPTU e as fontes (FOHB, ABIH-SP, CUB, Sinduscon-SP e SINAPI).

Termos em inglês que não são siglas (payback, cap rate, yield on cost) ficam de fora. O relatório do Maker e o da LP usam as mesmas folhas, então os dois mostram a faixa.

A imagem do hotel não é a tela. O mapa atual é montado numa cena à parte, sem animação e sem a câmera de quem está usando, e fotografado de frente, pela chegada (`FrontPhoto` em `src/three/Thumbs.tsx`).

### Modelo de negócios (`src/lib/business.ts`)

- **Receita total**: hospedagem mais outras receitas da categoria. Outras receitas são A&B, eventos e spa: +5% no econômico, +40% no upscale e +75% a +80% em resort e luxo. No all inclusive é +15%, porque a comida já está no pacote. Elas acompanham a ocupação, não a diária.
- **Custos**: dimensionados pela operação de referência do hotel (a diária estimada e a ocupação da categoria), 60% fixos e o resto por diária vendida, com a margem GOP da categoria (32% a 38%) nessa referência. Assim, a diária e a ocupação esperadas mexem na margem e na ocupação de equilíbrio (antes os custos cresciam junto com a diária digitada, e a margem nunca mudava). Na JLL, resorts brasileiros ficaram entre 30% (2023) e 43,5% (2024).
- **EBITDA**: GOP menos a taxa de administração (4% da receita e 10% do GOP; HVS: 4–5% e 10–15%) e IPTU e seguros (2% da receita de referência).
- **Caixa da operação**: EBITDA menos a reserva de FF&E (4% da receita), que fica abaixo do EBITDA. É ele que entra no payback, na TIR, no yield on cost e no valor do ativo.
- **Rampa**: a ocupação é 75% da estabilizada no ano 1 e 90% no ano 2, e estabiliza no ano 3.
- **TIR e VPL**:
  - o investimento entra todo no ano 0, sem o prazo da obra;
  - o caixa da operação entra nos anos 1 a 10;
  - a venda no ano 10 é pelo cap rate de 10%, menos 2%. Negócios recentes no Brasil ficaram entre 8,8% e 12%;
  - a TIR é achada por bisseção com teto que sobe até o VPL trocar de sinal (TIR alta não vira mais "não se paga");
  - o VPL usa 12% ao ano real;
  - valores reais, sem inflação, sem terreno, sem financiamento e antes de impostos.
- **A manchete da folha 2** diz quando a venda no ano 10 é o que fecha a conta (o caixa da operação sozinho não paga a obra em 10 anos).
- **A diária não digitada é estimada** (categoria × mix × lazer) e aparece assim, não como "de mercado". Na tabela das categorias, cada uma recebe o mesmo mix e lazer do hotel.
- **Faixas** (`INCERTEZA` em `business.ts`): o modelo roda no cenário central e com cada incerteza sozinha, no lado ruim e no bom. Cada medida combina os empurrões pela raiz da soma dos quadrados. As incertezas:
  - obra: 8% abaixo a 15% acima;
  - diária estimada: 8% para cada lado;
  - ocupação estimada: 4 p.p.;
  - margem: 2 p.p.;
  - receitas extras: 10%;
  - cap rate: 0,5 p.p.

  A diária e a ocupação digitadas não variam.
- **Empregos diretos**: UHs × índice da categoria. A ABIH-SP mede 0,58 por UH na hotelaria paulista; a Resorts Brasil, cerca de 1,4 por quarto em resorts.

### Como calculamos

O botão "Como calculamos" (na barra do questionário, no checklist e no relatório) explica cada passo com os números do hotel atual: custo de obra, categoria, diária e ocupação, receitas, GOP e EBITDA, investimento, retorno e valor, ocupação de equilíbrio e sensibilidade.

## Posicionamento automático (`src/lib/autoplace.ts`)

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
- O ponto de partida de cada construção é a célula logo à frente da fachada principal. Quando o ponto de partida de um item novo fica a 3–7 blocos do de outro, ou de um caminho existente, o caminho é construído.
- Alguns itens têm leitura própria:
  - os caminhos ligam todos os acessos;
  - a via vai da recepção até a divisa sul;
  - a cerca viva contorna o estacionamento e a cerca contorna as quadras;
  - o muro protege a ala de luxo e o deck contorna a piscina;
  - postes, balizadores e bancos acompanham os caminhos;
  - árvores, palmeiras e canteiros ficam junto aos caminhos e prédios.

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

A imagem de cada modelo é fotografada do próprio layout 3D, de frente como o board abre. Os modelos paramétricos preenchem o questionário e são gerados pelo mesmo programa (`src/data/models.ts`).

## Controles

- Clique numa lateral do board para girá-lo 90°; a roda do mouse aproxima ou afasta.
- `Esc` fecha a janela aberta.
- O logo na barra superior volta à LP. "Começar meu projeto", na LP, abre sempre o board vazio.
- O tema padrão é o claro. O botão de sol/lua alterna, e a escolha fica salva no navegador.

## Esboços

- **Salvar esboço** (com borda coral, para chamar a atenção) baixa um arquivo `<nome-do-projeto>.roomi.json`. Ele traz o nome do projeto, a lista de itens (id do catálogo, célula e rotação), as respostas do questionário e as do checklist.
- Com respostas que ainda não estão num esboço, um aviso pede para salvar antes de sair: ao clicar no logo para voltar à LP e ao trocar de aba (o aviso fica esperando a volta). As opções são "Agora não" (não pergunta de novo até o projeto mudar), "Salvar" e "Não mostrar novamente" (guardado no navegador). Fechando ou recarregando a aba, o próprio navegador pergunta.
- **Abrir** carrega esse arquivo e reconstrói o resort com a animação de obra. Arquivos salvos com os nomes anteriores também abrem, e um orçamento salvo como valor vira a faixa em que ele cai.
- Itens fora do catálogo, fora do terreno, sobrepostos ou malformados ficam de fora, e o aviso diz quantos.

## Caminhos, cercas e mobiliário

- Caminho de pedra, calçada, via interna, cerca de madeira, cerca viva e muro são trechos de 5 m que se ligam aos vizinhos iguais. Lado a lado, eles formam linhas contínuas com curvas, tês e cruzamentos (`src/three/landscape.tsx`).
- Também há deck, poste, balizador, banco, espreguiçadeiras, fogueira, pergolado, gazebo, chafariz, redário, árvore, canteiro e guarita.
- Esses itens entram no custo de obra (valores estimados), mas não contam como amenidade na diária.
