# Link bio — Franciele Bill

Mini landing page de uma tela só para a bio do Instagram. Tudo aparece sem rolar:
nome, autoridade, antes/depois, trabalhos, WhatsApp, Maps e Instagram.

```
montar.html   ← abra este. É o estúdio: você solta as fotos e ele gera o index.html
index.html    ← a página em si. Sai pronta do estúdio, ou use direto com arquivos soltos
```

---

## Caminho rápido (recomendado)

1. **Abra o `montar.html`** com dois cliques. Ele roda no seu navegador, sem servidor
   e sem internet. Nenhuma foto sai do seu computador.
2. Solte o **retrato dela**, o **antes** e o **depois**.
   As fotos de sobrancelha estão deitadas — use **girar** até a sobrancelha ficar
   na horizontal, e **◂ ▸** para centralizar o corte.
3. Solte as fotos de **Meus trabalhos** (pode ser várias de uma vez). O nome
   embaixo de cada uma vira a legenda na galeria.
4. Escolha o **estilo de arte** e a intensidade.
5. Preencha **WhatsApp, Instagram e Maps**. O campo do WhatsApp mostra o link
   final montado — confira antes de publicar.
6. **Baixar index.html**.

Sai **um arquivo só**, com fotos e fontes dentro. Sobe em Vercel, Netlify, Hostinger
ou qualquer hospedagem. Sem pasta, sem dependência, sem CDN.

---

## Caminho manual (sem o estúdio)

Use o `index.html` direto e ponha os arquivos na mesma pasta:

| arquivo         | o que é                      |
|-----------------|------------------------------|
| `franciele.jpg` | retrato dela (fundo da tela) |
| `antes.jpg`     | sobrancelha antes            |
| `depois.jpg`    | sobrancelha depois           |
| `trabalho-1.jpg` … `trabalho-6.jpg` | galeria      |

Depois edite dois pontos dentro do `index.html`:

- **Os 3 links** — procure por `[EDITAR 1 de 3]`, `[EDITAR 2 de 3]`, `[EDITAR 3 de 3]`
- **A lista da galeria** — procure por `var TRABALHOS`

Se algum arquivo faltar, a página **não quebra**: entra o fundo dourado/taupe
e a comparação mostra um recado no lugar de um ícone quebrado.

---

## Decisões que valem saber

**Antes e depois usam sempre o mesmo tratamento.** O estúdio não deixa aplicar
filtro em um e não no outro. Antes/depois é promessa de resultado — se o "depois"
ganha brilho que o "antes" não tem, vira propaganda enganosa e queima a
credibilidade dela. Os dois andam travados em par, de propósito.

**A foto dela entra uma vez só no arquivo.** Ela aparece no fundo da tela *e*
emergindo sobre o antes/depois, mas as duas usam a mesma variável CSS
(`--retrato`). Se fossem duas `<img>`, a foto viajaria duas vezes em base64 e o
arquivo engordaria à toa.

**As fontes estão embutidas** (Cormorant Garamond + Jost, recortadas só nos
caracteres usados: 59 KB). A página não faz **nenhuma** requisição externa —
abre instantâneo no 4G e não depende do Google Fonts estar no ar.

**Tudo escala a partir de um número só.** O `font-size` do `.palco` é
`clamp(10px, min(1.98vh, 4.1vw), 17px)` — o menor entre altura e largura da tela.
Todo o resto está em `em`. É isso que faz caber sem rolar do iPhone SE ao Pro Max
sem uma media query por modelo.

**Testado em 15 telas**, todas cabendo sem rolagem — incluindo o navegador de
dentro do Instagram (que come altura), celular deitado e o dobrável fechado.

---

## Ainda falta confirmar

- **O @ do Instagram.** Está `francielebill`, lido da captura de tela. O Instagram
  devolve tela de login para qualquer perfil quando consultado de fora, então não
  consegui confirmar por aqui. Confira antes de publicar.
- **O número do WhatsApp.** Está com um placeholder (`5543999999999`).
- **O link do Google Maps.** Está montado pelo endereço, o que já funciona. Se ela
  tiver ficha no Google Meu Negócio, o link de lá fica melhor.
