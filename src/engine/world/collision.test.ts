import { describe, expect, it } from 'vitest';
import { Vec3 } from '../camera/vec3';
import { CollisionWorld, makeAABB } from './collision';

function containerWorld(): CollisionWorld {
  return new CollisionWorld([
    makeAABB(0, 1.25, -4, 3, 2.5, 6),
    makeAABB(6, 2.5, -10, 6, 5, 3),
  ]);
}

describe('CollisionWorld.raycast', () => {
  it('hits a box in front', () => {
    const world = containerWorld();
    const dist = world.raycast(new Vec3(0, 1, 0), new Vec3(0, 0, -1), 20);
    expect(dist).not.toBeNull();
    expect(dist as number).toBeCloseTo(1, 5);
  });

  it('misses when aimed past the box', () => {
    const world = containerWorld();
    const dist = world.raycast(new Vec3(0, 1, -3), new Vec3(0, 0, -1), 20);
    expect(dist).toBeNull();
  });

  it('respects max distance', () => {
    const world = containerWorld();
    const dist = world.raycast(new Vec3(0, 1, 0), new Vec3(0, 0, -1), 0.5);
    expect(dist).toBeNull();
  });

  it('hits the taller box at height', () => {
    const world = containerWorld();
    const dist = world.raycast(new Vec3(6, 4, 0), new Vec3(0, 0, -1), 30);
    expect(dist).toBeCloseTo(8.5, 5);
  });
});

describe('CollisionWorld.heightAt', () => {
  it('returns ground height away from boxes', () => {
    const world = containerWorld();
    expect(world.heightAt(50, 50)).toBe(0);
  });

  it('returns box top height over a box', () => {
    const world = containerWorld();
    expect(world.heightAt(0, -4)).toBe(2.5);
    expect(world.heightAt(6, -10)).toBe(5);
  });
});

describe('CollisionWorld.resolveCapsule', () => {
  it('reports floor from box top when standing on it', () => {
    const world = containerWorld();
    const pos = new Vec3(0, 2.5, -4);
    const result = world.resolveCapsule(pos, 0.35, 1.8);
    expect(result.floorY).toBe(2.5);
    expect(result.penetration).toBe(false);
  });

  it('pushes the capsule out of a box side', () => {
    const world = containerWorld();
    const pos = new Vec3(1.4, 0.5, -4);
    world.resolveCapsule(pos, 0.35, 1.8);
    expect(pos.x).toBeGreaterThan(1.5);
  });

  it('ignores boxes far below the feet', () => {
    const world = containerWorld();
    const pos = new Vec3(0, 4, -4);
    const result = world.resolveCapsule(pos, 0.35, 1.8);
    expect(result.penetration).toBe(false);
    expect(result.floorY).toBe(0);
  });
});
