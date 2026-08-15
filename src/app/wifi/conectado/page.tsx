import { destinoFinal, nomeNegocio, paginaFacebook } from "@/lib/portal";

export const metadata = {
  title: "Conectado",
  robots: { index: false, follow: false },
};

export default async function Conectado({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const negocio = nomeNegocio();
  const nome = typeof sp.nome === "string" ? sp.nome : null;
  const demo = sp.demo === "1";
  const paginaFb = paginaFacebook();
  const destino = destinoFinal();

  return (
    <div className="login-tela">
      <div className="portal-caixa portal-caixa-ok">
        <span className="portal-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none">
            <path
              d="m4 12.5 5 5L20 6.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <h1>Você está conectado</h1>
        <p className="sub">
          {nome ? `Boa navegação, ${nome}!` : "Boa navegação!"} Já pode usar o
          Wi-Fi do {negocio}.
        </p>

        {demo && (
          <p className="portal-aviso" role="note">
            Modo demonstração — nenhum login real foi feito. Cadastre as
            credenciais do Facebook e do Google para valer.
          </p>
        )}

        <div className="portal-botoes">
          {paginaFb && (
            <a
              className="portal-btn portal-btn-fb"
              href={paginaFb}
              target="_blank"
              rel="noopener noreferrer"
            >
              Fazer check-in no Facebook
            </a>
          )}
          {destino && (
            <a className="portal-btn portal-btn-google" href={destino}>
              Continuar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
