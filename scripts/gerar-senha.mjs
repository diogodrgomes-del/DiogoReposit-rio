#!/usr/bin/env node
/**
 * Gera a entrada de DASH_USERS para um usuário.
 *
 *   npm run senha -- diogo
 *   npm run senha -- diogo "minha senha secreta"
 *
 * Sem a senha no comando, ela é pedida sem aparecer na tela — melhor, porque
 * assim não fica registrada no histórico do shell.
 */

import { pbkdf2Sync, randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { stdin, stdout, argv, exit } from "node:process";

const ITERACOES = 210_000;

function derivar(senha, salt) {
  return pbkdf2Sync(senha, salt, ITERACOES, 32, "sha256");
}

function perguntarSenha(rotulo) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    const aoDigitar = (buf) => {
      const c = buf.toString("utf8");
      // Ctrl-C / Ctrl-D encerram sem deixar o terminal mudo.
      if (c === "" || c === "") {
        stdout.write("\n");
        rl.close();
        exit(1);
      }
    };
    stdin.on("data", aoDigitar);
    rl.question(rotulo, (resposta) => {
      stdin.off("data", aoDigitar);
      rl.close();
      stdout.write("\n");
      resolve(resposta);
    });
    // Esconde o que for digitado a partir daqui.
    rl._writeToOutput = (s) => {
      if (s.startsWith(rotulo)) stdout.write(rotulo);
    };
  });
}

const usuario = (argv[2] ?? "").trim();
if (!usuario) {
  console.error("Uso: npm run senha -- <usuario> [senha] [--forcar]");
  exit(2);
}
if (/[,:]/.test(usuario)) {
  console.error("O nome de usuário não pode conter vírgula nem dois-pontos.");
  exit(2);
}

let senha = argv[3];
if (!senha) {
  senha = await perguntarSenha("Senha: ");
  const confirma = await perguntarSenha("Repita a senha: ");
  if (senha !== confirma) {
    console.error("As senhas não conferem.");
    exit(1);
  }
}

const forcar = argv.includes("--forcar");
if (senha.length < 10 && !forcar) {
  console.error(
    `Senha com ${senha.length} caracteres. Use pelo menos 10 — este painel dá\n` +
    `acesso aos dados de todos os clientes da carteira.\n\n` +
    `Se for mesmo essa, repita o comando com --forcar no fim.`
  );
  exit(1);
}
if (senha.length < 10) {
  console.error(`AVISO: senha curta (${senha.length} caracteres), gerada mesmo assim.\n`);
}

const salt = randomBytes(16);
const hash = derivar(senha, salt);
// base64url + ponto: o Next passa valores de .env por dotenv-expand, que comeria
// qualquer `$` do hash e faria o login falhar sempre.
const entrada = `${usuario}:pbkdf2.${ITERACOES}.${salt.toString("base64url")}.${hash.toString("base64url")}`;

console.log("\nAdicione esta linha em DASH_USERS na Vercel.");
console.log("Para mais de um usuário, separe as entradas por vírgula.\n");
console.log(entrada);
console.log();
