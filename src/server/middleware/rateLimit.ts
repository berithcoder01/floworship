interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL_MS = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
};

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxAttempts - 1, resetAt };
  }

  if (entry.count >= config.maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: config.maxAttempts - entry.count, resetAt: entry.resetAt };
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createRateLimitMiddleware(config: RateLimitConfig = DEFAULT_CONFIG) {
  return async (request: any, reply: any) => {
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    const email = (request.body?.email as string) || '';
    const key = `${ip}:${email}`;

    const { allowed, remaining, resetAt } = checkRateLimit(key, config);

    reply.header('X-RateLimit-Limit', config.maxAttempts);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(resetAt / 1000));

    if (!allowed) {
      return reply.status(429).send({
        error: 'Too many attempts. Try again later.',
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      });
    }
  };
}