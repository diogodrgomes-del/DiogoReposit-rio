# Link bio — Franciele Bill

São **duas páginas**, e as duas precisam ficar **na mesma pasta**:

```
index.html      tela inicial — cabe inteira sem rolar
trabalhos.html  portfólio — rola, com todas as fotos de trabalho
montar.html     o estúdio: solte as fotos, ele gera os dois arquivos
```

O botão “Clique e veja mais resultados” procura `trabalhos.html` ao lado dele.
Separados, o botão não acha nada.

## A tela inicial

Sem rolagem, nesta ordem: nome, **um antes e depois arrastável**,
“+9 mil rostos transformados”, **duas fotos pequenas**, o botão
“Clique e veja mais resultados” e os três contatos.

A comparação do topo desliza sozinha uma vez, para revelar o resultado e
ensinar o gesto. Qualquer toque interrompe.

As duas fotos de baixo são **imagens únicas**, sem comparação. Tocar nelas leva
à mesma página do botão — quem toca numa foto espera que ela abra algo.

## A página de trabalhos

Rola de propósito — é o portfólio. **Sem comparação nenhuma**: são fotos
únicas, que é o que você anexa. Aceita quantas quiser, **sempre duas por
linha**. As quatro primeiras chegam junto com a página; o resto carrega quando
o visitante se aproxima.

O botão do WhatsApp fica fixo no rodapé, sempre alcançável.

**O botão voltar desfaz o passo** em vez de recarregar a tela inicial: assim a
página anterior volta como estava, com a rolagem no lugar. Se alguém abrir
`trabalhos.html` direto, sem histórico, o link normal assume.

## Como montar

1. Abra o **`montar.html`** com dois cliques.
2. Solte o **retrato** dela (vira a faixa do topo).
3. Preencha o **antes e depois** do topo.
4. Solte as **duas fotos pequenas**.
5. Adicione quantas fotos quiser na **página de trabalhos**.
6. Escolha o estilo de arte, confira os links.
7. Baixe **os dois arquivos** e ponha na mesma pasta.

As fotos de sobrancelha costumam estar deitadas — use **girar** até ficarem na
horizontal e **◂ ▸** para enquadrar.

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

## Assinatura da Marktiva

Discreta no rodapé das **duas páginas**, levando a
`instagram.com/agenciamarktiva`. Sem os parâmetros `utm_source` e `igsh` que
vêm do botão de compartilhar do Instagram — são lixo de sessão, não servem
para nada num link fixo.

Contraste de 3,2:1 contra o fundo: discreta, mas ainda legível. Abaixo disso
vira decoração que ninguém consegue ler.

A área de toque é **maior que o texto** — 26px na tela inicial, 43px no
portfólio — esticada por um pseudo-elemento que não ocupa espaço no layout.
Sem isso o alvo teria 9px de altura e ninguém acertaria no dedo.

## Decisões que valem saber

**Duas fotos por linha, nunca três.** Com três, cada uma cai para uns 100px de
largura e o trabalho deixa de ser legível — que é justamente o motivo de a
foto estar ali. Vale na tira da tela inicial e na galeria.

**A comparação existe só na tela inicial.** Na galeria seriam dezenas de
divisórias competindo entre si; e em duas colunas cada lado teria uns 80px,
onde não se enxerga transformação alguma.

**Antes e depois usam sempre o mesmo tratamento de arte.** O estúdio não deixa
filtrar só o "depois" — seria propaganda enganosa.

**O tratamento de arte vale para todas as fotos.** Um único estilo e uma única
intensidade para o conjunto inteiro: fotos do mesmo perfil com graduações
diferentes parecem de estúdios diferentes.

**Foto que falta não vira ícone quebrado.** Fica o degradê da marca no lugar,
e o espaço continua ocupado — o layout não se mexe.

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
