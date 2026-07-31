import { describe, expect, it } from 'vitest';
import { FpsCamera, type FpsInputState } from '../camera/fpsCamera';
import { LeanController } from './lean';

const IDLE: FpsInputState = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
};

function running(camera: FpsCamera, sprint: boolean, seconds: number): void {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) camera.update(1 / 60, { ...IDLE, sprint });
}

describe('LeanController', () => {
  it('leans left toward -1', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const lean = new LeanController({});
    for (let i = 0; i < 60; i++) lean.update(1 / 60, camera, true, false);
    expect(lean.amount).toBeLessThan(-0.9);
    expect(lean.offset).toBeLessThan(-0.29);
  });

  it('leans right toward +1', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const lean = new LeanController({});
    for (let i = 0; i < 60; i++) lean.update(1 / 60, camera, false, true);
    expect(lean.amount).toBeGreaterThan(0.9);
  });

  it('eases smoothly without overshooting', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const lean = new LeanController({});
    let previous = 0;
    for (let i = 0; i < 60; i++) {
      lean.update(1 / 60, camera, true, false);
      expect(lean.amount).toBeLessThan(previous);
      expect(lean.amount).toBeGreaterThanOrEqual(-1);
      previous = lean.amount;
    }
  });

  it('returns to center when released', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const lean = new LeanController({});
    for (let i = 0; i < 30; i++) lean.update(1 / 60, camera, true, false);
    expect(lean.isLeaning).toBe(true);
    for (let i = 0; i < 120; i++) lean.update(1 / 60, camera, false, false);
    expect(lean.amount).toBe(0);
    expect(lean.isLeaning).toBe(false);
  });

  it('blocks leaning while sprinting', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    running(camera, true, 0.5);
    const lean = new LeanController({});
    for (let i = 0; i < 30; i++) lean.update(1 / 60, camera, true, false);
    expect(lean.amount).toBe(0);
  });

  it('resets a held lean when sprint starts', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const lean = new LeanController({});
    for (let i = 0; i < 30; i++) lean.update(1 / 60, camera, true, false);
    expect(lean.isLeaning).toBe(true);
    for (let i = 0; i < 60; i++) {
      camera.update(1 / 60, { ...IDLE, sprint: true });
      lean.update(1 / 60, camera, true, false);
    }
    expect(lean.amount).toBe(0);
  });

  it('reports offset and eye-height adjustment', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const lean = new LeanController({ maxOffset: 0.4, heightAdjust: 0.1 });
    for (let i = 0; i < 60; i++) lean.update(1 / 60, camera, true, false);
    expect(lean.offset).toBeCloseTo(-0.4, 1);
    expect(lean.heightOffset).toBeCloseTo(0.1, 1);
  });
});
