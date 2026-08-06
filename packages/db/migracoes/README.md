# Migrações

SQL escrito à mão, aplicado em ordem por `npm run db:migrar`.

## Por que não `drizzle-kit generate`

O `drizzle-kit` gera migração a partir do diff do esquema, e é bom nisso — para
tabelas e colunas. Este banco precisa de quatro coisas que ele não modela:

1. **Políticas de RLS** com subconsulta (`usuarios`, `papel_permissoes`)
2. **`FORCE ROW LEVEL SECURITY`**, sem o qual a RLS não vale para o dono da
   tabela — que é exatamente como a aplicação conecta em Postgres gerenciado
3. **Particionamento por intervalo** (`wa_mensagens`, migração 0012)
4. **Índices parciais e `NULLS NOT DISTINCT`**, usados desde a migração 0001

Gerar e depois emendar SQL à mão dá o pior dos dois mundos: o diff deixa de
bater com o banco e a próxima geração propõe desfazer o que foi emendado.

O esquema Drizzle em `src/esquema/` continua sendo a camada tipada de consulta.
Ele descreve o banco; não o cria.

## Regras

- Um arquivo por migração, `NNNN_nome.sql`, numeração sequencial.
- Cada arquivo roda dentro de uma transação. Se falhar no meio, nada é aplicado.
- Nunca editar um arquivo já aplicado em produção — crie o próximo.
- Toda tabela nova precisa, no mesmo arquivo ou no seguinte:
  `ENABLE` + `FORCE ROW LEVEL SECURITY` e ao menos uma política.
- Toda política precisa de um teste em `packages/db/testes/rls.test.ts` que
  prove que ela **nega**. Política que ninguém viu negando costuma estar
  permitindo.

## Comandos

```bash
npm run db:migrar    # aplica o que falta
npm run db:semear    # papéis padrão, organização e proprietário
```

O migrador registra o que aplicou em `_migracoes` e é idempotente: rodar duas
vezes não repete nada.
