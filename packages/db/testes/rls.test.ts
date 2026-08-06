import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { comContexto, comoAdmin, db, fechar, novoId } from "../src/index";
import { membros, organizacoes, papeis, papelPermissoes, sessoes, usuarios } from "../src/esquema/nucleo";
import { migrar } from "../src/migrar";

/**
 * Testes de Row Level Security.
 *
 * Cada política existe para negar alguma coisa. Uma política que ninguém viu
 * negando costuma estar permitindo — normalmente porque faltou
 * `FORCE ROW LEVEL SECURITY` e a aplicação conecta como dona da tabela, caso em
 * que a RLS é ignorada em silêncio e todo teste de caminho feliz passa.
 *
 * Precisa de um Postgres de verdade. Sem `DATABASE_URL` o arquivo é pulado, e o
 * CI providencia um serviço para que ele não seja pulado lá — que é onde
 * importa.
 */

const temBanco = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
const descreve = temBanco ? describe : describe.skip;

// Duas organizações, dois usuários. A pergunta é sempre: A enxerga B?
const orgA = novoId();
const orgB = novoId();
const usuarioA = novoId();
const usuarioB = novoId();
const papelA = novoId();
const papelB = novoId();
const membroA = novoId();
const membroB = novoId();

const ctxA = { organizacaoId: orgA, usuarioId: usuarioA };
const ctxB = { organizacaoId: orgB, usuarioId: usuarioB };

descreve("RLS — isolamento entre organizações", () => {
  beforeAll(async () => {
    await migrar();

    await comoAdmin(async (tx) => {
      await tx.insert(usuarios).values([
        { id: usuarioA, email: `a-${usuarioA}@teste.local`, nome: "A" },
        { id: usuarioB, email: `b-${usuarioB}@teste.local`, nome: "B" },
      ]);
      await tx.insert(organizacoes).values([
        { id: orgA, nome: "Org A", slug: `org-a-${orgA}`, proprietarioId: usuarioA },
        { id: orgB, nome: "Org B", slug: `org-b-${orgB}`, proprietarioId: usuarioB },
      ]);
      await tx.insert(papeis).values([
        { id: papelA, organizacaoId: orgA, chave: "admin", nome: "Admin" },
        { id: papelB, organizacaoId: orgB, chave: "admin", nome: "Admin" },
      ]);
      await tx.insert(papelPermissoes).values([
        { papelId: papelA, permissao: "*" },
        { papelId: papelB, permissao: "*" },
      ]);
      await tx.insert(membros).values([
        { id: membroA, organizacaoId: orgA, usuarioId: usuarioA, papelId: papelA },
        { id: membroB, organizacaoId: orgB, usuarioId: usuarioB, papelId: papelB },
      ]);
    });
  }, 60_000);

  afterAll(async () => {
    await comoAdmin(async (tx) => {
      await tx.execute(sql`DELETE FROM sessoes WHERE usuario_id IN (${usuarioA}, ${usuarioB})`);
      await tx.execute(sql`DELETE FROM membros WHERE organizacao_id IN (${orgA}, ${orgB})`);
      await tx.execute(sql`DELETE FROM papel_permissoes WHERE papel_id IN (${papelA}, ${papelB})`);
      await tx.execute(sql`DELETE FROM papeis WHERE id IN (${papelA}, ${papelB})`);
      await tx.execute(sql`UPDATE organizacoes SET proprietario_id = NULL WHERE id IN (${orgA}, ${orgB})`);
      await tx.execute(sql`DELETE FROM organizacoes WHERE id IN (${orgA}, ${orgB})`);
      await tx.execute(sql`DELETE FROM usuarios WHERE id IN (${usuarioA}, ${usuarioB})`);
    });
    await fechar();
  });

  it("a aplicação não conecta como superusuário nem com BYPASSRLS", async () => {
    // Se este teste falhar, todos os outros deste arquivo passam sem provar
    // nada: superusuário ignora RLS.
    const r = await db().execute<{ super: boolean; bypass: boolean }>(
      sql`SELECT rolsuper AS super, rolbypassrls AS bypass FROM pg_roles WHERE rolname = current_user`,
    );
    const linha = (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows)[0] as
      | { super: boolean; bypass: boolean }
      | undefined;
    expect(linha?.super).toBe(false);
    expect(linha?.bypass).toBe(false);
  });

  it("membros: A vê os próprios", async () => {
    const linhas = await comContexto(ctxA, (tx) => tx.select().from(membros));
    expect(linhas.map((l) => l.id)).toContain(membroA);
  });

  it("membros: A NÃO vê os da B", async () => {
    const linhas = await comContexto(ctxA, (tx) => tx.select().from(membros));
    expect(linhas.map((l) => l.id)).not.toContain(membroB);
  });

  it("organizacoes: A só enxerga a própria", async () => {
    const linhas = await comContexto(ctxA, (tx) => tx.select().from(organizacoes));
    expect(linhas.map((l) => l.id)).toEqual([orgA]);
  });

  it("usuarios: A não enxerga quem não divide organização com ela", async () => {
    const linhas = await comContexto(ctxA, (tx) => tx.select().from(usuarios));
    const ids = linhas.map((l) => l.id);
    expect(ids).toContain(usuarioA);
    expect(ids).not.toContain(usuarioB);
  });

  it("papeis: A não enxerga papel da B", async () => {
    const linhas = await comContexto(ctxA, (tx) => tx.select().from(papeis));
    const ids = linhas.map((l) => l.id);
    expect(ids).toContain(papelA);
    expect(ids).not.toContain(papelB);
  });

  it("papel_permissoes: A não lê as permissões da B", async () => {
    const linhas = await comContexto(ctxA, (tx) => tx.select().from(papelPermissoes));
    expect(linhas.map((l) => l.papelId)).not.toContain(papelB);
  });

  it("escrita: A não consegue inserir membro na organização B", async () => {
    await expect(
      comContexto(ctxA, (tx) =>
        tx.insert(membros).values({
          id: novoId(),
          organizacaoId: orgB, // organização alheia
          usuarioId: usuarioA,
          papelId: papelB,
        }),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it("sem contexto definido, nada é visível", async () => {
    // Conexão crua, sem set_config: as políticas comparam com NULL e negam.
    const r = await db().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM membros`);
    const linha = (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows)[0] as { n: number };
    expect(linha.n).toBe(0);
  });
});

descreve("RLS — sessões são privadas por usuário", () => {
  const sessaoDeA = novoId();

  beforeAll(async () => {
    await comoAdmin(async (tx) => {
      await tx.insert(sessoes).values({
        id: sessaoDeA,
        usuarioId: usuarioA,
        organizacaoId: orgA,
        tokenHash: `hash-${sessaoDeA}`,
        expiraEm: new Date(Date.now() + 3_600_000),
      });
    });
  });

  it("A lê a própria sessão", async () => {
    const linhas = await comContexto(ctxA, (tx) => tx.select().from(sessoes));
    expect(linhas.map((l) => l.id)).toContain(sessaoDeA);
  });

  it("B não lê a sessão de A, mesmo sendo administrador da própria organização", async () => {
    const linhas = await comContexto(ctxB, (tx) => tx.select().from(sessoes));
    expect(linhas.map((l) => l.id)).not.toContain(sessaoDeA);
  });
});

descreve("Trava do financeiro pessoal no banco", () => {
  it("o CHECK recusa conceder financeiro.pessoal.* a um papel", async () => {
    await expect(
      comoAdmin((tx) =>
        tx.insert(papelPermissoes).values({ papelId: papelA, permissao: "financeiro.pessoal.ver" }),
      ),
    ).rejects.toThrow(/permissao_concedivel|violates check/i);
  });

  it("financeiro empresarial continua concedível", async () => {
    await expect(
      comoAdmin(async (tx) => {
        await tx
          .insert(papelPermissoes)
          .values({ papelId: papelA, permissao: "financeiro.lancamento.ver" })
          .onConflictDoNothing();
      }),
    ).resolves.not.toThrow();
  });
});
