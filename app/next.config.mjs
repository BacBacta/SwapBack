// Import bundle analyzer only if ANALYZE=true is set
let withBundleAnalyzer = (config) => config; // Default: no-op

if (process.env.ANALYZE === 'true') {
  try {
    const bundleAnalyzer = await import('@next/bundle-analyzer');
    withBundleAnalyzer = bundleAnalyzer.default({
      enabled: true,
    });
  } catch (error) {
    console.warn('⚠️  @next/bundle-analyzer not found. Bundle analysis disabled.');
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Performance: Production optimizations
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  
  // Security: HTTP headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Tailwind + Google Fonts
              "img-src 'self' data: https:",
              "font-src 'self' data: https://fonts.gstatic.com", // Google Fonts
              "connect-src 'self' https://*.helius-rpc.com https://*.solana.com https://api.devnet.solana.com https://api.mainnet-beta.solana.com wss://*.helius-rpc.com wss://*.solana.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
  
  // Performance: Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  
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
    
    // Performance: Code splitting optimization - Simplified to avoid chunk loading errors
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          maxSize: 244000, // Limit chunk size to avoid loading issues
          cacheGroups: {
            // Keep default behavior but with size limits
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
              name(module, chunks, cacheGroupKey) {
                const allChunksNames = chunks.map((chunk) => chunk.name).join('~');
                return `vendors-${allChunksNames}`;
              },
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
