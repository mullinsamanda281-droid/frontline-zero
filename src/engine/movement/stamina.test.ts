import { describe, expect, it } from 'vitest';
import { Stamina } from './stamina';

describe('Stamina', () => {
  it('starts full', () => {
    expect(new Stamina(0.5, 0.5).ratio).toBe(1);
  });

  it('drains while draining and regenerates otherwise', () => {
    const stamina = new Stamina(1, 0.5);
    stamina.update(0.5, true);
    expect(stamina.ratio).toBeCloseTo(0.5, 6);
    stamina.update(1, false);
    expect(stamina.ratio).toBeCloseTo(1, 6);
  });

  it('never drops below zero or rises above one', () => {
    const stamina = new Stamina(10, 10);
    stamina.update(10, true);
    expect(stamina.ratio).toBe(0);
    expect(stamina.isExhausted).toBe(true);
    stamina.update(10, false);
    expect(stamina.ratio).toBe(1);
  });

  it('notifies listeners only on change', () => {
    const ratios: number[] = [];
    const stamina = new Stamina(0.5, 0.5, (r) => ratios.push(r));
    stamina.update(0.5, true);
    stamina.update(0, true);
    stamina.update(0, false);
    expect(ratios).toEqual([0.75]);
  });
});
