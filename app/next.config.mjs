/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      path: false,
      os: false,
      "node:fs": false,
      "node:path": false,
      "node:os": false,
    };
    return config;
  },
};

export default nextConfig;
