/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['www.energieschub.evm.de'],
  },
  eslint: {
    // Ignore ESLint errors during production builds (Vercel)
    ignoreDuringBuilds: true,
  },
  // Exclude Firebase Functions directory from Next.js compilation
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/functions/**', '**/node_modules/**'],
    };
    return config;
  },
}

module.exports = nextConfig
