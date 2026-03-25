/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['*'] },
  },
  // Prevent Next.js from bundling @prisma/client — pnpm workspace packages
  // don't work with serverComponentsExternalPackages (they resolve to local
  // source, not node_modules), so we use webpack externals directly.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        ({ request }, callback) => {
          if (request === '@prisma/client' || request?.startsWith('@prisma/client/')) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

module.exports = nextConfig;
