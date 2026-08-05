/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // As propostas moram em `public/proposta/<cliente>/index.html`. O reescrito
  // abaixo é só para o link ficar bonito de mandar: /proposta/ecopanos.
  async rewrites() {
    return [
      { source: "/proposta/:cliente", destination: "/proposta/:cliente/index.html" },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
