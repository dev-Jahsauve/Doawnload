/** @type {import('next').NextConfig} */
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async rewrites() {
    // Le navigateur parle toujours à /api (même origine) : pas de CORS ni d'URL d'API exposée.
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
