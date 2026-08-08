# 06 — Segurança

Princípio único: **o frontend nunca decide nada**. Ele esconde, formata e avisa.
Quem autoriza é o servidor, em toda leitura e em toda escrita.

O painel atual já acerta a parte mais difícil disso — token só no servidor,
nenhuma variável `NEXT_PUBLIC_`, token removido de toda mensagem de erro antes
de virar log. Essa disciplina vira regra do projeto, com lint.

---

## Autenticação

### Decisão 4 — Auth.js v5 com banco próprio, não Clerk

O briefing sugere Clerk como opção. Três motivos para não:

1. **Permissão por cliente exige junção.** `client_assignments` liga usuário a
   cliente. Com a identidade fora do banco, toda query de escopo vira uma chamada
   de rede ou uma tabela espelho que dessincroniza.
2. **Custo por usuário ativo.** Hoje são 4 pessoas e é irrelevante. Se o MARK
   SISTEM virar SaaS — que é premissa explícita da §35 — vira custo por assento
   sobre o qual você não tem controle.
3. **Já existe autenticação funcionando aqui**, com PBKDF2 correto e comparação
   em tempo constante. O que falta não é o mecanismo, é a tabela de usuários.

Auth.js v5 com adaptador Prisma, provedor de credenciais, sessão em banco.

### Senhas

**Argon2id** para senhas novas (`m=19456, t=2, p=1` — parâmetros OWASP 2024).
O verificador PBKDF2 de `src/lib/auth.ts` fica no código para as contas migradas
de `DASH_USERS`; no primeiro login bem-sucedido, a senha é re-hasheada em
Argon2id e `senha_algo` é atualizado. Ninguém precisa trocar de senha.

Comparação em tempo constante e derivação mesmo com usuário inexistente — as duas
já implementadas hoje — são mantidas: sem isso, o tempo de resposta denuncia
quais e-mails existem.

### Sessão

Cookie `HttpOnly`, `Secure`, `SameSite=Lax`, com o hash do token — nunca o token
— guardado em `sessions`. Ociosidade de 12 h, máximo absoluto de 30 dias.

Sessão em banco em vez de JWT sem estado é o que permite **derrubar a sessão de
alguém na hora**. Numa agência, isso é a diferença entre "desliguei o acesso" e
"o acesso cai em até 12 horas".

### MFA e step-up

- **TOTP obrigatório** para `PROPRIETARIO`, `ADMIN` e `FINANCEIRO`. Opcional
  para os demais.
- **Step-up (re-digitar a senha)** exigido para: revelar credencial de cliente,
  entrar no financeiro pessoal, exportar dados, alterar permissões, remover
  usuário. Vale por 15 minutos (`sessions.step_up_em`).

Step-up existe porque o cenário real não é invasão remota — é notebook
desbloqueado em cima da mesa.

### Rate limiting

Redis, janela deslizante, por IP **e** por identificador:

| Alvo | Limite |
|---|---|
| `POST /api/auth/login` | 5 / 15 min por IP+e-mail, depois backoff exponencial |
| Recuperação de senha | 3 / hora por e-mail |
| Revelar credencial | 10 / hora por usuário |
| Server Actions de escrita | 100 / min por usuário |
| Envio de WhatsApp | por número, conforme [08](08-integracoes.md#whatsapp) |
| Webhooks recebidos | 1000 / min por origem |

O painel de hoje já limita tentativas de login (`src/lib/limite.ts`). A diferença
é que ali o contador é em memória do processo — em serverless, cada instância tem
o seu, e o limite efetivo é muito maior que o configurado. Em Redis, é global.

---

## Cofre de credenciais

O módulo com maior consequência em caso de falha: são as contas de anúncio, o
Business Manager e o WordPress dos clientes da agência.

### Criptografia em envelope

```
MASTER_KEY (32 bytes, variável de ambiente, nunca no banco)
   │  AES-256-GCM
   ▼
DEK por organização (data_encryption_keys.chave_cipher)
   │  AES-256-GCM, IV aleatório por registro
   ▼
segredo_cipher + segredo_iv + segredo_tag  (credentials)
```

Por que envelope e não criptografar direto com a chave mestra: rotacionar a chave
mestra passa a ser re-criptografar N chaves de organização, não N mil segredos. E
`dek_id` no registro permite rotação gradual, sem parada.

**GCM, não CBC** — GCM é autenticado: adulterar o texto cifrado no banco falha na
descriptografia em vez de devolver lixo. O `tag` guardado é o que garante isso.

### Regras

1. Segredo **nunca** aparece em listagem. `GET /clientes/x/acessos` devolve
   plataforma, login e URL. Nada mais.
2. Revelar é uma ação dedicada, com `credenciais:revelar` **e** step-up.
3. A gravação em `credential_access_log` acontece **na mesma transação** da
   descriptografia. Não é possível ver sem deixar registro.
4. Resposta de revelação: `Cache-Control: no-store`, sem log de corpo, sem
   telemetria.
5. "Copiar" limpa a área de transferência em 30 s (quando o navegador permite) e
   também é registrado.
6. Sentry, logs estruturados e mensagens de erro passam por uma lista de campos
   redigidos que inclui `senha`, `segredo`, `token`, `authorization`, `cookie`.

### Perda da chave mestra

Se `MASTER_KEY` for perdida, **as senhas são irrecuperáveis** — inclusive do
backup, que guarda apenas texto cifrado. Isso é o comportamento correto, e é
também um risco operacional real. Mitigação: a chave fica em três lugares
(gerenciador de segredos do provedor, cofre pessoal do proprietário e envelope
lacrado físico), e o procedimento de restauração testa a descriptografia junto
com o restore do banco. Ver [11](11-riscos.md#r4).

---

## Entrada de dados

**Validação com Zod, sempre no servidor.** O mesmo schema é usado pelo React Hook
Form no cliente, mas a validação que vale é a do servidor. Toda Server Action
começa com `Schema.parse(input)`.

**SQL Injection** — Prisma parametriza. Nas poucas queries em `$queryRaw`, usar
sempre a forma de template tag (`$queryRaw\`...\``), nunca `$queryRawUnsafe` com
concatenação. Regra de lint proíbe `$queryRawUnsafe`.

**XSS** — React escapa por padrão. Os dois pontos de risco são o editor rico
(wiki, comentários, briefing) e a mensagem de WhatsApp. Ambos guardam **JSON
estruturado** (TipTap), não HTML, e renderizam por componentes conhecidos. Onde
HTML for inevitável, `sanitize-html` com allowlist. CSP sem `unsafe-inline` para
scripts, com nonce.

**CSRF** — Server Actions já são protegidas por origem pelo Next. Os Route
Handlers de escrita verificam `Origin` e `Sec-Fetch-Site`. Cookie `SameSite=Lax`.

**IDOR** — o risco maior num sistema deste tipo. A defesa não é validar ID: é
que toda query passe por `forTenant()` + `clientesVisiveis()`, então um ID de
outra organização simplesmente não retorna linha. `findUnique({ where: { id } })`
sem escopo é proibido por lint fora de `packages/db`.

---

## Arquivos e uploads

### Decisão 10 — Cloudflare R2

S3-compatível, **egress zero**. Para uma agência que guarda vídeo bruto e o
cliente baixa material, o egress da S3 é o que estoura a conta — não o
armazenamento. R2 remove essa variável.

### Fluxo

```
1. Navegador  → POST /api/upload   { nome, mime, tamanho }
2. Servidor   → valida permissão, extensão, tamanho; cria linha em files
              → devolve URL pré-assinada (5 min, método e content-type fixos)
3. Navegador  → PUT direto no R2   (o servidor não vê o byte)
4. Navegador  → POST /api/upload/confirmar { fileId }
5. Worker     → verifica tamanho e sha256 reais, gera miniatura, marca pronto
```

O passo 5 existe porque a URL pré-assinada é uma promessa, não uma garantia: o
que foi enviado precisa ser conferido contra o que foi declarado.

### Validação

- **Allowlist** de extensão e MIME, não blocklist.
- MIME conferido pelos **bytes iniciais** no worker, não pelo cabeçalho.
- **SVG rejeitado** por padrão — SVG é XML executável e é vetor de XSS. Quando
  necessário, sanitizado no worker antes de ficar disponível.
- Limite de 500 MB por arquivo; multipart acima de 100 MB.
- Nome de arquivo nunca vira caminho: `storage_key` é `org/uuid/uuid`, e o nome
  original é só um campo de exibição.
- Download por URL pré-assinada de 60 s, emitida após checagem de permissão. O
  bucket é privado; não existe URL pública permanente.

---

## Cabeçalhos e transporte

Os três cabeçalhos de `next.config.mjs` já existem. Acrescentar:

```
Content-Security-Policy      default-src 'self'; script-src 'self' 'nonce-…';
                             img-src 'self' data: blob: https://<r2>;
                             connect-src 'self' https://<r2> wss://<worker>;
                             frame-ancestors 'none'; object-src 'none'
Strict-Transport-Security    max-age=63072000; includeSubDomains; preload
Permissions-Policy           camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy   same-origin
```

TLS obrigatório em todas as conexões, inclusive Postgres (`sslmode=require`) e
Redis.

---

## Backup e recuperação

| Camada | Como | Retenção |
|---|---|---|
| **Postgres — PITR** | contínuo, do Neon | 7 dias (30 no plano pago) |
| **Postgres — lógico** | `pg_dump` diário do worker → R2, cifrado | 30 diários, 12 mensais |
| **Arquivos** | versionamento de objeto do R2 | 30 dias |
| **Segredos** | fora de qualquer backup automático | — |
| **Lixeira do app** | `deleted_em`, restaurável na interface | 30 dias |

**Restauração é testada, não presumida.** Trimestralmente: restaurar o dump mais
recente num banco descartável, subir o worker apontado para ele, conferir
contagens e **descriptografar uma credencial de teste**. Backup que nunca foi
restaurado não é backup; é um arquivo grande.

Três níveis de recuperação, com alvos:

| Cenário | Como | RTO | RPO |
|---|---|---|---|
| Usuário apagou algo | lixeira, na interface | segundos | 0 |
| Migration ruim, tabela corrompida | PITR do Neon para o minuto anterior | < 30 min | < 1 min |
| Perda total do provedor | restore do dump em Postgres novo | < 4 h | < 24 h |

---

## LGPD

Ninguém pediu esta seção, e ela é obrigatória. O MARK SISTEM vai guardar nome,
telefone, e-mail e **conversas inteiras de WhatsApp** de pessoas que não são
clientes da Marktiva — são leads. Isso é dado pessoal sob a Lei 13.709.

O que a arquitetura já resolve:

| Exigência | Onde |
|---|---|
| Finalidade e base legal | legítimo interesse comercial; registrado em `contacts.origem_id` |
| Direito de eliminação | exclusão lógica + purga real em 30 dias, incluindo mensagens e arquivos |
| Direito de acesso | exportação por contato, em JSON, na ficha |
| Registro de tratamento | `audit_logs` já cobre |
| Segurança | criptografia em repouso e em trânsito, controle de acesso, auditoria |
| Opt-out | `contacts.opt_out_em` e `wa_optouts`, respeitados por toda campanha |
| Retenção | conversas de lead perdido purgadas em 24 meses (configurável) |

O que depende de você, não de código: manter a política de privacidade
publicada, e ter contrato com o provedor de WhatsApp escolhido. Registrado aqui
para não ser esquecido no lançamento.
