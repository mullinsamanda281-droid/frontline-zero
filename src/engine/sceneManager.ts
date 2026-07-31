export enum GameState {
  Menu = 'menu',
  Loading = 'loading',
  Match = 'match',
  GameOver = 'gameover',
}

export type TransitionListener = (from: GameState, to: GameState) => void;

export class SceneManager {
  private current: GameState = GameState.Menu;
  private readonly listeners = new Set<TransitionListener>();

  get state(): GameState {
    return this.current;
  }

  goTo(next: GameState): void {
    if (next === this.current) return;
    const from = this.current;
    this.current = next;
    this.listeners.forEach((listener) => listener(from, next));
  }

  onTransition(listener: TransitionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
