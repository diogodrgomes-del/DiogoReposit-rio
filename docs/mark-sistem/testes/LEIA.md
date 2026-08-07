# Demonstração navegável

`../demonstracao.html` é o MARK SISTEM inteiro rodando no navegador, sem banco:
os dados moram no `localStorage`. Serve para ver e clicar o produto antes de
cada módulo existir de verdade em Postgres.

Os algoritmos são os mesmos do sistema real, portados para o navegador:

| No navegador          | No sistema                          |
| --------------------- | ----------------------------------- |
| `normalizarTelefone`  | `packages/core/src/telefone.ts`     |
| `entre` / `aoInicio`  | `packages/core/src/ordem.ts`        |
| `similaridade`        | `pg_trgm` + `unaccent` (migração 4) |
| `pode`                | `packages/core/src/contexto.ts`     |

O que muda é onde o dado mora e quantas vezes a permissão é checada: aqui, uma
vez em JavaScript; lá, na regra **e** de novo no banco, com Row Level Security.

## Rodar

```sh
cd docs/mark-sistem/testes
node servidor.mjs &          # serve a demonstração em http://127.0.0.1:8099
node fumaca.mjs              # fluxo comercial: lead → atividade → cliente
node fumaca2.mjs             # entrega, agenda, financeiro, tráfego, cofre, permissões
node fumaca3.mjs             # WhatsApp, propostas, mural, wiki, satisfação, lixeira
```

`servidor.mjs` lê o HTML uma vez, ao subir — depois de editar a demonstração,
reinicie o servidor antes de rodar os testes, senão eles medem a versão antiga.
