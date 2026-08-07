# Link bio — Franciele Bill

Mini landing page de **uma tela só**. Tudo aparece sem rolar e sem abrir nada por
cima: nome, autoridade, antes/depois, trabalhos e os três botões.

```
index-com-suas-fotos.html  ← PRONTO PARA PUBLICAR. Já tem suas fotos dentro.
montar.html                ← o estúdio: solte fotos, escolha o estilo, baixe o index
index.html                 ← o modelo limpo, sem fotos
```

## Publicar agora

Pegue o **`index-com-suas-fotos.html`**, renomeie para `index.html` e suba.
Vercel, Netlify, Hostinger — qualquer uma. É um arquivo só, sem pasta e sem
dependência externa.

Só falta **a foto dela**: entre no `montar.html`, solte o retrato, e baixe de novo.

---

## Os três links (já configurados)

| botão | destino |
|---|---|
| Agendar no WhatsApp | `wa.me/5543991047801` com "Oii! Vim pelo Instagram!" |
| Como chegar | `share.google/dgnZltVE6saBeQVc1` |
| Instagram | `instagram.com/francielebill` |

Sem endereço, sem @ e sem "resposta rápida" embaixo — só os três rótulos.

---

## Como o fundo funciona

A foto dela ocupa a **faixa de cima** (58% da altura) e termina em **degradê**,
dissolvendo na cor sólida que preenche o resto da tela. Não é mais fundo de tela
cheia, e não existe mais nenhuma camada dela sobre o antes/depois — eram esses
dois pontos que atrapalhavam a comparação.

Se o retrato não estiver embutido, entra um degradê taupe/dourado no lugar e a
página continua inteira.

---

## Decisões que valem saber

**Antes e depois usam sempre o mesmo tratamento de arte.** O estúdio não deixa
filtrar só o "depois". Antes/depois é promessa de resultado — se o depois ganha
brilho que o antes não tem, vira propaganda enganosa. Os dois andam travados
em par, de propósito.

**Os trabalhos entram numa fileira única, no máximo 6.** Acima disso as
miniaturas ficariam estreitas demais para mostrar trabalho nenhum, e um sétimo
item criaria uma segunda fileira que estoura a altura da tela.

**Selo vazio some por completo.** Se você limpar o campo do selo no estúdio, a
pílula dourada desaparece em vez de virar um caroço com só o losango dentro.

**A mensagem do WhatsApp escapa `!`, `'`, `(`, `)` e `*`.** São legais em URL,
mas vários apps encerram o link automático no `!` e cortariam a mensagem pronta
pela metade.

**As fontes estão embutidas** (Cormorant Garamond + Jost, recortadas só nos
caracteres usados: 59 KB). A página não faz **nenhuma** requisição externa.

**Tudo escala a partir de um número só.** O `font-size` do `.palco` é
`clamp(10px, min(2.05vh, 4.3vw), 18px)` — o menor entre altura e largura da tela.
Todo o resto está em `em`. É isso que faz caber sem rolar do iPhone SE ao Pro Max
sem uma media query por modelo.

**Testado em 15 telas**, todas cabendo sem rolagem — incluindo o navegador de
dentro do Instagram, celular deitado e o dobrável fechado.
