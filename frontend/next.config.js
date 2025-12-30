/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../'),
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Use glob string patterns only; avoid merging non-string defaults
      const ignored = [
        '**/__MACOSX/**',
        '**/Solar/**',
        '**/local/**',
      ];
      config.watchOptions = { ...(config.watchOptions || {}), ignored };
    }
    return config;
  },
}

module.exports = nextConfig
