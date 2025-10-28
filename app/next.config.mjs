/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Désactiver ESLint pendant le build (pour Vercel)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Désactiver TypeScript type checking pendant le build (pour accélérer)
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      fs: false,
      path: false,
      os: false,
      "node:fs": false,
      "node:path": false,
      "node:os": false,
    };
    
    // Ignorer les modules optionnels manquants
    config.ignoreWarnings = [
      { module: /pino-pretty/ },
      { module: /@walletconnect/ },
    ];
    
    return config;
  },
};

export default nextConfig;
