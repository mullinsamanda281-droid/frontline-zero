import { describe, expect, it, vi } from 'vitest';
import { FpsCamera, type FpsInputState } from '../camera/fpsCamera';
import { SlideController } from './slide';

const IDLE: FpsInputState = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
};

function sprintingCamera(): FpsCamera {
  const camera = new FpsCamera({ enforceStamina: false });
  for (let i = 0; i < 30; i++) camera.update(1 / 60, { ...IDLE, sprint: true, forward: true });
  return camera;
}

describe('SlideController', () => {
  it('starts sliding when crouching while sprinting', () => {
    const camera = sprintingCamera();
    const slide = new SlideController({});
    slide.update(0, camera, true);
    expect(slide.phase).toBe('sliding');
    expect(camera.velocity.z).toBeLessThan(0);
  });

  it('does not start from a walk', () => {
    const camera = new FpsCamera({ enforceStamina: false });
    const slide = new SlideController({});
    slide.update(0, camera, true);
    expect(slide.phase).toBe('ready');
  });

  it('slides along the current velocity direction', () => {
    const camera = sprintingCamera();
    camera.yaw = 0;
    const slide = new SlideController({});
    slide.update(0, camera, true);
    expect(Math.abs(camera.velocity.z)).toBeGreaterThan(0);
    expect(Math.abs(camera.velocity.x)).toBeLessThan(0.001);
  });

  it('decays slide speed with friction', () => {
    const camera = sprintingCamera();
    const slide = new SlideController({ friction: 2.5 });
    slide.update(0, camera, true);
    const first = Math.hypot(camera.velocity.x, camera.velocity.z);
    slide.update(0.2, camera, true);
    const second = Math.hypot(camera.velocity.x, camera.velocity.z);
    expect(second).toBeLessThan(first);
    expect(first - second).toBeCloseTo(0.5, 6);
  });

  it('gains downhill momentum, capped', () => {
    const camera = sprintingCamera();
    const slope = vi.fn(() => Math.PI / 4);
    const slide = new SlideController({ friction: 0, downhillAccel: 6, downhillSpeedCap: 3, slopeRadians: slope });
    slide.update(0, camera, true);
    slide.update(0.5, camera, true);
    const speed = Math.hypot(camera.velocity.x, camera.velocity.z);
    expect(speed).toBeGreaterThan(8.5);
    expect(speed).toBeLessThanOrEqual(8.5 + 3);
  });

  it('ends into crouch when crouch is held', () => {
    const camera = sprintingCamera();
    const onEnd = vi.fn();
    const slide = new SlideController({ duration: 0.1, onSlideEnd: onEnd });
    slide.update(0, camera, true);
    slide.update(0.2, camera, true);
    expect(slide.phase).toBe('crouch');
    expect(onEnd).toHaveBeenCalledWith(true);
  });

  it('enters cooldown and blocks a new slide', () => {
    const camera = sprintingCamera();
    const slide = new SlideController({ duration: 0.1, cooldown: 1.2 });
    slide.update(0, camera, true);
    slide.update(0.2, camera, false);
    expect(slide.phase).toBe('cooldown');
    slide.update(0.5, camera, true);
    expect(slide.phase).toBe('cooldown');
  });

  it('returns to ready after the cooldown elapses', () => {
    const camera = sprintingCamera();
    const slide = new SlideController({ duration: 0.1, cooldown: 1.2 });
    slide.update(0, camera, true);
    slide.update(0.2, camera, false);
    slide.update(1.3, camera, false);
    expect(slide.phase).toBe('ready');
  });

  it('keeps sliding direction despite opposing input', () => {
    const camera = sprintingCamera();
    const slide = new SlideController({});
    slide.update(0, camera, true);
    camera.update(1 / 60, { ...IDLE, back: true, forward: false, sprint: true });
    slide.update(1 / 60, camera, true);
    expect(camera.velocity.z).toBeLessThan(0);
  });
});
