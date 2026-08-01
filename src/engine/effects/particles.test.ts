import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ParticleSystem } from './particles';

function visibleCount(scene: THREE.Scene): number {
  let count = 0;
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh && o.visible && o.parent === scene) count++;
  });
  return count;
}

describe('ParticleSystem', () => {
  it('spawns smoke and sparks into the scene', () => {
    const scene = new THREE.Scene();
    const ps = new ParticleSystem(scene);
    ps.spawnSmoke(0, 1, 0);
    ps.spawnSpark(0, 1, 0);
    expect(visibleCount(scene)).toBeGreaterThanOrEqual(1);
  });

  it('recycles particles as they expire', () => {
    const scene = new THREE.Scene();
    const ps = new ParticleSystem(scene);
    for (let i = 0; i < 10; i++) ps.spawnSmoke(i, 1, 0);
    const before = visibleCount(scene);
    for (let i = 0; i < 60; i++) ps.update(1 / 30);
    const after = visibleCount(scene);
    expect(before).toBeGreaterThan(0);
    expect(after).toBe(0);
  });

  it('caps active particles', () => {
    const scene = new THREE.Scene();
    const ps = new ParticleSystem(scene);
    for (let i = 0; i < 200; i++) ps.spawnSmoke(i, 1, 0);
    ps.update(0);
    expect(visibleCount(scene)).toBeLessThanOrEqual(28);
  });

  it('clear empties the scene of particles', () => {
    const scene = new THREE.Scene();
    const ps = new ParticleSystem(scene);
    for (let i = 0; i < 5; i++) ps.spawnSmoke(i, 1, 0);
    ps.clear();
    expect(visibleCount(scene)).toBe(0);
  });
});
