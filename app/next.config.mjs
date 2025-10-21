/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
