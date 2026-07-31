import { describe, expect, it, vi } from 'vitest';
import { GameState, SceneManager } from './sceneManager';
import { PauseManager } from './pauseManager';

describe('SceneManager', () => {
  it('starts in the menu state', () => {
    expect(new SceneManager().state).toBe(GameState.Menu);
  });

  it('transitions between states and notifies listeners', () => {
    const manager = new SceneManager();
    const listener = vi.fn();
    manager.onTransition(listener);
    manager.goTo(GameState.Match);
    expect(manager.state).toBe(GameState.Match);
    expect(listener).toHaveBeenCalledWith(GameState.Menu, GameState.Match);
  });

  it('ignores transitions to the current state', () => {
    const manager = new SceneManager();
    const listener = vi.fn();
    manager.onTransition(listener);
    manager.goTo(GameState.Menu);
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports unsubscribing listeners', () => {
    const manager = new SceneManager();
    const listener = vi.fn();
    const unsubscribe = manager.onTransition(listener);
    unsubscribe();
    manager.goTo(GameState.GameOver);
    expect(listener).not.toHaveBeenCalled();
  });

  it('walks the full menu->loading->match->gameover cycle', () => {
    const manager = new SceneManager();
    const seen: GameState[] = [];
    manager.onTransition((_from, to) => seen.push(to));
    manager.goTo(GameState.Loading);
    manager.goTo(GameState.Match);
    manager.goTo(GameState.GameOver);
    manager.goTo(GameState.Menu);
    expect(seen).toEqual([
      GameState.Loading,
      GameState.Match,
      GameState.GameOver,
      GameState.Menu,
    ]);
  });
});

describe('PauseManager', () => {
  it('starts unpaused', () => {
    expect(new PauseManager().isPaused).toBe(false);
  });

  it('toggles pause and notifies listeners', () => {
    const manager = new PauseManager();
    const listener = vi.fn();
    manager.onPause(listener);
    expect(manager.toggle()).toBe(true);
    expect(manager.toggle()).toBe(false);
    expect(listener).toHaveBeenNthCalledWith(1, true);
    expect(listener).toHaveBeenNthCalledWith(2, false);
  });

  it('does not notify when pause state is unchanged', () => {
    const manager = new PauseManager();
    const listener = vi.fn();
    manager.onPause(listener);
    manager.setPaused(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
