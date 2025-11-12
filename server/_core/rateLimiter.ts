export class RateLimitError extends Error {
  readonly retryAt: number;

  constructor(message: string, retryAt: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAt = retryAt;
  }
}

interface RateLimiterOptions {
  windowMs: number;
  maxAttempts: number;
  lockoutMs: number;
}

interface RateLimiterEntry {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

/**
 * Provides a lightweight in-memory rate limiter with lockout support.
 */
export class RateLimiter {
  private readonly entries = new Map<string, RateLimiterEntry>();
  private lastCleanup = 0;

  constructor(private readonly options: RateLimiterOptions) {}

  assertNotLocked(key: string): void {
    const now = Date.now();
    const entry = this.entries.get(key);
    if (!entry) return;

    // Reset stale windows
    if (now - entry.firstAttemptAt > this.options.windowMs && !entry.lockedUntil) {
      this.entries.delete(key);
      return;
    }

    if (entry.lockedUntil && entry.lockedUntil > now) {
      throw new RateLimitError(this.buildLockoutMessage(entry.lockedUntil, now), entry.lockedUntil);
    }

    if (entry.attempts >= this.options.maxAttempts) {
      entry.lockedUntil = now + this.options.lockoutMs;
      throw new RateLimitError(this.buildLockoutMessage(entry.lockedUntil, now), entry.lockedUntil);
    }
  }

  recordFailure(key: string): void {
    const now = Date.now();
    this.cleanup(now);

    const entry = this.ensureEntry(key, now);

    if (entry.lockedUntil && entry.lockedUntil > now) {
      throw new RateLimitError(this.buildLockoutMessage(entry.lockedUntil, now), entry.lockedUntil);
    }

    if (now - entry.firstAttemptAt > this.options.windowMs) {
      entry.attempts = 0;
      entry.firstAttemptAt = now;
      entry.lockedUntil = undefined;
    }

    entry.attempts += 1;

    if (entry.attempts >= this.options.maxAttempts) {
      entry.lockedUntil = now + this.options.lockoutMs;
      throw new RateLimitError(this.buildLockoutMessage(entry.lockedUntil, now), entry.lockedUntil);
    }
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  private ensureEntry(key: string, now: number): RateLimiterEntry {
    const current = this.entries.get(key);
    if (current) {
      return current;
    }

    const entry: RateLimiterEntry = {
      attempts: 0,
      firstAttemptAt: now,
    };
    this.entries.set(key, entry);
    return entry;
  }

  private cleanup(now: number): void {
    // Avoid scanning the map on every call
    if (now - this.lastCleanup < this.options.windowMs) {
      return;
    }

    this.lastCleanup = now;
    const expiration = this.options.windowMs + this.options.lockoutMs;

    for (const [key, entry] of this.entries) {
      const lastRelevant = entry.lockedUntil ?? entry.firstAttemptAt;
      if (now - lastRelevant > expiration) {
        this.entries.delete(key);
      }
    }
  }

  private buildLockoutMessage(lockoutUntil: number, now: number): string {
    const seconds = Math.max(1, Math.ceil((lockoutUntil - now) / 1000));
    return `Muitas tentativas. Tente novamente em ${seconds} segundos.`;
  }
}
