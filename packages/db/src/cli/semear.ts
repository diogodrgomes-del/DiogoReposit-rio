import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { derivar } from "@mark/auth";
import { fechar } from "../cliente.js";
import { semear } from "../semear.js";

/**
 * `npm run db:semear`
 *
 * Cria a organização, os papéis padrão e o proprietário. Idempotente: rodar de
 * novo não duplica nada e não mexe em quem já existe.
 *
 * Aceita as respostas por variável de ambiente (para CI e provisionamento) ou
 * por pergunta no terminal. A senha nunca vem por variável de ambiente nem por
 * argumento: as duas coisas vazam para o histórico do shell e para a listagem
 * de processos.
 */

async function perguntar(rotulo: string, padrao: string, doEnv?: string): Promise<string> {
  if (doEnv) return doEnv;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const r = (await rl.question(`${rotulo} [${padrao}]: `)).trim();
    return r || padrao;
  } finally {
    rl.close();
  }
}

/**
 * Pede a senha sem exibi-la. Mesma técnica de `scripts/gerar-senha.mjs`: em vez
 * de silenciar o stdout inteiro, troca só o eco da linha do readline, o que não
 * deixa o terminal mudo se o processo morrer no meio.
 */
async function perguntarSenha(rotulo: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const interno = rl as unknown as { _writeToOutput: (s: string) => void };
  interno._writeToOutput = (s: string) => {
    if (s.startsWith(rotulo)) stdout.write(rotulo);
  };
  try {
    const senha = await rl.question(rotulo);
    stdout.write("\n");
    return senha.trim();
  } finally {
    rl.close();
  }
}

async function principal(): Promise<void> {
  const organizacao = await perguntar("Nome da organização", "Marktiva", process.env.SEED_ORG);
  const slug = await perguntar("Slug", "marktiva", process.env.SEED_SLUG);
  const nome = await perguntar("Nome do proprietário", "Diogo", process.env.SEED_NOME);
  const email = await perguntar("E-mail do proprietário", "", process.env.SEED_EMAIL);

  if (!email.includes("@")) throw new Error("E-mail do proprietário é obrigatório.");

  let senha = process.env.SEED_SENHA ?? "";
  if (!senha) {
    senha = await perguntarSenha("Senha do proprietário (mínimo 12 caracteres): ");
    const confirma = await perguntarSenha("Repita a senha: ");
    if (senha !== confirma) throw new Error("As senhas não conferem.");
  }

  // `derivar` recusa senha com menos de 12 caracteres. Este usuário enxerga o
  // financeiro pessoal e as senhas de todos os clientes — não há caso em que
  // valha a pena flexibilizar.
  const proprietarioSenhaHash = await derivar(senha);

  const r = await semear({
    organizacao,
    slug,
    proprietarioEmail: email,
    proprietarioNome: nome,
    proprietarioSenhaHash,
  });

  console.log(`\norganização  ${organizacao} (${r.organizacaoId})`);
  console.log(`proprietário ${email} (${r.usuarioId})`);
  console.log("\nO financeiro pessoal responde a este usuário e a mais ninguém.");
}

principal()
  .then(fechar)
  .catch(async (e: unknown) => {
    console.error("falha no seed:", e instanceof Error ? e.message : e);
    await fechar().catch(() => {});
    process.exitCode = 1;
  });
