"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegação do sistema.
 *
 * Só aparecem módulos que existem e funcionam. Item desabilitado "em breve" é
 * ruído: ocupa espaço, some quando chega, e ensina a ignorar o menu.
 *
 * O que cada pessoa vê depende da permissão, resolvida no servidor — o layout
 * monta a lista e passa pronta. Esconder aqui é conveniência; quem recusa de
 * verdade é o `exigir()` dentro de cada página.
 */

export type ItemMenu = {
  href: string;
  rotulo: string;
  icone: keyof typeof ICONES;
};

export type GrupoMenu = {
  titulo?: string;
  itens: ItemMenu[];
};

const ICONES = {
  grafico: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 15l4-5 3 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  predio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="4" y="3" width="10" height="18" rx="1.5" />
      <path d="M14 8h5a1.5 1.5 0 0 1 1.5 1.5V21" strokeLinecap="round" />
      <path d="M7.5 7h3M7.5 11h3M7.5 15h3" strokeLinecap="round" />
    </svg>
  ),
  pessoas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 5M17.5 20a5.5 5.5 0 0 0-2-4.3" strokeLinecap="round" />
    </svg>
  ),
  funil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3.5 5h17l-6.5 7.5V20l-4-2.5v-5L3.5 5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lixeira: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M10 4h4M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
} as const;

export function BarraLateral({ grupos }: { grupos: GrupoMenu[] }) {
  const caminho = usePathname();

  /**
   * `/clientes/lixeira` não deve acender também o item `/clientes`. Prefixo só
   * conta quando o item não é a raiz de outro que também está no menu — por isso
   * a comparação é por segmento, e não por `startsWith` cru.
   */
  const ehAtual = (href: string): boolean => {
    if (caminho === href) return true;
    if (href === "/") return false;
    const filhos = grupos.flatMap((g) => g.itens.map((i) => i.href));
    const maisEspecifico = filhos.some((h) => h !== href && h.startsWith(`${href}/`) && caminho.startsWith(h));
    return !maisEspecifico && caminho.startsWith(`${href}/`);
  };

  return (
    <aside className="sistema__barra">
      <Link href="/" className="sistema__marca">
        <span className="sistema__logo" aria-hidden>
          M
        </span>
        <span className="sistema__marca-texto">MARK SISTEM</span>
      </Link>

      <nav className="sistema__nav" aria-label="Navegação principal">
        {grupos.map((grupo, i) => (
          <div key={grupo.titulo ?? i}>
            {grupo.titulo && <div className="sistema__grupo">{grupo.titulo}</div>}
            {grupo.itens.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="sistema__item"
                aria-current={ehAtual(item.href) ? "page" : undefined}
              >
                {ICONES[item.icone]}
                <span>{item.rotulo}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
