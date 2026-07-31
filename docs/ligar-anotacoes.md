# Ligar as anotações do registro

O painel inteiro funciona sem banco de dados — inclusive a **linha do tempo
automática**, que lê as alterações direto do log da Meta e mede o antes/depois
de cada uma. O que falta ligar é só o campo de **anotação escrita à mão**
("o que você testou e por quê"), porque isso nasce dentro do painel e não
existe em lugar nenhum na Meta para ser buscado de novo.

Para guardar isso é preciso um Postgres. Falta cadastrar a variável
`DATABASE_URL` no servidor.

**Tempo: ~4 minutos. Custo: R$ 0,00** (o plano gratuito da Neon sobra muito
para esse volume — são poucas linhas de texto por semana).

---

## Caminho A — pela Vercel (recomendado)

A Vercel cria o banco e cadastra a variável sozinha. Você não copia nem cola
nenhuma senha.

1. Abra <https://vercel.com/dashboard>
2. No menu de cima, clique em **Storage**
3. Clique em **Create Database**
4. Escolha **Neon** (aparece como *Serverless Postgres*)
5. Clique em **Continue** e aceite os termos do marketplace
6. Em **Plan**, deixe o **Free**
7. Em **Region**, escolha **Washington, D.C. (iad1)** ou **São Paulo (gru1)**
   — tanto faz para esse volume; gru1 responde um pouco mais rápido daqui
8. Nome do banco: `marktiva-painel`
9. Clique em **Create**
10. Na tela seguinte, **Connect Project** → escolha o projeto
    **diogo-reposit-rio** → marque **Production** e **Preview** →
    clique em **Connect**

A Vercel cadastra `DATABASE_URL` (e algumas irmãs) automaticamente.

11. Vá em **Deployments**, no deploy mais recente clique nos três pontinhos
    `···` → **Redeploy** → confirme

> Variável nova só vale no build seguinte. Sem o redeploy, o aviso continua
> aparecendo mesmo com o banco já criado.

**Pronto.** Recarregue o painel: o aviso laranja some e o botão *Registrar*
fica ativo. A tabela é criada sozinha na primeira anotação que você salvar —
não precisa rodar nenhum SQL.

---

## Caminho B — pela Neon, se o Storage da Vercel der problema

1. Abra <https://neon.tech> → **Sign up** (dá para entrar com a conta do GitHub)
2. **Create project** → nome `marktiva-painel` → região **AWS São Paulo**
3. Na tela que abre em seguida, em **Connection string**, deixe marcado
   **Pooled connection** e clique no ícone de copiar

   O texto começa com `postgresql://` e tem esse formato:

   ```
   postgresql://usuario:senha@ep-algo-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```

4. **Me mande essa linha aqui no chat.** Eu cadastro a variável na Vercel e
   disparo o redeploy — você não precisa mexer em mais nada.

> Se preferir cadastrar você mesmo: Vercel → projeto **diogo-reposit-rio** →
> **Settings** → **Environment Variables** → **Key** = `DATABASE_URL`,
> **Value** = a linha copiada, marque **Production** e **Preview** → **Save** →
> depois **Deployments** → `···` → **Redeploy**.

---

## Como conferir se deu certo

Abra <https://diogo-reposit-rio.vercel.app/api/saude> no navegador (não precisa
estar logado). Procure:

```json
"bancoConfigurado": true
```

Se estiver `false`, ou a variável não foi salva, ou faltou o redeploy.

---

## O que muda no painel

| | Sem banco (hoje) | Com banco |
|---|---|---|
| Linha do tempo automática das alterações | funciona | funciona |
| Medição de antes/depois de cada alteração | funciona | funciona |
| Escrever "o que testei e por quê" | desligado | funciona |
| Anotação aparece junto da alteração na linha do tempo | — | funciona |

Nada do que já está no painel depende disso. É só o campo de escrita.
