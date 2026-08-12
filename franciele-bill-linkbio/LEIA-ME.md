# Site da Franciele Bill + Estúdio

Pasta independente. Não tem nada a ver com o resto do repositório: nenhum arquivo
aqui é importado por outro projeto, e nenhum outro projeto foi tocado.

```
franciele-bill-linkbio/
├── index.html      cópia exata do site que está no ar
├── trabalhos.html  cópia exata da página de resultados
└── painel.html     o estúdio: adiciona fotos, muda textos e exporta
```

`index.html` e `trabalhos.html` são **byte a byte** iguais aos arquivos publicados
em franciele-bill-linkbio.vercel.app. Nada foi alterado neles.

---

## Como usar o painel

1. Abra `painel.html` **na mesma pasta** dos outros dois arquivos.
   O jeito mais fácil é publicar a pasta e abrir `.../painel.html` pelo navegador.
   Se abrir com dois cliques direto do computador, ele vai pedir para você
   selecionar o `index.html` e o `trabalhos.html` — escolha os dois juntos.
2. Toque em cada quadro para escolher a foto. O painel corta o tamanho,
   converte para JPEG e já mostra na prévia do lado.
3. Mexa nos textos que quiser. O que você não encostar continua igual.
4. Clique em **Baixar site completo (.zip)**.
5. Descompacte e suba a pasta inteira para a Vercel (arrastar e soltar já resolve).

O painel guarda um rascunho no próprio navegador, então dá para fechar e voltar
depois. Para levar o trabalho para outro computador, use **Salvar backup**.

---

## As fotos

| Arquivo | Onde aparece |
|---|---|
| `franciele.jpg` | retrato de fundo, atrás do nome |
| `antes.jpg` / `depois.jpg` | comparação arrastável do topo |
| `mini-1.jpg` / `mini-2.jpg` | as duas fotinhas abaixo do número |
| `trabalho-N.jpg` | galeria da segunda página, quantas quiser |

Hoje **nenhuma dessas fotos está no servidor** — todas dão 404. É por isso que o
site aparece com os degradês no lugar delas. Assim que você exportar pelo painel
com as fotos escolhidas, elas aparecem.

Foto que você não escolher no painel não entra no zip: o arquivo com aquele nome
precisa continuar na pasta do site. O painel marca cada uma como `nova` ou
`sem foto` na lista de exportação.

---

## Links: nada muda sozinho

Os links ficam **travados** no painel. Enquanto você não destravar e editar,
o arquivo exportado sai com exatamente os mesmos endereços de hoje:

- WhatsApp `https://wa.me/5543991047801?text=Oii%21%20Vim%20pelo%20Instagram%21`
- Maps `https://share.google/dgnZltVE6saBeQVc1`
- Instagram `https://www.instagram.com/francielebill/`
- Assinatura `https://www.instagram.com/agenciamarktiva`
- Pixel da Meta `2127826514818630`

O painel nunca reescreve a página inteira: ele troca só os pedaços que você
editou. Exportar sem mexer em nada devolve os arquivos idênticos aos originais —
isso foi conferido byte a byte.

## Ida e volta entre as páginas

O botão **Clique e veja mais resultados** leva para `trabalhos.html`, e a **seta
no canto superior esquerdo** volta para `index.html`, a tela principal. O botão
voltar do celular faz a mesma coisa. Isso continua funcionando depois de exportar.

## Sobre publicar o painel junto

`painel.html` não vai no zip e fica só aqui no repositório. Se você quiser subir
ele junto com o site, pode: ele só lê e exporta arquivos dentro do seu próprio
navegador, não tem senha nem acesso ao servidor. Já vai marcado como `noindex`
para não aparecer no Google.
