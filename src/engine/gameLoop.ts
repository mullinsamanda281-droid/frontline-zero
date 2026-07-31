export interface GameLoopCallbacks {
  update(dt: number): void;
  render(alpha: number): void;
}

export class GameLoop {
  private static readonly STEP = 1 / 60;
  private static readonly MAX_FRAME = 0.25;

  private accumulator = 0;
  private lastTime: number | null = null;
  private running = false;

  constructor(private readonly callbacks: GameLoopCallbacks) {}

  start(): void {
    this.running = true;
    this.lastTime = null;
    this.accumulator = 0;
  }

  stop(): void {
    this.running = false;
  }

  get isRunning(): boolean {
    return this.running;
  }

  tick(nowMs: number): void {
    if (!this.running) return;
    if (this.lastTime === null) {
      this.lastTime = nowMs;
      return;
    }
    let frame = (nowMs - this.lastTime) / 1000;
    this.lastTime = nowMs;
    if (frame > GameLoop.MAX_FRAME) frame = GameLoop.MAX_FRAME;
    this.accumulator += frame;
    let updates = 0;
    while (this.accumulator >= GameLoop.STEP) {
      this.callbacks.update(GameLoop.STEP);
      this.accumulator -= GameLoop.STEP;
      updates++;
      if (updates > 300) break;
    }
    this.callbacks.render(this.accumulator / GameLoop.STEP);
  }
}
