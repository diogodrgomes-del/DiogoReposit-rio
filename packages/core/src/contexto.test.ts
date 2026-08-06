import { describe, expect, it } from "vitest";
import {
  contextoDeSistema,
  ErroDeAutorizacao,
  exigir,
  filtroDeClientes,
  pode,
  type Contexto,
} from "./contexto.js";
import { concedivel, ocultarAoNegar, permissaoExiste } from "./permissoes.js";

function ctx(over: Partial<Contexto> = {}): Contexto {
  return {
    organizacaoId: "org-1",
    usuarioId: "user-1",
    permissoes: new Set(),
    clientesPermitidos: null,
    ehProprietario: false,
    ...over,
  };
}

describe("pode — curingas", () => {
  it("aceita permissão exata", () => {
    expect(pode(ctx({ permissoes: new Set(["vendas.lead.ver"]) }), "vendas.lead.ver")).toBe(true);
  });

  it("aceita curinga de recurso", () => {
    expect(pode(ctx({ permissoes: new Set(["vendas.lead.*"]) }), "vendas.lead.editar")).toBe(true);
  });

  it("aceita curinga de módulo", () => {
    expect(pode(ctx({ permissoes: new Set(["vendas.*"]) }), "vendas.proposta.editar")).toBe(true);
  });

  it("aceita curinga total", () => {
    expect(pode(ctx({ permissoes: new Set(["*"]) }), "config.papel.editar")).toBe(true);
  });

  it("nega o que não foi concedido", () => {
    expect(pode(ctx({ permissoes: new Set(["vendas.*"]) }), "operacional.demanda.ver")).toBe(false);
  });

  it("curinga de um módulo não vaza para outro", () => {
    expect(pode(ctx({ permissoes: new Set(["vendas.lead.*"]) }), "vendas.proposta.ver")).toBe(false);
  });

  it("contexto sem permissão nenhuma nega tudo", () => {
    expect(pode(ctx(), "wiki.pagina.ver")).toBe(false);
  });
});

describe("pode — financeiro pessoal", () => {
  // O requisito mais afiado do briefing: a área pessoal do proprietário não é
  // alcançável por papel nenhum. Estes três testes são a prova.
  it("nega mesmo com curinga total quando não é o proprietário", () => {
    expect(pode(ctx({ permissoes: new Set(["*"]) }), "financeiro.pessoal.ver")).toBe(false);
  });

  it("nega mesmo com a permissão concedida explicitamente", () => {
    const c = ctx({ permissoes: new Set(["financeiro.pessoal.ver", "*"]) });
    expect(pode(c, "financeiro.pessoal.ver")).toBe(false);
  });

  it("permite ao proprietário mesmo sem papel nenhum", () => {
    expect(pode(ctx({ ehProprietario: true }), "financeiro.pessoal.editar")).toBe(true);
  });

  it("financeiro empresarial continua valendo por papel", () => {
    const c = ctx({ permissoes: new Set(["financeiro.lancamento.ver"]) });
    expect(pode(c, "financeiro.lancamento.ver")).toBe(true);
  });

  it("as permissões pessoais não são concedíveis", () => {
    expect(concedivel("financeiro.pessoal.ver")).toBe(false);
    expect(concedivel("financeiro.lancamento.ver")).toBe(true);
  });
});

describe("pode — escopo por cliente", () => {
  const permitido = new Set(["cliente-a"]);

  it("permite dentro do escopo", () => {
    const c = ctx({ permissoes: new Set(["clientes.*"]), clientesPermitidos: permitido });
    expect(pode(c, "clientes.cliente.ver", { clienteId: "cliente-a" })).toBe(true);
  });

  it("nega fora do escopo, mesmo com a permissão", () => {
    const c = ctx({ permissoes: new Set(["clientes.*"]), clientesPermitidos: permitido });
    expect(pode(c, "clientes.cliente.ver", { clienteId: "cliente-b" })).toBe(false);
  });

  it("escopo nulo significa todos os clientes", () => {
    const c = ctx({ permissoes: new Set(["clientes.*"]), clientesPermitidos: null });
    expect(pode(c, "clientes.cliente.ver", { clienteId: "qualquer" })).toBe(true);
  });

  it("escopo vazio nega qualquer cliente", () => {
    const c = ctx({ permissoes: new Set(["clientes.*"]), clientesPermitidos: new Set() });
    expect(pode(c, "clientes.cliente.ver", { clienteId: "cliente-a" })).toBe(false);
  });

  it("filtroDeClientes devolve null sem restrição e a lista com restrição", () => {
    expect(filtroDeClientes(ctx())).toBeNull();
    expect(filtroDeClientes(ctx({ clientesPermitidos: permitido }))).toEqual(["cliente-a"]);
  });
});

describe("exigir", () => {
  it("passa quando pode", () => {
    expect(() => exigir(ctx({ permissoes: new Set(["*"]) }), "wiki.pagina.ver")).not.toThrow();
  });

  it("lança ErroDeAutorizacao quando não pode", () => {
    expect(() => exigir(ctx(), "wiki.pagina.ver")).toThrow(ErroDeAutorizacao);
  });

  it("marca ocultar nos módulos que não devem confirmar existência", () => {
    try {
      exigir(ctx(), "financeiro.lancamento.ver");
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(ErroDeAutorizacao);
      expect((e as ErroDeAutorizacao).ocultar).toBe(true);
    }
  });

  it("não oculta módulos comuns", () => {
    expect(ocultarAoNegar("vendas.lead.ver")).toBe(false);
    expect(ocultarAoNegar("credenciais.credencial.revelar")).toBe(true);
  });
});

describe("contextoDeSistema", () => {
  it("não carrega permissão nenhuma", () => {
    const c = contextoDeSistema("org-1");
    expect(pode(c, "financeiro.lancamento.ver")).toBe(false);
    expect(pode(c, "financeiro.pessoal.ver")).toBe(false);
    expect(pode(c, "operacional.demanda.ver")).toBe(false);
  });
});

describe("catálogo", () => {
  it("reconhece permissão existente e rejeita inexistente", () => {
    expect(permissaoExiste("vendas.lead.ver")).toBe(true);
    expect(permissaoExiste("vendas.lead.voar")).toBe(false);
  });
});
