import { describe, expect, it } from 'vitest';
import { FpsCamera, type FpsInputState } from './fpsCamera';

const IDLE: FpsInputState = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
};

function input(partial: Partial<FpsInputState>): FpsInputState {
  return { ...IDLE, ...partial };
}

describe('FpsCamera.look', () => {
  it('clamps pitch to +/-89 degrees', () => {
    const camera = new FpsCamera();
    camera.look(0, 1_000_000);
    expect(camera.pitch).toBeCloseTo((-89 * Math.PI) / 180, 6);
    camera.look(0, -1_000_000);
    expect(camera.pitch).toBeCloseTo((89 * Math.PI) / 180, 6);
  });

  it('does not clamp yaw', () => {
    const camera = new FpsCamera();
    camera.look(10_000, 0);
    expect(Math.abs(camera.yaw)).toBeGreaterThan(2 * Math.PI);
  });

  it('turns right when the mouse moves right', () => {
    const camera = new FpsCamera();
    camera.look(100, 0, 0.002);
    expect(camera.yaw).toBeCloseTo(-0.2, 6);
  });
});

describe('FpsCamera.update movement', () => {
  it('moves forward along -Z at yaw 0', () => {
    const camera = new FpsCamera({ moveSpeed: 10 });
    camera.update(0.5, input({ forward: true }));
    expect(camera.position.z).toBeCloseTo(-5, 6);
  });

  it('moves along the direction of the yaw', () => {
    const camera = new FpsCamera({ moveSpeed: 10 });
    camera.yaw = Math.PI / 2;
    camera.update(0.5, input({ forward: true }));
    expect(camera.position.x).toBeCloseTo(-5, 6);
  });

  it('moves right along +X at yaw 0', () => {
    const camera = new FpsCamera({ moveSpeed: 10 });
    camera.update(0.5, input({ right: true }));
    expect(camera.position.x).toBeCloseTo(5, 6);
  });

  it('normalizes diagonal movement to full speed', () => {
    const camera = new FpsCamera({ moveSpeed: 10 });
    camera.update(0.5, input({ forward: true, right: true }));
    const distance = Math.hypot(camera.position.x, camera.position.z);
    expect(distance).toBeCloseTo(5, 6);
  });

  it('is frame-rate independent', () => {
    const once = new FpsCamera({ moveSpeed: 10 });
    once.update(0.1, input({ forward: true }));

    const many = new FpsCamera({ moveSpeed: 10 });
    for (let i = 0; i < 10; i++) many.update(0.01, input({ forward: true }));

    expect(once.position.z).toBeCloseTo(many.position.z, 6);
  });

  it('applies the sprint multiplier', () => {
    const walk = new FpsCamera({ moveSpeed: 10, enforceStamina: false });
    walk.update(0.5, input({ forward: true }));
    const sprint = new FpsCamera({ moveSpeed: 10, enforceStamina: false });
    sprint.update(0.5, input({ forward: true, sprint: true }));
    expect(sprint.position.z).toBeCloseTo(walk.position.z * 1.7, 6);
  });

  it('accelerates to sprint speed within about a quarter second', () => {
    const camera = new FpsCamera({ sprintAcceleration: 8, enforceStamina: false });
    for (let i = 0; i < 15; i++) camera.update(1 / 60, input({ sprint: true }));
    expect(camera.sprintFactor).toBeGreaterThan(0.85);
  });

  it('decays back to walk speed after sprinting', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    for (let i = 0; i < 30; i++) camera.update(1 / 60, input({ sprint: true }));
    for (let i = 0; i < 120; i++) camera.update(1 / 60, IDLE);
    expect(camera.sprintFactor).toBeLessThan(1.01);
  });

  it('drains stamina while sprinting and regenerates when idle', () => {
    const camera = new FpsCamera({ staminaDrainPerSec: 1, staminaRegenPerSec: 0.5 });
    for (let i = 0; i < 60; i++) camera.update(1 / 60, input({ sprint: true }));
    const afterSprint = camera.stamina.ratio;
    expect(afterSprint).toBeLessThan(1);
    camera.sprintFactor = 1;
    for (let i = 0; i < 60; i++) camera.update(1 / 60, IDLE);
    expect(camera.stamina.ratio - afterSprint).toBeCloseTo(0.5, 1);
  });

  it('blocks sprinting when stamina is exhausted', () => {
    const camera = new FpsCamera({ staminaDrainPerSec: 100, staminaRegenPerSec: 0, sprintAcceleration: 8 });
    for (let i = 0; i < 60; i++) camera.update(1 / 60, input({ sprint: true }));
    expect(camera.stamina.isExhausted).toBe(true);
    for (let i = 0; i < 60; i++) camera.update(1 / 60, input({ sprint: true }));
    expect(camera.sprintFactor).toBeLessThanOrEqual(1.01);
  });

  it('jumps, rises, falls, and lands back on the ground', () => {
    const camera = new FpsCamera({ jumpSpeed: 5, gravity: 10 });
    camera.update(1 / 60, input({ jump: true }));
    expect(camera.onGround).toBe(false);
    expect(camera.position.y).toBeGreaterThan(0);

    let landed = false;
    for (let i = 0; i < 600; i++) {
      camera.update(1 / 60, IDLE);
      if (camera.onGround) {
        landed = true;
        break;
      }
    }
    expect(landed).toBe(true);
    expect(camera.position.y).toBe(0);
  });

  it('cannot re-jump in mid-air', () => {
    const camera = new FpsCamera({ jumpSpeed: 5, gravity: 10 });
    camera.update(1 / 60, input({ jump: true }));
    camera.update(1 / 60, input({ jump: true }));
    expect(camera.velocity.y).toBeLessThan(5);
  });
});
