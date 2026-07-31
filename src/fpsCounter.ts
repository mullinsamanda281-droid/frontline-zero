export class FpsCounter {
  private frames = 0;
  private lastSample: number;
  private current = 0;

  constructor(
    private readonly element: HTMLElement,
    private readonly now: () => number = () => performance.now(),
    private readonly sampleWindowMs = 500,
  ) {
    this.lastSample = this.now();
  }

  tick(): void {
    this.frames++;
    const now = this.now();
    if (now - this.lastSample >= this.sampleWindowMs) {
      this.current = Math.round((this.frames * 1000) / (now - this.lastSample));
      this.frames = 0;
      this.lastSample = now;
      this.element.textContent = `${this.current} FPS`;
    }
  }

  get value(): number {
    return this.current;
  }
}
