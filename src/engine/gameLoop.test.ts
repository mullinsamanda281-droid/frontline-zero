import { describe, expect, it } from 'vitest';
import { GameLoop } from './gameLoop';

function runLoop(dtMs: number, totalMs: number): { updates: number[]; alphas: number[] } {
  const updates: number[] = [];
  const alphas: number[] = [];
  const loop = new GameLoop({
    update: (dt) => updates.push(dt),
    render: (alpha) => alphas.push(alpha),
  });
  loop.start();
  let now = 0;
  while (now <= totalMs) {
    now += dtMs;
    loop.tick(now);
  }
  return { updates, alphas };
}

describe('GameLoop', () => {
  it('runs exactly 60 updates per simulated second', () => {
    const { updates } = runLoop(16.6667, 1000);
    expect(Math.abs(updates.length - 60)).toBeLessThanOrEqual(1);
    updates.forEach((dt) => expect(dt).toBeCloseTo(1 / 60, 6));
  });

  it('accumulates partial frames and renders with alpha in [0,1)', () => {
    const { alphas } = runLoop(8, 1000);
    alphas.forEach((alpha) => {
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThan(1);
    });
  });

  it('clamps huge frames to prevent a spiral of death', () => {
    const updates: number[] = [];
    const loop = new GameLoop({ update: (dt) => updates.push(dt), render: () => {} });
    loop.start();
    loop.tick(0);
    loop.tick(10000);
    expect(updates.length).toBe(15);
  });

  it('does not update or render when stopped', () => {
    let updates = 0;
    let renders = 0;
    const loop = new GameLoop({ update: () => updates++, render: () => renders++ });
    loop.tick(0);
    loop.tick(1000);
    expect(updates).toBe(0);
    expect(renders).toBe(0);
  });
});
