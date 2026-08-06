import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { comContexto, comoAdmin, fechar, novoId } from "../src/index.js";
import { clientes, contatos, credenciais, credencialAcessos } from "../src/esquema/clientes.js";
import { membros, organizacoes, papeis, usuarios } from "../src/esquema/nucleo.js";
import { migrar } from "../src/migrar.js";

/**
 * RLS das migrações 0003 e 0004, mais a imutabilidade da auditoria de senhas.
 *
 * Setup e limpeza ficam no bloco de fora, e não em cada `describe`: o `afterAll`
 * de um `describe` roda antes do `describe` seguinte começar, e apagaria os
 * dados que o próximo espera encontrar.
 *
 * Só roda com DATABASE_URL. O CI providencia um Postgres com papel sem
 * BYPASSRLS, que é onde estes testes provam alguma coisa.
 */

const temBanco = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
const descreve = temBanco ? describe : describe.skip;

const orgA = novoId();
const orgB = novoId();
const usuarioA = novoId();
const usuarioB = novoId();
const papelA = novoId();
const papelB = novoId();
const clienteA = novoId();
const clienteB = novoId();
const credencialA = novoId();

const ctxA = { organizacaoId: orgA, usuarioId: usuarioA };
const ctxB = { organizacaoId: orgB, usuarioId: usuarioB };

descreve("Migrações 0003 e 0004", () => {
  beforeAll(async () => {
    await migrar();
    await comoAdmin(async (tx) => {
      await tx.insert(usuarios).values([
        { id: usuarioA, email: `ca-${usuarioA}@teste.local`, nome: "A" },
        { id: usuarioB, email: `cb-${usuarioB}@teste.local`, nome: "B" },
      ]);
      await tx.insert(organizacoes).values([
        { id: orgA, nome: "Org A", slug: `ca-${orgA}`, proprietarioId: usuarioA },
        { id: orgB, nome: "Org B", slug: `cb-${orgB}`, proprietarioId: usuarioB },
      ]);
      await tx.insert(papeis).values([
        { id: papelA, organizacaoId: orgA, chave: "admin", nome: "Admin" },
        { id: papelB, organizacaoId: orgB, chave: "admin", nome: "Admin" },
      ]);
      await tx.insert(membros).values([
        { id: novoId(), organizacaoId: orgA, usuarioId: usuarioA, papelId: papelA },
        { id: novoId(), organizacaoId: orgB, usuarioId: usuarioB, papelId: papelB },
      ]);
      await tx.insert(clientes).values([
        { id: clienteA, organizacaoId: orgA, nome: "Óticas Gouveia" },
        { id: clienteB, organizacaoId: orgB, nome: "Cliente da concorrente" },
      ]);
      await tx.insert(credenciais).values({
        id: credencialA,
        organizacaoId: orgA,
        clienteId: clienteA,
        plataforma: "meta_ads",
        segredoCifrado: Buffer.from("cifrado"),
        dekCifrada: Buffer.from("dek"),
        versaoKek: 1,
      });
      await tx.insert(credencialAcessos).values({
        organizacaoId: orgA,
        credencialId: credencialA,
        usuarioId: usuarioA,
        acao: "revelou",
      });
    });
  }, 60_000);

  afterAll(async () => {
    await comoAdmin(async (tx) => {
      // O gatilho de imutabilidade recusa DELETE — inclusive o da limpeza.
      // Desligá-lo aqui é legítimo e explícito; em produção ninguém roda isto.
      await tx.execute(sql`ALTER TABLE credencial_acessos DISABLE TRIGGER credencial_acessos_sem_alteracao`);
      await tx.execute(sql`DELETE FROM credencial_acessos WHERE organizacao_id IN (${orgA}, ${orgB})`);
      await tx.execute(sql`ALTER TABLE credencial_acessos ENABLE TRIGGER credencial_acessos_sem_alteracao`);

      await tx.execute(sql`DELETE FROM credenciais WHERE organizacao_id IN (${orgA}, ${orgB})`);
      await tx.execute(sql`DELETE FROM eventos WHERE organizacao_id IN (${orgA}, ${orgB})`);
      await tx.execute(sql`DELETE FROM contatos WHERE organizacao_id IN (${orgA}, ${orgB})`);
      await tx.execute(sql`DELETE FROM clientes WHERE organizacao_id IN (${orgA}, ${orgB})`);
      await tx.execute(sql`DELETE FROM membros WHERE organizacao_id IN (${orgA}, ${orgB})`);
      await tx.execute(sql`DELETE FROM papeis WHERE id IN (${papelA}, ${papelB})`);
      await tx.execute(sql`UPDATE organizacoes SET proprietario_id = NULL WHERE id IN (${orgA}, ${orgB})`);
      await tx.execute(sql`DELETE FROM organizacoes WHERE id IN (${orgA}, ${orgB})`);
      await tx.execute(sql`DELETE FROM usuarios WHERE id IN (${usuarioA}, ${usuarioB})`);
    });
    await fechar();
  });

  describe("isolamento de clientes", () => {
    it("A vê o próprio cliente", async () => {
      const linhas = await comContexto(ctxA, (tx) => tx.select().from(clientes));
      expect(linhas.map((l) => l.id)).toContain(clienteA);
    });

    it("A NÃO vê o cliente da concorrente", async () => {
      const linhas = await comContexto(ctxA, (tx) => tx.select().from(clientes));
      expect(linhas.map((l) => l.id)).not.toContain(clienteB);
    });

    it("A não consegue criar cliente na organização B", async () => {
      await expect(
        comContexto(ctxA, (tx) =>
          tx.insert(clientes).values({ id: novoId(), organizacaoId: orgB, nome: "Invasor" }),
        ),
      ).rejects.toThrow(/row-level security|violates/i);
    });

    it("A não consegue editar cliente da organização B", async () => {
      const r = await comContexto(ctxA, (tx) =>
        tx
          .update(clientes)
          .set({ nome: "Renomeado por quem não devia" })
          .where(eq(clientes.id, clienteB))
          .returning({ id: clientes.id }),
      );
      // A política filtra na leitura: o UPDATE não encontra a linha.
      expect(r).toHaveLength(0);
    });
  });

  describe("telefone único por organização", () => {
    const telefone = "+5544998887777";

    it("aceita o primeiro contato", async () => {
      await expect(
        comContexto(ctxA, (tx) =>
          tx
            .insert(contatos)
            .values({ id: novoId(), organizacaoId: orgA, nome: "Primeiro", telefoneE164: telefone }),
        ),
      ).resolves.not.toThrow();
    });

    it("recusa o segundo com o mesmo telefone", async () => {
      // É este índice que impede o WhatsApp criar contato novo a cada mensagem.
      await expect(
        comContexto(ctxA, (tx) =>
          tx
            .insert(contatos)
            .values({ id: novoId(), organizacaoId: orgA, nome: "Duplicado", telefoneE164: telefone }),
        ),
      ).rejects.toThrow(/contatos_telefone|duplicate key/i);
    });

    it("o mesmo telefone existe em outra organização", async () => {
      // Isolamento não é colisão: duas agências podem atender a mesma pessoa.
      await expect(
        comContexto(ctxB, (tx) =>
          tx
            .insert(contatos)
            .values({ id: novoId(), organizacaoId: orgB, nome: "Mesma pessoa", telefoneE164: telefone }),
        ),
      ).resolves.not.toThrow();
    });
  });

  describe("auditoria de credenciais é somente-anexação", () => {
    it("o gatilho recusa UPDATE, inclusive para o dono da tabela", async () => {
      // REVOKE não resolveria: o dono da tabela mantém o privilégio, e é assim
      // que a aplicação conecta em Postgres gerenciado.
      await expect(
        comoAdmin((tx) =>
          tx.execute(
            sql`UPDATE credencial_acessos SET acao = 'copiou' WHERE credencial_id = ${credencialA}`,
          ),
        ),
      ).rejects.toThrow(/somente-anexação/i);
    });

    it("o gatilho recusa DELETE", async () => {
      await expect(
        comoAdmin((tx) =>
          tx.execute(sql`DELETE FROM credencial_acessos WHERE credencial_id = ${credencialA}`),
        ),
      ).rejects.toThrow(/somente-anexação/i);
    });

    it("INSERT continua funcionando", async () => {
      await expect(
        comoAdmin((tx) =>
          tx.insert(credencialAcessos).values({
            organizacaoId: orgA,
            credencialId: credencialA,
            usuarioId: usuarioA,
            acao: "copiou",
          }),
        ),
      ).resolves.not.toThrow();
    });

    it("B não lê a auditoria de A", async () => {
      const linhas = await comContexto(ctxB, (tx) => tx.select().from(credencialAcessos));
      expect(linhas.map((l) => l.credencialId)).not.toContain(credencialA);
    });

    it("B não lê a credencial de A", async () => {
      const linhas = await comContexto(ctxB, (tx) => tx.select().from(credenciais));
      expect(linhas.map((l) => l.id)).not.toContain(credencialA);
    });
  });
});
