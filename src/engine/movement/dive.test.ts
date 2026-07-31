import { describe, expect, it } from 'vitest';
import { FpsCamera, type FpsInputState } from '../camera/fpsCamera';
import { DiveController, type DivePhase } from './dive';

const IDLE: FpsInputState = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
};

function run(dive: DiveController, camera: FpsCamera, frames: number, diveHeld: boolean, proneHeld: boolean): void {
  for (let i = 0; i < frames; i++) {
    camera.update(1 / 60, { ...IDLE, forward: true, sprint: diveHeld || proneHeld ? true : false });
    dive.update(1 / 60, camera, diveHeld, proneHeld);
  }
}

describe('DiveController', () => {
  it('dives from a sprint with an arc', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const phases: DivePhase[] = [];
    const dive = new DiveController({ onPhaseChange: (p) => phases.push(p) });
    for (let i = 0; i < 30; i++) camera.update(1 / 60, { ...IDLE, sprint: true });
    dive.update(1 / 60, camera, true, false);
    expect(dive.phase).toBe('diving');
    expect(phases).toContain('diving');
    expect(camera.velocity.y).toBeGreaterThan(0);
    expect(Math.hypot(camera.velocity.x, camera.velocity.z)).toBeGreaterThan(8);
  });

  it('does not dive without sprint', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const dive = new DiveController({});
    dive.update(1 / 60, camera, true, false);
    expect(dive.phase).toBe('ready');
  });

  it('does not dive mid-air', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const dive = new DiveController({});
    camera.update(1 / 60, { ...IDLE, sprint: true, jump: true });
    dive.update(1 / 60, camera, true, false);
    expect(dive.phase).toBe('ready');
  });

  it('lands into prone and lowers eye height', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const dive = new DiveController({});
    for (let i = 0; i < 30; i++) camera.update(1 / 60, { ...IDLE, sprint: true });
    dive.update(1 / 60, camera, true, false);
    run(dive, camera, 120, true, true);
    expect(dive.phase).toBe('prone');
    expect(camera.eyeHeight).toBeCloseTo(0.4, 1);
    expect(camera.speedMultiplier).toBe(0.5);
  });

  it('recovers and stands after releasing prone', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const dive = new DiveController({ recoveryTime: 0.3 });
    for (let i = 0; i < 30; i++) camera.update(1 / 60, { ...IDLE, sprint: true });
    dive.update(1 / 60, camera, true, false);
    run(dive, camera, 120, false, true);
    expect(dive.phase).toBe('prone');
    run(dive, camera, 90, false, false);
    expect(dive.phase).toBe('ready');
    expect(camera.eyeHeight).toBeCloseTo(1.6, 1);
    expect(camera.speedMultiplier).toBe(1);
  });

  it('stands up after a dive when prone is released mid-flight', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const dive = new DiveController({ recoveryTime: 0.2 });
    for (let i = 0; i < 30; i++) camera.update(1 / 60, { ...IDLE, sprint: true });
    dive.update(1 / 60, camera, true, false);
    run(dive, camera, 150, false, false);
    expect(dive.phase).toBe('ready');
  });

  it('toggles prone in place without sprint', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const dive = new DiveController({});
    dive.update(1 / 60, camera, false, true);
    expect(dive.phase).toBe('prone');
    run(dive, camera, 30, false, true);
    expect(camera.eyeHeight).toBeLessThan(1);
  });
});
