# Worker do MARK SISTEM.
#
# Existe porque a Vercel não sustenta processo de longa duração: o sync do Meta
# Ads, a limpeza de sessões e — na fase 5 — o socket de WhatsApp precisam de um
# lugar que não seja função serverless.
#
# Build a partir da RAIZ do repositório, não desta pasta: o worker importa
# @mark/core e @mark/db por workspace, e eles não existem dentro de apps/worker.
#
#   docker build -f apps/worker/Dockerfile -t mark-worker .

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

# Todos os manifestos, inclusive o do web.
#
# `npm ci` confere o lockfile contra **todos** os workspaces declarados na raiz;
# omitir apps/web/package.json faria a instalação falhar. Dá para enxugar a
# imagem depois com um estágio de poda — mas trocar confiabilidade por 200 MB
# num Dockerfile que não dá para testar aqui seria a troca errada.
COPY package.json package-lock.json ./
COPY apps/web/package.json             apps/web/
COPY apps/worker/package.json          apps/worker/
COPY packages/core/package.json        packages/core/
COPY packages/db/package.json          packages/db/
COPY packages/auth/package.json        packages/auth/
COPY packages/cofre/package.json       packages/cofre/
COPY packages/integracoes/package.json packages/integracoes/

# Manifestos primeiro: enquanto as dependências não mudarem, esta camada é
# reaproveitada e o build leva segundos em vez de minutos.
#
# tsx é devDependency da raiz e é o que executa o worker, então entra explícito
# — `--omit=dev` o deixaria de fora.
RUN npm ci --omit=dev && npm install --no-save tsx@^4.19.2

COPY tsconfig.base.json ./
COPY packages/ packages/
COPY apps/worker/ apps/worker/

EXPOSE 8080

# O worker trata SIGTERM: para os timers, fecha o servidor e encerra o pool do
# Postgres antes de sair. Sem isso, uma conexão fica pendurada a cada deploy.
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tsx executa TypeScript direto. Um passo de build só produziria JavaScript
# equivalente e mais um lugar onde o mapa de origem pode divergir do código.
CMD ["npx", "tsx", "apps/worker/src/index.ts"]
