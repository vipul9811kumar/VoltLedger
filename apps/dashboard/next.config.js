/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { allowedOrigins: ['*'] } },
  // Prevent Next.js from bundling Prisma — it needs its native engine binary at runtime
  serverExternalPackages: ['@prisma/client', '@voltledger/db'],
};

module.exports = nextConfig;
