# Link bio — Franciele Bill

## No ar

| endereço | o que é |
|---|---|
| **franciele-bill-linkbio.vercel.app** | o link bio — é este que vai na bio do Instagram |
| franciele-bill-linkbio.vercel.app/trabalhos.html | a galeria |
| **franciele-bill-linkbio.vercel.app/painel.html** | o editor |

O editor mostra a **versão** no canto superior esquerdo. Se o carimbo não bater
com o do editor no ar, o arquivo aberto é uma cópia velha — baixar duas vezes
gera `painel (1).html` e o nome original continua apontando para a antiga.

O editor tem `noindex`, então não aparece em busca. Mas o endereço é adivinhável
— quem abrir só vê a ferramenta, que não guarda nada e não publica nada sozinha.

Projeto `franciele-bill-linkbio` na Vercel — separado do `diogo-reposit-rio`,
que é o dashboard Next.js da Marktiva e não pode receber HTML solto.

Para republicar depois de mexer nos arquivos:

```bash
export VERCEL_TOKEN='...'
export VERCEL_TEAM_ID='team_V6eUe4eJiOtewqzI987DOXhF'

node scripts/publicar-vercel.mjs franciele-bill-linkbio \
  linkbio-franciele/index.html:index.html \
  linkbio-franciele/trabalhos.html:trabalhos.html \
  linkbio-franciele/painel.html:painel.html --producao
```

O sufixo `:index.html` renomeia no destino. Sem ele a página responderia num
endereço com o nome do arquivo local, e o botão entre as páginas quebraria.

## Os arquivos

```
index.html      tela inicial — cabe inteira sem rolar
trabalhos.html  galeria — rola, fotos únicas, duas por linha
painel.html     o editor
```

`index.html` e `trabalhos.html` precisam ficar **na mesma pasta**: o botão da
tela inicial procura `trabalhos.html` ao lado dele.

## O editor

Não é formulário. É **a própria página, editável**: ela aparece em tamanho de
celular e cada foto e cada texto que dá para trocar fica com contorno dourado
ao passar o dedo ou o mouse.

- **Foto** → abre o seletor de arquivo
- **Texto** → abre uma caixinha para escrever
- **Galeria** → cada foto tem × para remover, e há um bloco “+ foto” no fim

São 5 fotos e 6 textos na tela inicial, mais a galeria inteira.

Ao lado ficam o estilo de arte, os links e o pixel — coisas que não dá para
clicar na página porque não aparecem nela.

O editor **carrega os modelos baixados do site publicado**, então o que você
edita é exatamente o que está no ar.

### Por que ele não publica sozinho

Para publicar direto, o token da Vercel teria que estar dentro dele. Como o
editor fica numa página pública, qualquer pessoa leria o token no código-fonte
e ganharia poder de criar, alterar e apagar deploys da conta inteira.

Dá para resolver com uma função no servidor que guarde o token como variável de
ambiente, protegida por senha. Enquanto isso não existe, o caminho é baixar os
dois arquivos e publicar pela linha de comando.

## A tela inicial

Sem rolagem: nome, **um antes e depois arrastável**, “+9 mil rostos
transformados”, **duas fotos**, o botão “Clique e veja mais resultados” e os
três contatos.

## A página de trabalhos

Rola de propósito. Fotos únicas, **sempre duas por linha**.

**O voltar é um link comum para a tela inicial.** Já usei o histórico do
navegador aqui, para preservar a rolagem — mas o histórico tem entradas que a
página não controla, e em navegador de dentro de aplicativo o passo anterior
pode ser qualquer coisa. Destino previsível vale mais que rolagem preservada.

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
`<head>`. Pelo editor isso é automático — ele mantém os dois em sincronia e
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

**Antes e depois usam sempre o mesmo tratamento de arte.** O editor não deixa
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
