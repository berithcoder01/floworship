interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

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
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxAttempts - 1, resetAt: now + config.windowMs };
  }

  if (entry.count >= config.maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxAttempts - entry.count, resetAt: entry.resetAt };
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

export function createRateLimitMiddleware(config: RateLimitConfig = DEFAULT_CONFIG) {
  return async (request: any, reply: any) => {
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    const body = request.body as any;
    const email = body?.email || '';
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