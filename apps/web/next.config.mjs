/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Os pacotes do monorepo publicam TypeScript direto, sem passo de build.
  // Sem isto o Next os trataria como dependência já compilada e engasgaria no
  // primeiro `import type`.
  transpilePackages: ["@mark/core", "@mark/db", "@mark/auth"],
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
