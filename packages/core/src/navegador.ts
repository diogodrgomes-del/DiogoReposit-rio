/**
 * Entrada segura para o navegador.
 *
 * Componentes com `"use client"` importam daqui, nunca de `@mark/core`. O
 * barril principal reexporta as regras de negócio, que falam com Drizzle — e
 * um único `import` de valor a partir dele arrasta o driver do Postgres para o
 * pacote que vai ao cliente. Foi exatamente o que quebrou o build do quadro.
 *
 * Aqui só entra o que é puro: normalização de telefone, ordenação de Kanban,
 * catálogo de permissões, `pode()` e tipos.
 */
export * from "./telefone";
export * from "./ordem";
export * from "./tipos";
export { pode, filtroDeClientes, type Contexto, type Alvo } from "./contexto";
export { PERMISSOES, permissaoExiste, concedivel, type Permissao } from "./permissoes";
