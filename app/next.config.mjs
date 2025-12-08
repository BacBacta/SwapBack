import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpack from 'webpack';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RPC_WEBSOCKETS_SHIM_PATH = path.resolve(
  __dirname,
  'src/lib/rpc-websockets-shim.js'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // 🚀 Output standalone pour Docker/Fly.io
  output: 'standalone',
  
  // Désactiver le header X-Powered-By
  poweredByHeader: false,

  // 🔓 Configuration CORS pour les routes API
  // Permet aux clients (dApp, extension, mobile) d'accéder aux APIs
  async headers() {
    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: allowedOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization,X-Requested-With' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ];
  },
  
  // 🚀 Performance optimizations
  experimental: {
    optimizePackageImports: [
      '@solana/web3.js',
      '@coral-xyz/anchor',
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-react-ui',
      'framer-motion',
      'recharts',
      'chart.js',
      'lodash',
      'lucide-react',
      '@heroicons/react',
      'date-fns',
    ],
  },
  
  // Désactiver ESLint et TypeScript pendant le build
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 🔥 Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  webpack: (config, { isServer, dev }) => {
    // Polyfills pour les modules Node.js requis par Solana (côté client uniquement)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        zlib: require.resolve('browserify-zlib'),
        url: require.resolve('url'),
        buffer: require.resolve('buffer/'),
        process: require.resolve('process/browser'),
      };

      config.resolve.alias = {
        ...config.resolve.alias,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        // Fix rpc-websockets v9.x export issues - redirect old paths to shim
        'rpc-websockets/dist/lib/client': RPC_WEBSOCKETS_SHIM_PATH,
        'rpc-websockets/dist/lib/client/websocket.browser': RPC_WEBSOCKETS_SHIM_PATH,
      };

      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      );
      
      // 🚀 Optimized chunk splitting for better caching
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000, // Target ~240KB per chunk for optimal loading
          cacheGroups: {
            // Solana/Web3 - loaded on demand
            solana: {
              test: /[\\/]node_modules[\\/](@solana|@coral-xyz|@project-serum)[\\/]/,
              name: 'solana',
              chunks: 'async', // Async loading for faster initial page load
              priority: 30,
              reuseExistingChunk: true,
            },
            // Wallet adapters - loaded when wallet modal opens
            wallet: {
              test: /[\\/]node_modules[\\/](@solana[\\/]wallet-adapter|@walletconnect)[\\/]/,
              name: 'wallet',
              chunks: 'async',
              priority: 25,
              reuseExistingChunk: true,
            },
            // Charts/Visualization - loaded on dashboard pages only
            charts: {
              test: /[\\/]node_modules[\\/](recharts|chart\.js|react-chartjs-2|d3|victory)[\\/]/,
              name: 'charts',
              chunks: 'async',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Animation libraries - loaded with components that use them
            animation: {
              test: /[\\/]node_modules[\\/](framer-motion|react-spring)[\\/]/,
              name: 'animation',
              chunks: 'async',
              priority: 15,
              reuseExistingChunk: true,
            },
            // React core - shared across all pages
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 40,
              reuseExistingChunk: true,
            },
            // Common utilities
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        },
      };
      
      // 🔥 Production-only optimizations
      if (!dev) {
        config.optimization.minimize = true;
      }
    }
    
    return config;
  },
};

export default nextConfig;

