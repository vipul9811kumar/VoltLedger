import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'warn', 'error']
      : ['warn', 'error'],
  });

// Prevent multiple instances in hot-reload environments (Next.js, etc.)
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;