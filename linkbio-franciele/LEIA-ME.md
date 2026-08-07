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

## Pixel da Meta

Já vem **ligado**, com o ID `2127826514818630`. Inclui o `<noscript>` do snippet
oficial, que recupera o PageView de quem navega sem JavaScript.

| ação | evento |
|---|---|
| abrir a página | `PageView` |
| **clicar no WhatsApp** | `Contact` |
| clicar em Como chegar | `CliqueComoChegar` (personalizado) |
| clicar no Instagram | `CliqueInstagram` (personalizado) |

`Contact` é o evento **padrão** da Meta para início de conversa por telefone,
chat ou mensagem — no Gerenciador ele aparece em português como **"Contato"**.
Por ser padrão, dá para usar direto como objetivo de campanha. Se o seu
Gerenciador esperar outro nome, mude num lugar só:

```js
var EVENTO_CONVERSA = 'Contact';
```

Para desligar todo o rastreio: apague o ID em `var PIXEL_META = '...'` **e**
remova o bloco `<noscript>` do `<head>`. Sem os dois, um deles continua
chamando a Meta sozinho.

Cada clique gera um `eventID` único. Isso só serve para a API de Conversões
juntar o evento do navegador com o mesmo evento vindo do servidor sem contar
duas vezes — sem ela, é inofensivo.

### Sobre o token da API de Conversões

**O token não está neste repositório, e não deve entrar.** Token de Conversions
API dentro de HTML fica legível em "ver código-fonte", e com ele qualquer pessoa
injeta eventos falsos no pixel e estraga a otimização das campanhas.

O gancho está pronto e vazio:

```js
var CAPI_ENDPOINT = '';   // endereço do SEU servidor, nunca o token
```

Para ligar a API de Conversões é preciso um servidor (função serverless serve)
que guarde o token como variável de ambiente e repasse o evento para a Meta.
O pixel do navegador sozinho **já mede os cliques** — a API de Conversões é o
upgrade que recupera o que iOS e bloqueadores derrubam.

Vale um aviso de cookies/privacidade no site: o pixel rastreia visitante e a
LGPD espera que isso seja informado.

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
