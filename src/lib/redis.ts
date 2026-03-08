import Redis from "ioredis";

function createRedisClient() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");

  return new Redis(url, {
    // Upstash closes idle connections — reconnect automatically
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

const globalForRedis = globalThis as unknown as { redis: Redis };
export const redis = globalForRedis.redis ?? createRedisClient();
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// ─── Cache helpers ────────────────────────────────────────────────────────────

const FLAG_TTL = 60; // seconds

export function flagCacheKey(projectId: string, flagKey: string, environmentId: string) {
  return `flag:${projectId}:${flagKey}:${environmentId}`;
}

export async function getCachedFlag(key: string) {
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function setCachedFlag(key: string, value: unknown) {
  await redis.set(key, JSON.stringify(value), "EX", FLAG_TTL);
}

export async function invalidateFlagCache(projectId: string, flagKey: string) {
  // Delete all environment variants for this flag
  const pattern = `flag:${projectId}:${flagKey}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}
