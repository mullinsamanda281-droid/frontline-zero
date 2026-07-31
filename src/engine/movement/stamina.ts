export class Stamina {
  private value = 1;

  constructor(
    private readonly drainPerSec: number,
    private readonly regenPerSec: number,
    private readonly onChange?: (ratio: number) => void,
  ) {}

  get ratio(): number {
    return this.value;
  }

  get isExhausted(): boolean {
    return this.value <= 0;
  }

  update(dt: number, draining: boolean): void {
    const next = draining
      ? Math.max(0, this.value - this.drainPerSec * dt)
      : Math.min(1, this.value + this.regenPerSec * dt);
    if (next !== this.value) {
      this.value = next;
      this.onChange?.(this.value);
    }
  }
}
