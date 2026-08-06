-- 0002 — Row Level Security.
--
-- A segunda parede. A primeira é `exigir()` em @mark/core; esta existe para o
-- dia em que uma consulta nova esquecer o WHERE. Se as duas dependessem da
-- mesma disciplina, seriam uma só.

-- ---------------------------------------------------------------------------
-- Contexto da transação
-- ---------------------------------------------------------------------------
-- Lidas por toda política. O segundo argumento `true` de current_setting faz
-- devolver NULL em vez de erro quando a variável não foi definida — assim uma
-- conexão sem contexto simplesmente não enxerga nada, em vez de estourar.
--
-- STABLE (e não IMMUTABLE) porque o valor muda entre transações; marcar como
-- IMMUTABLE faria o planejador cachear o resultado entre requisições.

CREATE OR REPLACE FUNCTION app_org() RETURNS uuid
  LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.organizacao_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_usuario() RETURNS uuid
  LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.usuario_id', true), '')::uuid $$;

-- Válvula para migração e seed, que precisam escrever antes de existir
-- organização a que pertencer. A aplicação nunca define `app.admin`: quem a
-- define é a CLI de manutenção, que já tem a credencial do banco em mãos.
CREATE OR REPLACE FUNCTION app_admin() RETURNS boolean
  LANGUAGE sql STABLE AS
$$ SELECT coalesce(current_setting('app.admin', true), '') = 'sim' $$;

-- Válvula do login, e só dele.
--
-- Autenticar é o problema do ovo e da galinha da RLS: para achar a sessão pelo
-- token ainda não se sabe o usuário, e para achar o usuário pelo e-mail ainda
-- não se sabe a organização. Alguma abertura é inevitável.
--
-- Esta é deliberadamente estreita: só `usuarios` e `sessoes` mencionam
-- app_autenticando(). Toda outra tabela permanece fechada mesmo com a variável
-- ligada, então um erro no caminho de login não vira leitura do financeiro.
-- Quem a define é apenas @mark/auth, em duas funções.
CREATE OR REPLACE FUNCTION app_autenticando() RETURNS boolean
  LANGUAGE sql STABLE AS
$$ SELECT coalesce(current_setting('app.autenticando', true), '') = 'sim' $$;

-- ---------------------------------------------------------------------------
-- organizacoes
-- ---------------------------------------------------------------------------
ALTER TABLE organizacoes ENABLE ROW LEVEL SECURITY;
-- FORCE é o que faz a política valer também para o dono da tabela. Sem ele, a
-- aplicação conectada como owner — o caso normal em Neon e em Postgres
-- gerenciado — ignoraria toda a RLS silenciosamente, e o teste passaria dando
-- a impressão de proteção.
ALTER TABLE organizacoes FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolamento ON organizacoes
  USING (id = app_org() OR app_admin())
  WITH CHECK (id = app_org() OR app_admin());

-- ---------------------------------------------------------------------------
-- usuarios
-- ---------------------------------------------------------------------------
-- Usuário é global (pode pertencer a várias organizações), então o isolamento
-- não é por coluna: é "compartilha organização comigo".
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios FORCE ROW LEVEL SECURITY;

CREATE POLICY usuarios_isolamento ON usuarios
  USING (
    app_admin()
    OR app_autenticando()   -- busca por e-mail no login, antes de haver contexto
    OR EXISTS (
      SELECT 1 FROM membros m
       WHERE m.usuario_id = usuarios.id
         AND m.organizacao_id = app_org()
    )
  )
  -- Escrita não abre para app_autenticando: o login lê usuário, nunca cria um.
  WITH CHECK (app_admin() OR id = app_usuario());

-- A subconsulta da política roda a cada linha; sem este índice ela vira
-- sequential scan em membros.
CREATE INDEX IF NOT EXISTS membros_usuario_org ON membros (usuario_id, organizacao_id);

-- ---------------------------------------------------------------------------
-- papeis e permissões
-- ---------------------------------------------------------------------------
ALTER TABLE papeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE papeis FORCE ROW LEVEL SECURITY;

-- organizacao_id NULL = papel de sistema, visível a todos, editável por ninguém
-- pela aplicação (só com app_admin).
CREATE POLICY papeis_isolamento ON papeis
  USING (organizacao_id = app_org() OR organizacao_id IS NULL OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

ALTER TABLE papel_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE papel_permissoes FORCE ROW LEVEL SECURITY;

CREATE POLICY papel_permissoes_isolamento ON papel_permissoes
  USING (
    app_admin()
    OR EXISTS (
      SELECT 1 FROM papeis p
       WHERE p.id = papel_permissoes.papel_id
         AND (p.organizacao_id = app_org() OR p.organizacao_id IS NULL)
    )
  )
  WITH CHECK (
    app_admin()
    OR EXISTS (
      SELECT 1 FROM papeis p
       WHERE p.id = papel_permissoes.papel_id
         AND p.organizacao_id = app_org()
    )
  );

-- ---------------------------------------------------------------------------
-- membros e escopos
-- ---------------------------------------------------------------------------
ALTER TABLE membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros FORCE ROW LEVEL SECURITY;

CREATE POLICY membros_isolamento ON membros
  USING (organizacao_id = app_org() OR app_admin())
  WITH CHECK (organizacao_id = app_org() OR app_admin());

ALTER TABLE membro_escopos ENABLE ROW LEVEL SECURITY;
ALTER TABLE membro_escopos FORCE ROW LEVEL SECURITY;

CREATE POLICY membro_escopos_isolamento ON membro_escopos
  USING (
    app_admin()
    OR EXISTS (
      SELECT 1 FROM membros m
       WHERE m.id = membro_escopos.membro_id
         AND m.organizacao_id = app_org()
    )
  )
  WITH CHECK (
    app_admin()
    OR EXISTS (
      SELECT 1 FROM membros m
       WHERE m.id = membro_escopos.membro_id
         AND m.organizacao_id = app_org()
    )
  );

-- ---------------------------------------------------------------------------
-- sessoes
-- ---------------------------------------------------------------------------
-- Sessão é do usuário, não da organização: ninguém lê a sessão de outro, nem
-- dentro da mesma empresa. Roubar cookie de colega não deve depender de a
-- aplicação lembrar de filtrar.
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes FORCE ROW LEVEL SECURITY;

-- app_autenticando() cobre a busca pelo token_hash, quando o usuário ainda é
-- desconhecido, e a gravação da sessão recém-criada.
CREATE POLICY sessoes_proprias ON sessoes
  USING (usuario_id = app_usuario() OR app_autenticando() OR app_admin())
  WITH CHECK (usuario_id = app_usuario() OR app_autenticando() OR app_admin());
