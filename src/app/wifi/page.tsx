import { nomeNegocio } from "@/lib/portal";

export const metadata = {
  title: "Acesso ao Wi-Fi",
  robots: { index: false, follow: false },
};

const ERROS: Record<string, string> = {
  config: "Wi-Fi ainda não configurado. Avise a equipe do local.",
  recusado: "Você não autorizou o acesso. Tente de novo para conectar.",
  estado: "A sessão expirou. Toque de novo em um dos botões.",
  code: "Não recebemos a confirmação do provedor. Tente de novo.",
  oauth: "Não foi possível confirmar seu login agora. Tente de novo.",
  provedor: "Opção de login inválida.",
};

// Repassa os parametros que o roteador anexou (uamip, mac, challenge…) para os
// links de login, para conseguir liberar a internet depois da autorizacao.
function querystringAp(sp: Record<string, string | string[] | undefined>): string {
  const chaves = [
    "uamip",
    "uamport",
    "challenge",
    "mac",
    "ip",
    "userurl",
    "called",
    "nasid",
    "ssid",
  ];
  const q = new URLSearchParams();
  for (const k of chaves) {
    const v = sp[k];
    if (typeof v === "string" && v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function PortalWifi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const negocio = nomeNegocio();
  const qs = querystringAp(sp);
  const erroChave = typeof sp.erro === "string" ? sp.erro : null;
  const erro = erroChave ? ERROS[erroChave] ?? "Não foi possível conectar." : null;

  return (
    <div className="login-tela">
      <div className="portal-caixa">
        <div className="portal-marca">
          <span className="portal-wifi" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
              <path
                d="M2.5 8.5a15 15 0 0 1 19 0M5.5 12a10.5 10.5 0 0 1 13 0M8.5 15.5a6 6 0 0 1 7 0"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="12" cy="19" r="1.4" fill="currentColor" />
            </svg>
          </span>
          <h1>{negocio}</h1>
          <p className="sub">Entre para usar o Wi-Fi gratuito</p>
        </div>

        {erro && (
          <p className="erro-msg" role="alert">
            {erro}
          </p>
        )}

        <div className="portal-botoes">
          <a className="portal-btn portal-btn-fb" href={`/api/wifi/facebook/start${qs}`}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.9h-2.34V22C18.34 21.21 22 17.06 22 12.06Z"
              />
            </svg>
            Entrar com Facebook
          </a>

          <a className="portal-btn portal-btn-google" href={`/api/wifi/google/start${qs}`}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1a6.2 6.2 0 0 1 0-12.4c1.94 0 3.24.83 3.98 1.54l2.72-2.62C16.96 3.1 14.7 2 12 2a10 10 0 1 0 0 20c5.77 0 9.6-4.06 9.6-9.78 0-.66-.07-1.16-.16-1.66H12Z"
              />
              <path
                fill="#4285F4"
                d="M21.44 12.22c0-.66-.07-1.16-.16-1.66H12v3.9h5.5c-.11.66-.53 1.62-1.4 2.34l2.7 2.09c1.6-1.48 2.64-3.66 2.64-6.67Z"
              />
              <path
                fill="#34A853"
                d="M6.5 14.3a6.2 6.2 0 0 1 0-4.6L3.78 7.6a10 10 0 0 0 0 8.8L6.5 14.3Z"
              />
              <path
                fill="#FBBC05"
                d="M12 22c2.7 0 4.96-.89 6.6-2.42l-2.7-2.09c-.72.5-1.7.85-3.9.85-3.84 0-5.26-2.7-5.5-4.04L3.78 16.4A10 10 0 0 0 12 22Z"
              />
            </svg>
            Entrar com Google
          </a>
        </div>

        <p className="portal-lgpd">
          Ao entrar, você autoriza o {negocio} a receber seu nome e e-mail do
          provedor escolhido para liberar o acesso e enviar novidades. Sua senha
          nunca passa por esta página — o login é feito no site do Facebook ou do
          Google. Você pode pedir a remoção dos seus dados a qualquer momento.
        </p>
      </div>
    </div>
  );
}
