-- Busca tolerante a acento e a erro de digitação.
--
-- unaccent: "orcamento" encontra "Orçamento", "calendario" encontra
-- "Calendário". Em português isso não é luxo — é a diferença entre a busca
-- servir e não servir.
--
-- pg_trgm: índice GIN por trigrama, que é o que faz ILIKE '%termo%' usar
-- índice em vez de varrer a tabela.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() é STABLE por padrão (depende do dicionário), e função não-IMMUTABLE
-- não pode entrar em índice. Este invólucro fixa o dicionário, tornando-a
-- determinística — que é a condição para indexar a expressão.
CREATE OR REPLACE FUNCTION sem_acento(texto text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent', texto) $$;

CREATE INDEX IF NOT EXISTS idx_contacts_busca
  ON contacts USING gin (sem_acento(nome) gin_trgm_ops)
  WHERE deletado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_empresa_busca
  ON contacts USING gin (sem_acento(coalesce(empresa, '')) gin_trgm_ops)
  WHERE deletado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_busca
  ON clients USING gin (sem_acento(razao_social || ' ' || coalesce(nome_fantasia, '')) gin_trgm_ops)
  WHERE deletado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_demands_busca
  ON demands USING gin (sem_acento(titulo) gin_trgm_ops)
  WHERE deletado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_events_busca
  ON events USING gin (sem_acento(titulo) gin_trgm_ops)
  WHERE deletado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_fin_entries_busca
  ON fin_entries USING gin (sem_acento(descricao) gin_trgm_ops)
  WHERE deletado_em IS NULL;
