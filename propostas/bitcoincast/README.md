# Proposta BITCOINCAST × Marktiva

Landing page de apresentação da proposta comercial. Feita para ser exibida em TV
(cada seção ocupa uma tela de 1920×1080) e também publicada como site.

Cliente: Josimar Gomes e Gabriel, do podcast Bitcoincast. O produto deles é
conhecimento, curso de DeFi e autocustódia, não rendimento.

## Duas versões

| Arquivo | Telas | Para quê |
|---|---|---|
| `index.html` | 9 | **A de apresentar.** Enxuta, para rodar na TV na frente do cliente |
| `completa.html` | 13 | A longa, para mandar por link depois da reunião ou anexar ao contrato |

As duas dizem a mesma coisa e carregam os mesmos números. A enxuta funde
"por que agora" dentro do recado, junta a máquina de conteúdo com os dois
canais, junta ritmo com estrutura comercial, e transforma o comparativo
"hoje espalhado × Marktiva" numa coluna dentro da operação em vez de uma tela
inteira. O texto de cada tela também é mais curto.

Se um número mudar, ele muda nas duas.

## Como abrir

Cada arquivo é único e autossuficiente. Sem build, sem dependências,
sem CDN. Basta abrir no navegador ou subir em qualquer hospedagem estática.
As três fontes (Anton, Archivo, IBM Plex Mono) vão embutidas em base64, então o
tipo nunca cai para uma fonte de sistema no meio da apresentação.

## Fotos dos apresentadores

O hero espera dois arquivos:

    img/josimar.jpg
    img/gabriel.jpg

Enquanto os arquivos não estiverem lá, o hero mostra a inicial de cada um num
disco dourado e a página continua apresentável. Assim que os arquivos entrarem,
as fotos aparecem no lugar, já tratadas em preto e branco com veladura dourada
para casar com a paleta. Recomendado: quadradas, no mínimo 400×400.

## As 9 telas da versão de apresentação

| # | Tela | Papel |
|---|------|-------|
| 00 | Hero, "Bitcoin não é investimento" | Tese e ficha técnica |
| 01 | O recado | Quem fala mal ouviu explicando mal, com faixa de mercado |
| 02 | O método | Atrair, aprofundar, presentear, convidar |
| 03 | O fluxo | Duas frentes que convergem numa venda |
| 04 | A entrega | Dois dias de gravação, os dois canais, as plataformas |
| 05 | Estrutura de perfil | Dois perfis distintos, lado a lado |
| 06 | A operação | Calendário, tráfego e estrutura comercial |
| 07 | O investimento | Âncora de 17.200, fechamento em 14.489,90 |
| 08 | Fecho | Bora pra cima |

A `completa.html` abre estas em 13, separando "por que agora", "a máquina de
conteúdo", "os dois canais", "além do conteúdo" e "o cenário de hoje".

## Números que a página afirma

Alterar em um lugar significa alterar em todos, nas duas versões. Eles aparecem
no hero, no fluxo, na entrega e nos dois canais.

- 4 podcasts por mês, 2 a cada quinzena, gravados na mesma noite
- 8 a 10 cortes por episódio
- 40 a 50 conteúdos de feed por mês, entre vídeo e post
- No mínimo 15 vídeos por quinzena para reels, fora o material de tráfego
- Gravação de conteúdo a cada 15 a 20 dias
- 6 plataformas: Instagram, Facebook, TikTok, YouTube, YouTube Shorts e Kwai.
  LinkedIn fica marcado como opcional
- Deslocamento incluso em até 60 km de Londrina
- R$ 17.200 de âncora, R$ 14.489,90 de fechamento, contrato de 6 meses

## Decisões que não devem ser desfeitas

- **O preço só aparece na penúltima tela.** Tudo antes disso constrói valor, e
  a própria tela lista o que está sendo levado antes de mostrar o número.
- **Nenhuma promessa financeira.** As promessas são de processo e entrega:
  presença, autoridade, base e padrão de produção.
- **Sem cláusula de blindagem na página.** Ela saiu a pedido do cliente, para
  ser tratada na conversa depois do preço. Continua valendo em contrato.
- **O painel de mercado é cenografia**, e está rotulado como dado ilustrativo na
  própria tela. Não é cotação ao vivo e não deve ser apresentado como tal.
- **Nada de hífen ou travessão ligando oração.** A página usa vírgula ou ponto.
- **Entrelinha mínima de 1.15 nos títulos.** Abaixo disso o til de "NÃO" e o
  agudo de "É" somem atrás da linha de cima, justamente na frase principal.

## A moeda

A moeda é desenhada num **único canvas 2D**, por projeção, não por CSS 3D.

Um disco de diâmetro D e espessura T girado de θ em torno do eixo vertical
projeta duas elipses de semieixos (R·|cos θ|, R) separadas por T·|sen θ| na
horizontal. O contorno da moeda é o fecho convexo dessas duas elipses, e a
borda serrilhada é exatamente a meia-lua que sobra quando a face da frente é
desenhada por cima. As ranhuras ficam em y = −R·cos φ, o que as adensa perto do
topo e da base e é o que dá a leitura de cilindro.

Duas tentativas anteriores foram descartadas e vale registrar por quê:

1. **Borda em CSS 3D girando no eixo Y.** Montava um cilindro deitado, e o
   resultado parecia uma fita atravessando um anel em vez de uma moeda.
2. **Faces em SVG dentro de um contexto preserve-3d.** Como a escala da moeda
   muda a cada quadro, o navegador re-rasterizava o SVG inteiro 60 vezes por
   segundo. Só isso derrubava a página de 61 para 30 quadros.

A face é desenhada uma única vez em bitmap, depois do `document.fonts.ready`.
Cada quadro custa um preenchimento, as ranhuras e um `drawImage`.

Onde a moeda aparece em cada tela é o atributo `data-coin="x,y,escala,opacidade"`
de cada `<section class="screen">`, em porcentagem da viewport. É ali que se
ajusta a posição, e a regra é simples: ela nunca deve cair sobre texto.

## Animações

Fundo de candles em canvas a meia taxa de quadros, fita de cotação, contadores,
e o traçado do diagrama de fluxo. Tudo respeita `prefers-reduced-motion`.

A rotação da moeda acelera com a velocidade da rolagem, mas a velocidade passa
por dois amortecimentos antes de virar giro, para nunca dar solavanco.
