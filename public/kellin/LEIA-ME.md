# Página de vendas — Kellin Obana

Um arquivo só: `index.html`. Todo o CSS e o JavaScript estão dentro dele, sem
nenhuma biblioteca externa. Funciona hospedado ou aberto direto no navegador.

## O que colocar nesta pasta

| Arquivo          | Obrigatório | O que é                                                        |
| ---------------- | ----------- | -------------------------------------------------------------- |
| `video.mp4`      | sim         | O vídeo, gravado em 9:16 (vertical). MP4/H.264 com áudio AAC.   |
| `capa.jpg`       | não         | Primeiro quadro do vídeo. Aparece enquanto o vídeo carrega.     |
| `kellin.jpg`     | não         | Foto da Kellin, quadrada. Sem ela, entra o monograma dourado.   |
| `ademicon.png`   | não         | Logo da Ademicon, de preferência PNG com fundo transparente.    |

As três opcionais somem sozinhas se o arquivo não existir — a página não quebra.
Se o `video.mp4` faltar, a moldura mostra um aviso dizendo isso.

## O que precisa ser trocado antes de publicar

Abra o `index.html`, procure por `var CONFIG` (perto do fim do arquivo) e ajuste:

```js
var CONFIG = {
  whatsapp: "5544999999999",   // 55 + DDD + número, só dígitos
  mensagem: "Oi Kellin! ...",  // mensagem que já vem digitada
  segundos: 15,                // tempo que o botão fica travado
  rotuloLivre: "FALAR COM A KELLIN"
};
```

**O número acima é um exemplo.** Troque pelo WhatsApp real da Kellin, senão o
botão leva a lugar nenhum.

## Como a página se comporta

- Assim que abre, o vídeo roda mudo em laço atrás de uma capa escura.
- O primeiro toque reinicia o vídeo do zero, com som, e some com a capa.
- A partir daí, o botão do WhatsApp começa a carregar: uma barra cresce por
  dentro dele durante 15 segundos, com o contador na linha de baixo.
- Antes de completar, o botão está na tela mas não clica — se tocarem nele, ele
  só balança. Depois de completar, ele vira verde, brilha e abre a conversa.
- O tempo só corre com o vídeo tocando, e só é contado depois do toque.
- Não dá para pular o vídeo (sem controles, sem avançar, sem teclado), nem para
  rolar, arrastar ou dar zoom na página.

## Onde ela fica no ar

Hospedada por este projeto (Next.js), o endereço é:

```
https://SEU-DOMINIO/kellin/index.html
```

A rota `/kellin` é pública: o `src/middleware.ts` libera essa pasta do login do
painel. Para usar em qualquer outro lugar (Hostinger, Netlify, um HD), é só
copiar a pasta inteira — não depende de nada do resto do repositório.
