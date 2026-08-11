# Central Norte × Marktiva — Apresentação estratégica

Landing page de apresentação da proposta comercial da **Agência Marktiva** para a
**Clínica Dentária Central Norte** (Londrina/PR).

## Como abrir

Basta abrir o arquivo `index.html` no navegador. Não há backend, banco de dados,
build ou API — são três arquivos estáticos:

```
index.html    estrutura + SVGs das animações odontológicas
style.css     design system, layout e responsividade
script.js     animações, scroll, contadores e interações (sem dependências)
```

## Como publicar

Suba a pasta inteira em qualquer hospedagem estática:

- **Vercel / Netlify** — arraste a pasta na interface, ou aponte o projeto para este diretório.
- **GitHub Pages** — publique a pasta como raiz do site.
- **Hospedagem tradicional (cPanel/FTP)** — envie os três arquivos para a pasta pública.

A única requisição externa é a fonte Inter (Google Fonts). Sem internet, a página
usa a fonte do sistema e continua funcionando normalmente.

## Estrutura da apresentação

A narrativa foi montada para **vender a estratégia antes do preço**. O investimento
só aparece na seção 17, depois de todo o plano:

| # | Seção | Objetivo |
|---|---|---|
| 01 | Hero | Reconhecer a força atual da clínica |
| 02 | Ponto de partida | Mostrar que não se começa do zero |
| 03 | A oportunidade | Hoje × próxima etapa |
| 04 | Mapeamento | Diagnóstico antes de anunciar |
| 05 | Ecossistema | Todas as peças conectadas |
| 06 | Google Ads | Intenção de busca |
| 07 | Meta Ads | Geração de demanda |
| 08 | Conteúdo | Gravações quinzenais |
| 09 | Postagens automáticas | Distribuição programada |
| 10 | Implante (animado) | Campanhas de alto valor |
| 11 | Aparelho (animado) | Alinhamento da operação |
| 12 | O grande diferencial | O trabalho não acaba no lead |
| 13 | Mentoria de atendimento | Aproveitar cada oportunidade |
| 14 | Reuniões estratégicas | Acompanhamento contínuo |
| 15 | Entregas | 20 frentes assumidas pela Marktiva |
| 16 | O que queremos construir | Visão de futuro |
| 17 | Investimento | R$ 4.497,00/mês + ressalva de mídia |
| 18 | Encerramento | Chamada final |

> As seções de painel de dados e de fases (validar/otimizar/escalar) foram
> removidas a pedido do cliente: a operação ainda não tem dashboard nem
> rastreamento definido, então a apresentação não promete o que não pode entregar.

## Modo apresentação

Pensada para ser apresentada ao vivo, não lida:

- **Page Down / seta direita** → avança para a próxima seção
- **Page Up / seta esquerda** → volta uma seção
- **Home / End** → início e fim
- Funciona com apresentadores (clickers) que enviam Page Up/Page Down
- O índice lateral (desktop) permite pular direto para qualquer seção

## Animações

Todas construídas em código, sem imagens de terceiros:

- **Implante dentário** — dente → raiz se dissolve → parafuso desce → pino → coroa encaixa.
  Controlada pelo scroll, com as etapas Atração/Educação/Confiança/Avaliação/Conversão
  acendendo em sincronia.
- **Aparelho ortodôntico** — dentes desalinhados → brackets aparecem → fio atravessa →
  dentes se alinham. Também controlada pelo scroll.
- **Rede de partículas** (hero e encerramento), busca do Google sendo digitada, calendário
  se preenchendo sozinho, conversa de WhatsApp e o contador do preço.

Todo movimento usa `transform`/`opacity`, as animações pausam quando saem da tela e
respeitam `prefers-reduced-motion`.

## Observação comercial

O valor de R$ 4.497,00/mês cobre apenas os serviços da Marktiva. O número aparece
com uma animação que parte de R$ 6.799 e desce até o valor da proposta. O investimento em
mídia paga (Google Ads e Meta Ads) é separado e será definido junto com a clínica —
isso está explicitado na seção 19.
