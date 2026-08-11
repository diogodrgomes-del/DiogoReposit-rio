# Link bio — Franciele Bill

São **duas páginas**, e as duas precisam ficar **na mesma pasta**:

```
index.html      tela inicial — cabe inteira sem rolar
trabalhos.html  portfólio — rola, com todos os antes e depois
montar.html     o estúdio: solte as fotos, ele gera os dois arquivos
```

O botão “Clique e veja meus trabalhos” procura `trabalhos.html` ao lado dele.
Separados, o botão não acha nada.

## A tela inicial

Sem rolagem, nesta ordem: nome, **um antes e depois grande e arrastável**,
“+9 mil rostos transformados”, **três fotos pequenas**, o botão
“Clique e veja mais resultados” e os três contatos.

O cartão grande desliza sozinho uma vez, para revelar o resultado e ensinar o
gesto. Qualquer toque interrompe.

As três fotos pequenas são **resultados soltos, não comparações**: em 60px de
largura um antes/depois não mostraria transformação nenhuma. Tocar nelas leva
à mesma página do botão — quem toca numa foto espera que ela abra algo.

## A página de trabalhos

Rola de propósito — é o portfólio. Aceita quantos pares você quiser. Cada
cartão só começa a animar **quando entra na tela**: animar o que está fora da
vista gastaria quadro à toa e o visitante perderia o gesto sendo ensinado.

O botão do WhatsApp fica fixo no rodapé, sempre alcançável.

## Como montar

1. Abra o **`montar.html`** com dois cliques.
2. Solte o **retrato** dela (vira a faixa do topo).
3. Preencha o **par** da tela inicial (antes e depois).
4. Solte as **três fotos pequenas**.
5. Adicione quantos pares quiser na **página de trabalhos**.
6. Escolha o estilo de arte, confira os links.
7. Baixe **os dois arquivos** e ponha na mesma pasta.

As fotos de sobrancelha costumam estar deitadas — use **girar** até ficarem na
horizontal e **◂ ▸** para enquadrar.

Cada par precisa da **mesma pessoa e do mesmo enquadramento** nas duas fotos.
Sem isso a comparação não se sustenta.

## Pixel da Meta

Já vem **ligado**, com o ID `2127826514818630`. Inclui o `<noscript>` do snippet
oficial, que recupera o PageView de quem navega sem JavaScript.

| ação | evento |
|---|---|
| abrir a página | `PageView` |
| **clicar no WhatsApp** | `Contact` |
| clicar em Como chegar | `CliqueComoChegar` (personalizado) |
| clicar no Instagram | `CliqueInstagram` (personalizado) |
| botão ou miniatura de resultados | `VerTrabalhos` (personalizado) |

`Contact` é o evento **padrão** da Meta para início de conversa por telefone,
chat ou mensagem — no Gerenciador ele aparece em português como **"Contato"**.
Por ser padrão, dá para usar direto como objetivo de campanha. Se o seu
Gerenciador esperar outro nome, mude num lugar só:

```js
var EVENTO_CONVERSA = 'Contact';
```

O ID mora em **dois lugares**: a constante `PIXEL_META` e o `<noscript>` do
`<head>`. Pelo estúdio isso é automático — ele mantém os dois em sincronia e
apaga o `<noscript>` inteiro quando o campo fica vazio.

Editando na mão, troque **os dois**. Mexer só num deixa o outro chamando o
pixel antigo, ou rastreando depois de você achar que desligou.

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

**A tela inicial leva um par e três miniaturas.** Foi medido: com o cartão
grande no tamanho atual, é o que cabe sem empurrar os botões para fora. O resto
vai para `trabalhos.html`, que rola.

**Par sem foto não vira ícone quebrado.** Fica o degradê da marca com um
recado discreto, e o cartão continua no lugar.

**A mensagem do WhatsApp escapa `!`, `'`, `(`, `)` e `*`.** São legais em URL,
mas vários apps encerram o link automático no `!` e cortariam a mensagem pronta
pela metade.

**As fontes estão embutidas nas duas páginas** (Cormorant Garamond + Jost,
recortadas só nos caracteres usados: 59 KB). Fora o pixel, nenhuma das duas
faz requisição externa.

**Tudo escala a partir de um número só.** O `font-size` do `.palco` é
`clamp(10px, min(2.05vh, 4.3vw), 18px)` — o menor entre altura e largura da tela.
Todo o resto está em `em`. É isso que faz caber sem rolar do iPhone SE ao Pro Max
sem uma media query por modelo.

**Testado em 15 telas**, todas cabendo sem rolagem — incluindo o navegador de
dentro do Instagram, celular deitado e o dobrável fechado.
