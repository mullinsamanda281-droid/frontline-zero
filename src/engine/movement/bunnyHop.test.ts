import { describe, expect, it } from 'vitest';
import { FpsCamera, type FpsInputState } from '../camera/fpsCamera';
import { BunnyHopController } from './bunnyHop';

const IDLE: FpsInputState = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
};

function hopSetup(): { camera: FpsCamera; hop: BunnyHopController } {
  const camera = new FpsCamera({ enforceStamina: false, jumpSpeed: 5, gravity: 20 });
  const hop = new BunnyHopController({});
  for (let i = 0; i < 120; i++) camera.update(1 / 60, { ...IDLE, sprint: true, forward: true });
  return { camera, hop };
}

function fullJumpCycle(camera: FpsCamera, hop: BunnyHopController, jumpHeld: boolean): void {
  const input = { ...IDLE, sprint: true, forward: true, jump: jumpHeld };
  for (let i = 0; i < 300; i++) {
    camera.update(1 / 60, input);
    hop.update(16.67, camera, jumpHeld);
  }
}

describe('BunnyHopController', () => {
  it('grants a speed bonus when jump is held on landing', () => {
    const { camera, hop } = hopSetup();
    const before = Math.hypot(camera.velocity.x, camera.velocity.z);
    fullJumpCycle(camera, hop, true);
    const after = Math.hypot(camera.velocity.x, camera.velocity.z);
    expect(after).toBeGreaterThan(before);
    expect(hop.bonus).toBeGreaterThan(0);
  });

  it('grants no bonus without a full airborne phase', () => {
    const { camera, hop } = hopSetup();
    const before = Math.hypot(camera.velocity.x, camera.velocity.z);
    hop.update(16.67, camera, true);
    expect(Math.hypot(camera.velocity.x, camera.velocity.z)).toBeCloseTo(before, 6);
    expect(hop.bonus).toBe(0);
  });

  it('does not grant a bonus when jump is not held on landing', () => {
    const { camera, hop } = hopSetup();
    const before = Math.hypot(camera.velocity.x, camera.velocity.z);
    fullJumpCycle(camera, hop, false);
    const after = Math.hypot(camera.velocity.x, camera.velocity.z);
    expect(after).toBeCloseTo(before, 3);
    expect(hop.bonus).toBe(0);
  });

  it('caps the total bonus and therefore speed', () => {
    const { camera, hop } = hopSetup();
    for (let hopCount = 0; hopCount < 6; hopCount++) {
      fullJumpCycle(camera, hop, true);
    }
    expect(hop.bonus).toBeLessThanOrEqual(1.8);
    const speed = Math.hypot(camera.velocity.x, camera.velocity.z);
    expect(speed).toBeLessThanOrEqual(10.2 + 1.8 + 0.001);
  });

  it('ignores hops when not sprinting', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const hop = new BunnyHopController({});
    camera.update(1 / 60, { ...IDLE, forward: true, jump: true });
    for (let i = 0; i < 60; i++) {
      camera.update(1 / 60, { ...IDLE, forward: true });
      hop.update(16.67, camera, true);
      if (camera.onGround) break;
    }
    expect(hop.bonus).toBe(0);
  });
});
