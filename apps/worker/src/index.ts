import { createServer } from "node:http";
import { sql } from "drizzle-orm";
import { db, fechar } from "@mark/db";
import { sessao } from "@mark/auth";

/**
 * Worker do MARK SISTEM.
 *
 * Existe porque a Vercel não sustenta processo de longa duração: socket de
 * WhatsApp, fila e cron precisam de um lugar que não seja função serverless.
 * Descobrir isso na fase 5, com o sistema em produção, custaria replanejar
 * infraestrutura; por isso ele sobe já na fase 0, ainda com pouca coisa.
 *
 * Hoje faz duas: responde ao health check da plataforma e limpa sessões
 * vencidas. As filas entram na fase 3, junto com as notificações.
 */

const PORTA = Number(process.env.PORT ?? 8080);
const LIMPEZA_MIN = 60;

type Tarefa = { nome: string; intervaloMin: number; executar: () => Promise<string> };

const TAREFAS: Tarefa[] = [
  {
    nome: "limpar-sessoes",
    intervaloMin: LIMPEZA_MIN,
    executar: async () => {
      const n = await sessao.limpar();
      return `${n} sessões removidas`;
    },
  },
];

let encerrando = false;
const timers: NodeJS.Timeout[] = [];

async function rodar(tarefa: Tarefa): Promise<void> {
  if (encerrando) return;
  const inicio = Date.now();
  try {
    const resumo = await tarefa.executar();
    console.log(`[${tarefa.nome}] ${resumo} (${Date.now() - inicio}ms)`);
  } catch (e) {
    // Uma tarefa que falha não derruba o worker nem impede as outras: o
    // próximo ciclo tenta de novo. Falha permanente aparece como repetição no
    // log, e é isso que o monitoramento vai observar.
    console.error(`[${tarefa.nome}] falhou:`, e instanceof Error ? e.message : e);
  }
}

function agendar(): void {
  for (const tarefa of TAREFAS) {
    void rodar(tarefa);
    timers.push(setInterval(() => void rodar(tarefa), tarefa.intervaloMin * 60_000));
  }
}

/**
 * Health check. Consulta o banco de verdade em vez de responder 200 fixo — um
 * worker que perdeu o banco está morto, e a plataforma precisa saber disso para
 * reiniciar.
 */
const servidor = createServer((req, res) => {
  if (req.url !== "/saude") {
    res.writeHead(404).end();
    return;
  }
  db()
    .execute(sql`SELECT 1`)
    .then(() => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ estado: "ok", tarefas: TAREFAS.map((t) => t.nome) }));
    })
    .catch((e: unknown) => {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ estado: "sem-banco", erro: e instanceof Error ? e.message : "?" }));
    });
});

async function encerrar(sinal: string): Promise<void> {
  if (encerrando) return;
  encerrando = true;
  console.log(`\n${sinal} recebido, encerrando…`);
  timers.forEach(clearInterval);
  servidor.close();
  await fechar().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => void encerrar("SIGTERM"));
process.on("SIGINT", () => void encerrar("SIGINT"));

servidor.listen(PORTA, () => {
  console.log(`worker ouvindo em :${PORTA}`);
  agendar();
});
