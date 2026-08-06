import Link from "next/link";
import { painel, usuarios } from "@mark/core";
import type { Indicador } from "@mark/core";
import { exigirContexto } from "@/lib/sessao";

export const dynamic = "force-dynamic";

const COR: Record<string, string | undefined> = {
  atencao: "var(--warn)",
  risco: "var(--crit)",
};

/**
 * Cartão de indicador.
 *
 * Vira link quando tem destino — requisito 6 do briefing: clicar num número
 * abre a lista que ele resume. Um indicador que não leva a lugar nenhum obriga
 * a pessoa a procurar o que ele contou.
 */
function Cartao({ indicador }: { indicador: Indicador }) {
  const conteudo = (
    <>
      <p className="indicador__rotulo">{indicador.rotulo}</p>
      <p className="indicador__valor" style={{ color: COR[indicador.tom ?? "normal"] }}>
        {indicador.valor}
      </p>
      {indicador.detalhe && (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-3)" }}>
          {indicador.detalhe}
        </p>
      )}
    </>
  );

  return indicador.href ? (
    <Link className="indicador" href={indicador.href}>
      {conteudo}
    </Link>
  ) : (
    <div className="indicador">{conteudo}</div>
  );
}

export default async function PaginaPainel() {
  const ctx = await exigirContexto();
  const [blocos, atencao, perfil] = await Promise.all([
    painel.montar(ctx),
    painel.precisaDeAtencao(ctx),
    usuarios.perfil(ctx),
  ]);

  const primeiroNome = perfil?.nome.split(" ")[0] ?? "";

  return (
    <>
      <div className="pagina__cabeca">
        <div>
          <h1 className="pagina__titulo">
            {primeiroNome ? `Olá, ${primeiroNome}` : "Painel"}
          </h1>
          <p className="pagina__sub">
            {new Intl.DateTimeFormat("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
          </p>
        </div>
      </div>

      {atencao.length > 0 && (
        <div className="cartao" style={{ marginBottom: 20 }}>
          <div className="cartao__cabeca">
            <strong>Precisa de você hoje</strong>
            <span className="pagina__sub">{atencao.length} item(ns)</span>
          </div>
          <div className="rolagem">
            <table className="tabela-sis">
              <tbody>
                {atencao.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link href={item.href}>{item.titulo}</Link>
                      {item.detalhe && (
                        <div style={{ color: "var(--ink-3)", fontSize: 12 }}>{item.detalhe}</div>
                      )}
                    </td>
                    <td style={{ width: 120, textAlign: "right" }}>
                      {item.atrasado ? (
                        <span className="selo selo--vermelho">Atrasado</span>
                      ) : (
                        <span className="selo">Hoje</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {blocos.length === 0 ? (
        <div className="cartao">
          <div className="estado">
            <h2 className="estado__titulo">Nada para mostrar ainda</h2>
            <p className="estado__texto">
              Assim que houver leads, clientes ou campanhas sincronizadas, os números aparecem
              aqui.
            </p>
          </div>
        </div>
      ) : (
        blocos.map((bloco) => (
          <section key={bloco.titulo} style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--ink-3)",
                margin: "0 0 10px",
              }}
            >
              {bloco.titulo}
            </h2>
            <div className="indicadores" style={{ marginBottom: 0 }}>
              {bloco.indicadores.map((i) => (
                <Cartao key={i.rotulo} indicador={i} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
