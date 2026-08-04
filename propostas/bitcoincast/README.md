# Proposta BITCOINCAST × Marktiva

Landing page de apresentação da proposta comercial. Feita para ser exibida em TV
(cada seção ocupa exatamente uma tela de 1920×1080) e também publicada como site.

## Como abrir

`index.html` é um arquivo único e autossuficiente — sem build, sem dependências,
sem CDN. Basta abrir no navegador ou subir em qualquer hospedagem estática.
As três fontes (Anton, Archivo, IBM Plex Mono) vão embutidas em base64, então o
tipo nunca cai para uma fonte de sistema no meio da apresentação.

## Fotos dos apresentadores

O hero espera dois arquivos:

    img/josimar.jpg
    img/gabriel.jpg

Enquanto os arquivos não estiverem lá, o hero mostra a inicial de cada um num
disco dourado — a página continua apresentável. Assim que os arquivos entrarem,
as fotos aparecem no lugar, já tratadas em preto e branco com veladura dourada
para casar com a paleta. Recomendado: quadradas, no mínimo 400×400.

## Estrutura das 13 telas

| # | Tela | Papel |
|---|------|-------|
| 00 | Hero — "Bitcoin não é investimento" | Tese e ficha técnica |
| 01 | O recado | Sinal de alerta × nossa posição |
| 02 | Por que agora | Painel de mercado |
| 03 | O método | Topo, autoridade, conversão |
| 04 | O fluxo | Diagrama da operação inteira |
| 05 | A máquina de conteúdo | 1 gravação → dezenas de peças |
| 06 | Dois canais | Marca × pessoa |
| 07 | Estrutura de perfil | Anatomia do perfil otimizado |
| 08 | Ritmo e operação | Quinzenal, tráfego, blindagem |
| 09 | O que entra todo mês | Lista de entregáveis |
| 10 | O cenário de hoje | R$ 13 mil fragmentado |
| 11 | O investimento | Âncora de 15 → oferta de 13 |
| 12 | Fecho | Assinatura conjunta |

## Decisões que não devem ser desfeitas

- **O preço só aparece na tela 11.** Toda a página antes disso constrói valor.
- **Nenhuma promessa financeira.** As mini-promessas são de processo e entrega
  (presença, autoridade, base, padrão de produção). A tela 01 assume isso como
  posicionamento e a tela 08 registra a cláusula de blindagem em contrato.
- **O painel de mercado é cenografia**, e está rotulado como dado ilustrativo na
  própria tela. Não é cotação ao vivo e não deve ser apresentado como tal.
- **Entrelinha mínima de 1.15 nos títulos.** Abaixo disso o til de "NÃO" e o
  agudo de "É" somem atrás da linha de cima — justamente na frase principal.

## Animações

A moeda é um cilindro 3D em CSS (44 faces na borda serrilhada, duas faces em
SVG), numa camada fixa. Ela gira continuamente, acelera conforme a velocidade da
rolagem e é reposicionada por seção via os atributos `data-coin="x,y,escala,opacidade"`
de cada `<section class="screen">` — é ali que se ajusta onde a moeda aparece.

Fundo de candles em canvas, fita de cotação, contadores, barras e o traçado do
diagrama respeitam `prefers-reduced-motion`.
