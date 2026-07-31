export type PauseListener = (paused: boolean) => void;

export class PauseManager {
  private paused = false;
  private readonly listeners = new Set<PauseListener>();

  get isPaused(): boolean {
    return this.paused;
  }

  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    this.listeners.forEach((listener) => listener(this.paused));
  }

  toggle(): boolean {
    this.setPaused(!this.paused);
    return this.paused;
  }

  onPause(listener: PauseListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
