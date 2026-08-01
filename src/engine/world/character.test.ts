import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSoldier, animateSoldier } from './character';

describe('character', () => {
  it('builds a soldier with hit meshes and limb pivots', () => {
    const s = buildSoldier('alpha');
    expect(s.body).toBeInstanceOf(THREE.Mesh);
    expect(s.head).toBeInstanceOf(THREE.Mesh);
    expect(s.legL).toBeInstanceOf(THREE.Group);
    expect(s.legR).toBeInstanceOf(THREE.Group);
    expect(s.armL).toBeInstanceOf(THREE.Group);
    expect(s.armR).toBeInstanceOf(THREE.Group);
    expect(s.gun).toBeInstanceOf(THREE.Mesh);
    expect(s.body.position.y).toBeGreaterThan(0.5);
    expect(s.head.position.y).toBeGreaterThan(s.body.position.y);
  });

  it('colors alpha vs bravo vests differently', () => {
    const alpha = buildSoldier('alpha');
    const bravo = buildSoldier('bravo');
    const alphaColor = (alpha.body.material as THREE.MeshLambertMaterial).color.getHex();
    const bravoColor = (bravo.body.material as THREE.MeshLambertMaterial).color.getHex();
    expect(alphaColor).not.toBe(bravoColor);
  });

  it('swings legs when moving, rests them when idle', () => {
    const s = buildSoldier('bravo');
    animateSoldier(s, 0, false, false);
    const idle = s.legL.rotation.x;
    animateSoldier(s, Math.PI / 2, true, false);
    const moving = s.legL.rotation.x;
    expect(Math.abs(moving)).toBeGreaterThan(Math.abs(idle));
  });

  it('raises arms when aiming', () => {
    const s = buildSoldier('alpha');
    animateSoldier(s, 0, false, false);
    const before = s.armR.rotation.x;
    animateSoldier(s, 0, false, true);
    expect(s.armR.rotation.x).toBeGreaterThan(before);
  });
});
