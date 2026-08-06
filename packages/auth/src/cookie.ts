/**
 * Nomes e prazos do cookie de sessão.
 *
 * Arquivo separado, sem nenhuma dependência, porque o middleware roda em Edge e
 * o barril de @mark/auth arrasta argon2 — um módulo nativo que não existe
 * naquele runtime. Importar daqui custa três constantes; importar do índice
 * custaria o pacote inteiro.
 */

export const COOKIE = "mark_sessao";

/** Inatividade tolerada. Passou disso sem usar, a sessão morre. */
export const OCIOSIDADE_H = 12;

/** Teto absoluto: nem sessão em uso contínuo passa daqui sem novo login. */
export const VIDA_MAXIMA_D = 30;

export const MAX_IDADE_COOKIE = OCIOSIDADE_H * 60 * 60;
