import { describe, expect, it } from 'vitest';
import { FpsCounter } from './fpsCounter';

function createCounter(ticksPerSecond: number, totalMs: number) {
  const element = { textContent: '' } as HTMLElement;
  let now = 0;
  const counter = new FpsCounter(element, () => now);
  const tickMs = 1000 / ticksPerSecond;
  let ticks = 0;
  while (now < totalMs) {
    counter.tick();
    now += tickMs;
    ticks++;
  }
  return { counter, element, ticks };
}

describe('FpsCounter', () => {
  it('reports the measured frames per second', () => {
    const { counter } = createCounter(60, 1000);
    expect(Math.abs(counter.value - 60)).toBeLessThanOrEqual(2);
  });

  it('updates the DOM element with the FPS value', () => {
    const { element } = createCounter(120, 1000);
    expect(Math.abs(parseInt(element.textContent ?? '0') - 120)).toBeLessThanOrEqual(2);
  });

  it('does not update before the sample window elapses', () => {
    const element = { textContent: '' } as HTMLElement;
    let now = 0;
    const counter = new FpsCounter(element, () => now);
    for (let i = 0; i < 10; i++) {
      now += 16;
      counter.tick();
    }
    expect(element.textContent).toBe('');
    expect(counter.value).toBe(0);
  });

  it('updates repeatedly across multiple windows', () => {
    const { counter, element } = createCounter(30, 2000);
    expect(Math.abs(counter.value - 30)).toBeLessThanOrEqual(2);
    expect(Math.abs(parseInt(element.textContent ?? '0') - 30)).toBeLessThanOrEqual(2);
  });
});
