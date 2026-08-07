# Publicar na Vercel

```bash
export VERCEL_TOKEN='...'                       # nunca commitar
export VERCEL_TEAM_ID='team_V6eUe4eJiOtewqzI987DOXhF'

node scripts/publicar-vercel.mjs <projeto> <arquivo>[:destino] [--producao] [--ensaio]
```

`--ensaio` faz tudo menos publicar: confere o projeto, calcula os hashes e
mostra os avisos. Use sempre antes de subir num projeto que voce nao criou.

## Exemplo — link bio da Franciele

```bash
node scripts/publicar-vercel.mjs franciele-bill-linkbio \
  linkbio-franciele/index-com-suas-fotos.html:index.html --producao
```

O sufixo `:index.html` renomeia o arquivo no destino — sem ele a pagina
responderia em `/index-com-suas-fotos.html` em vez da raiz.

## Cuidado com o projeto errado

O projeto **`diogo-reposit-rio`** ja existe na conta e **e o dashboard Next.js
da Marktiva**, ligado por git a este repositorio (branch de producao
`claude/facebook-connection-verify-po65ps`).

Mandar HTML solto para la sobrescreveria o dashboard e provavelmente quebraria
o build. Cada site estatico merece projeto proprio. O script avisa quando o
alvo tem framework configurado ou esta ligado a um repositorio, mas o aviso
nao impede o envio — leia antes de confirmar.

## Onde guardar os tokens

O container desta sessao e efemero: qualquer token exportado aqui morre junto.
Para nao precisar colar de novo a cada sessao, cadastre como variavel de
ambiente do proprio ambiente do Claude Code, em vez de mandar por mensagem.
Token colado em conversa deve ser considerado vazado e trocado.
