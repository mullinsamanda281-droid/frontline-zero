export class RateLimiter {
  private readonly counts = new Map<object | string, { windowStart: number; count: number }>();
  constructor(
    private readonly maxPerWindow = 120,
    private readonly windowMs = 1000,
  ) {}

  allow(key: object | string): boolean {
    const now = Date.now();
    const entry = this.counts.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.counts.set(key, { windowStart: now, count: 1 });
      return true;
    }
    entry.count++;
    return entry.count <= this.maxPerWindow;
  }

  reset(key: object | string): void {
    this.counts.delete(key);
  }
}
