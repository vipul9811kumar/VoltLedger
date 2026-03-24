/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['*'] },
    // Prevent Next.js from bundling Prisma — it needs its native engine binary at runtime
    // Next.js 14.x uses this key (renamed to serverExternalPackages in Next.js 15)
    serverComponentsExternalPackages: ['@prisma/client', '@voltledger/db'],
  },
};

module.exports = nextConfig;
