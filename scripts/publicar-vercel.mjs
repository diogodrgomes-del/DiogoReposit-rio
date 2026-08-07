#!/usr/bin/env node
/**
 * Publica arquivos estaticos num projeto da Vercel.
 *
 *   node scripts/publicar-vercel.mjs <projeto> <arquivo...> [--producao] [--ensaio]
 *
 * Exemplo:
 *   node scripts/publicar-vercel.mjs franciele-bill \
 *        linkbio-franciele/index-com-suas-fotos.html:index.html --producao
 *
 * O sufixo ":nome" renomeia o arquivo no destino. Sem ele, vale o nome base.
 *
 * O token vem de VERCEL_TOKEN no ambiente. Nunca escreva o token aqui:
 * este arquivo vai para o repositorio.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';

const API = 'https://api.vercel.com';
const TOKEN = process.env.VERCEL_TOKEN;
const TIME = process.env.VERCEL_TEAM_ID || '';

const args = process.argv.slice(2);
const producao = args.includes('--producao');
const ensaio = args.includes('--ensaio');
const positivos = args.filter((a) => !a.startsWith('--'));
const projeto = positivos[0];
const entradas = positivos.slice(1);

if (!TOKEN) sair('falta VERCEL_TOKEN no ambiente');
if (!projeto || !entradas.length) sair('uso: publicar-vercel.mjs <projeto> <arquivo...> [--producao] [--ensaio]');

function sair(msg) {
  console.error('erro: ' + msg);
  process.exit(1);
}

/** rede da Vercel: tenta de novo, porque quedas de TLS aqui sao comuns */
async function api(caminho, opcoes = {}, tentativas = 4) {
  const url = API + caminho + (TIME ? (caminho.includes('?') ? '&' : '?') + 'teamId=' + TIME : '');
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, {
        ...opcoes,
        headers: { Authorization: 'Bearer ' + TOKEN, ...(opcoes.headers || {}) },
      });
      const texto = await r.text();
      let corpo;
      try { corpo = texto ? JSON.parse(texto) : {}; } catch { corpo = { bruto: texto }; }
      if (r.status >= 500 && i < tentativas - 1) { await espera(i); continue; }
      return { status: r.status, corpo };
    } catch (e) {
      ultimo = e;
      if (i < tentativas - 1) { await espera(i); continue; }
    }
  }
  throw ultimo;
}
const espera = (i) => new Promise((r) => setTimeout(r, 1000 * 2 ** i));

/* ── 1. le os arquivos e calcula o sha que a Vercel usa para deduplicar ── */
const arquivos = entradas.map((entrada) => {
  const [caminho, destino] = entrada.split(':');
  const dados = readFileSync(caminho);
  return {
    caminho,
    file: destino || basename(caminho),
    dados,
    sha: createHash('sha1').update(dados).digest('hex'),
    size: dados.length,
  };
});

console.log('projeto :', projeto);
console.log('destino :', producao ? 'PRODUCAO' : 'previa');
for (const a of arquivos) {
  console.log(`arquivo : ${a.caminho} -> /${a.file}  (${(a.size / 1024).toFixed(0)} KB)`);
}

/* ── 2. o projeto existe? se nao, cria como estatico ── */
let r = await api('/v9/projects/' + encodeURIComponent(projeto));
if (r.status === 404) {
  console.log('projeto nao existe — sera criado como estatico');
  if (!ensaio) {
    r = await api('/v11/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // framework nulo = sem build. O HTML e servido como esta.
      body: JSON.stringify({ name: projeto, framework: null }),
    });
    if (r.status >= 300) sair('nao criou o projeto: ' + JSON.stringify(r.corpo));
    console.log('projeto criado');
  }
} else if (r.status >= 300) {
  sair('nao consegui ler o projeto: ' + JSON.stringify(r.corpo));
} else {
  const g = r.corpo.link;
  console.log('projeto existe | framework:', r.corpo.framework,
              '| git:', g ? `${g.org}/${g.repo}` : 'nao ligado');
  if (g) {
    console.log('AVISO: este projeto esta ligado a um repositorio. Publicar por aqui');
    console.log('       cria um deploy fora do fluxo do git e pode confundir o historico.');
  }
  if (r.corpo.framework) {
    console.log('AVISO: o projeto tem framework "' + r.corpo.framework + '" configurado.');
    console.log('       Enviar HTML solto para um projeto de framework tende a dar erro de build.');
  }
}

/* ── 3. envia cada arquivo ── */
for (const a of arquivos) {
  if (ensaio) { console.log('ensaio: nao enviei', a.file); continue; }
  const r = await api('/v2/files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-vercel-digest': a.sha,
      'Content-Length': String(a.size),
    },
    body: a.dados,
  });
  if (r.status >= 300) sair('falhou ao enviar ' + a.file + ': ' + JSON.stringify(r.corpo));
  console.log('enviado:', a.file);
}

/* ── 4. cria o deploy ── */
if (ensaio) {
  console.log('\nensaio concluido — nada foi publicado');
  process.exit(0);
}

r = await api('/v13/deployments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: projeto,
    project: projeto,
    target: producao ? 'production' : undefined,
    files: arquivos.map((a) => ({ file: a.file, sha: a.sha, size: a.size })),
    projectSettings: { framework: null, buildCommand: null, outputDirectory: null },
  }),
});
if (r.status >= 300) sair('falhou ao criar o deploy: ' + JSON.stringify(r.corpo));

const id = r.corpo.id;
console.log('deploy criado:', r.corpo.url);

/* ── 5. espera ficar pronto ── */
for (let i = 0; i < 60; i++) {
  await new Promise((res) => setTimeout(res, 2500));
  const s = await api('/v13/deployments/' + id);
  const estado = s.corpo.readyState || s.corpo.status;
  if (estado === 'READY') {
    console.log('\nPRONTO  https://' + s.corpo.url);
    const apelidos = s.corpo.alias || [];
    for (const al of apelidos) console.log('        https://' + al);
    process.exit(0);
  }
  if (estado === 'ERROR' || estado === 'CANCELED') {
    sair('deploy terminou em ' + estado + ' — veja os registros no painel da Vercel');
  }
  process.stdout.write('.');
}
sair('tempo esgotado esperando o deploy ficar pronto');
