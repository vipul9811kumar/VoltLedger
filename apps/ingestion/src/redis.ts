import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// BullMQ requires a dedicated connection per queue/worker
// (cannot share a single ioredis connection across multiple BullMQ instances)
export function createRedisConnection(): Redis {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,   // required by BullMQ
    enableReadyCheck: false,
  });

  client.on('error', err => {
    console.error('[Redis] connection error:', err.message);
  });

  return client;
}

// Shared instance for queue/event definitions (not used for blocking operations)
export const redis = createRedisConnection();
